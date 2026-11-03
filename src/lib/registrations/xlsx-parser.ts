import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import {
  REGISTRATION_EXCEL_COLUMNS,
  type RegistrationNameChangePreviewItem,
  type RegistrationPreviewDiffSummary,
  type RegistrationPreviewSummary,
  type RegistrationRawColumns,
  type RegistrationRecord,
  type RegistrationRoleCategory,
  type RegistrationSheetName,
  type RegistrationSheetSummary,
  type RegistrationValidationIssue,
} from "@/types/registrations";
import {
  areNamesProbablySamePerson,
  computeRegistrationDedupKey,
  findConflictingColumnsBetweenRows,
  hasFormulaTriggerPrefix,
  inspectCpfField,
  inspectRgOrPassportField,
  isPositiveHealthText,
  normalizePtBrPersonName,
  parseRegistrationBirthDate,
} from "./normalize";
import { readZipArchive } from "./zip-archive";

const EXPECTED_SHEETS: readonly RegistrationSheetName[] = [
  "Consultor",
  "Participante",
  "Todas",
] as const;

const BUILTIN_DATE_NUMFMT_IDS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57,
]);

function assertNoXmlDoctypeOrEntities(xml: string, partName: string): void {
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(xml)) {
    throw new Error(
      `Declaração DOCTYPE/ENTITY proibida detectada em "${partName}" (proteção XXE).`
    );
  }
}

function decodeXmlEntities(text: string): string {
  if (!text) return "";
  return text
    .replace(/&([a-zA-Z0-9#]+);/g, (full, entity: string) => {
      if (entity === "amp") return "&";
      if (entity === "lt") return "<";
      if (entity === "gt") return ">";
      if (entity === "quot") return '"';
      if (entity === "apos") return "'";
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        const code = parseInt(entity.slice(2), 16);
        if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
          throw new Error(`Entidade XML hexadecimal inválida: "${full}".`);
        }
        return String.fromCodePoint(code);
      }
      if (entity.startsWith("#")) {
        const code = parseInt(entity.slice(1), 10);
        if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
          throw new Error(`Entidade XML numérica inválida: "${full}".`);
        }
        return String.fromCodePoint(code);
      }
      throw new Error(`Entidade XML desconhecida ou não suportada: "${full}".`);
    })
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return code === 13 ? "" : String.fromCharCode(code);
    });
}

function extractTextFromTNodes(xmlFragment: string): string {
  const parts: string[] = [];
  const tRegex = /<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g;
  let match: RegExpExecArray | null;
  while ((match = tRegex.exec(xmlFragment)) !== null) {
    parts.push(decodeXmlEntities(match[1]));
  }
  return parts.join("");
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  assertNoXmlDoctypeOrEntities(xml, "xl/sharedStrings.xml");
  const strings: string[] = [];
  const siRegex = /<(?:\w+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?si>/g;
  let match: RegExpExecArray | null;
  while ((match = siRegex.exec(xml)) !== null) {
    strings.push(extractTextFromTNodes(match[1]));
  }
  return strings;
}

export interface WorkbookStylesInfo {
  cellXfNumFmtIds: number[];
  customNumFmts: Map<number, string>;
}

function parseStylesXml(xml: string | undefined): WorkbookStylesInfo {
  const customNumFmts = new Map<number, string>();
  const cellXfNumFmtIds: number[] = [];
  if (!xml) {
    return { cellXfNumFmtIds, customNumFmts };
  }
  assertNoXmlDoctypeOrEntities(xml, "xl/styles.xml");

  const numFmtRegex = /<(?:\w+:)?numFmt\b([^>]*)\/?>/g;
  let nfMatch: RegExpExecArray | null;
  while ((nfMatch = numFmtRegex.exec(xml)) !== null) {
    const attrs = nfMatch[1];
    const idStr = /\bnumFmtId="(\d+)"/.exec(attrs)?.[1];
    const codeRaw = /\bformatCode="([^"]*)"/.exec(attrs)?.[1];
    if (idStr && codeRaw !== undefined) {
      customNumFmts.set(parseInt(idStr, 10), decodeXmlEntities(codeRaw));
    }
  }

  const cellXfsBlock = /<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/.exec(xml)?.[1];
  if (cellXfsBlock) {
    const xfRegex = /<(?:\w+:)?xf\b([^>]*)(?:\/>|>[\s\S]*?<\/(?:\w+:)?xf>)/g;
    let xfMatch: RegExpExecArray | null;
    while ((xfMatch = xfRegex.exec(cellXfsBlock)) !== null) {
      const attrs = xfMatch[1];
      const numFmtId = parseInt(/\bnumFmtId="(\d+)"/.exec(attrs)?.[1] ?? "0", 10);
      cellXfNumFmtIds.push(Number.isFinite(numFmtId) ? numFmtId : 0);
    }
  }

  return { cellXfNumFmtIds, customNumFmts };
}

function isDateFormatCode(numFmtId: number, formatCode: string | undefined): boolean {
  if (BUILTIN_DATE_NUMFMT_IDS.has(numFmtId)) return true;
  if (!formatCode) return false;
  // Remove cores [Red], literais entre aspas e escapes
  const cleaned = formatCode
    .replace(/\[[^\]]*\]/g, "")
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .toLowerCase();
  // Se contém tokens de data (y, d) e não contém marcadores de número puro (0, #)
  return /[yd]/.test(cleaned) && !/[0#]/.test(cleaned);
}

/**
 * Se `formatCode` for um formato numérico explícito de preenchimento com zeros (ex: `00000000000`
 * ou `000"."000"."000"-"00"`), aplica a máscara configurada na célula do Excel.
 * Nunca inventa zeros quando a célula usa formato Geral (`numFmtId = 0`).
 */
function applyExplicitZeroPadFormatCode(rawNumeric: string, formatCode: string | undefined): string {
  if (!formatCode || !/^\d+$/.test(rawNumeric)) return rawNumeric;
  const firstSection = formatCode.split(";")[0] ?? "";
  const unquoted = firstSection.replace(/\[[^\]]*\]/g, "").replace(/\\(.)/g, "$1");

  // Formato simples composto apenas por zeros: ex. "00000000000"
  if (/^0{4,20}$/.test(unquoted)) {
    return rawNumeric.padStart(unquoted.length, "0");
  }

  // Formato com separadores literais e zeros: ex. 000"."000"."000"-"00 ou 000\.000\.000\-00
  const strippedQuotes = unquoted.replace(/"/g, "");
  const zeroCount = (strippedQuotes.match(/0/g) ?? []).length;
  if (zeroCount >= 8 && /^[0.\-/ ]+$/.test(strippedQuotes)) {
    const padded = rawNumeric.padStart(zeroCount, "0");
    if (padded.length > zeroCount) return rawNumeric;
    let digitIdx = 0;
    let formatted = "";
    for (let i = 0; i < strippedQuotes.length; i++) {
      const ch = strippedQuotes.charAt(i);
      if (ch === "0") {
        formatted += padded.charAt(digitIdx++) || "0";
      } else {
        formatted += ch;
      }
    }
    return formatted;
  }

  return rawNumeric;
}

function excelSerialToPtBrDateString(serialInput: number, date1904: boolean, includeTime = false): string | null {
  const serial = Math.floor(serialInput);
  if (!Number.isFinite(serial) || serial < 1 || serial > 60000) return null;

  if (!date1904 && serial === 60) {
    // Bug histórico do Excel 1900 (29/02/1900 não existe no calendário real)
    return null;
  }

  const effectiveSerial = date1904 ? serial + 1462 : serial < 60 ? serial + 1 : serial;
  const utcMs = (effectiveSerial - 25569) * 86400 * 1000;
  const dt = new Date(utcMs);
  const year = dt.getUTCFullYear();
  const month = dt.getUTCMonth() + 1;
  const day = dt.getUTCDate();
  if (year < 1920 || year > 2035) return null;
  const dateText = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  if (!includeTime) return dateText;
  const seconds = Math.round((serialInput - serial) * 86400);
  const time = new Date(utcMs + seconds * 1000).toISOString().slice(11, 19);
  return `${dateText}, ${time}`;
}

function columnLettersToIndex(letters: string): number {
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64);
  }
  return idx - 1;
}

interface ParsedWorksheetRow {
  rowNumber: number;
  cells: string[]; // 0..33
  formulaCols: number[];
  uncomputedFormulaCols: number[];
}

function parseWorksheetXml(
  sheetXml: string,
  sharedStrings: readonly string[],
  styles: WorkbookStylesInfo,
  date1904: boolean,
  sheetName: string
): ParsedWorksheetRow[] {
  assertNoXmlDoctypeOrEntities(sheetXml, `worksheet:${sheetName}`);
  const rows: ParsedWorksheetRow[] = [];
  const rowRegex = /<(?:\w+:)?row\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?row>/g;
  let rowMatch: RegExpExecArray | null;
  let fallbackRowNum = 0;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    fallbackRowNum++;
    const rowAttrs = rowMatch[1];
    const rowInner = rowMatch[2];
    const rAttr = /\br="(\d+)"/.exec(rowAttrs);
    const rowNumber = rAttr ? parseInt(rAttr[1], 10) : fallbackRowNum;

    const cells = new Array<string>(REGISTRATION_EXCEL_COLUMNS.length).fill("");
    const formulaCols: number[] = [];
    const uncomputedFormulaCols: number[] = [];

    const cellRegex = /<(?:\w+:)?c\b([^>]*)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
    let cellMatch: RegExpExecArray | null;
    let nextColIndex = 0;

    while ((cellMatch = cellRegex.exec(rowInner)) !== null) {
      const cellAttrs = cellMatch[1];
      const cellInner = cellMatch[2] ?? "";

      const refMatch = /\br="([A-Z]+)\d+"/.exec(cellAttrs);
      const colIndex = refMatch ? columnLettersToIndex(refMatch[1]) : nextColIndex;
      nextColIndex = colIndex + 1;

      if (colIndex < 0 || colIndex >= REGISTRATION_EXCEL_COLUMNS.length) {
        continue;
      }

      const typeMatch = /\bt="([^"]+)"/.exec(cellAttrs);
      const cellType = typeMatch ? typeMatch[1] : "";
      const styleIdxMatch = /\bs="(\d+)"/.exec(cellAttrs);
      const styleIdx = styleIdxMatch ? parseInt(styleIdxMatch[1], 10) : -1;

      const hasFormulaTag = /<(?:\w+:)?f(?:\s[^>]*)?(?:\/>|>[\s\S]*?<\/(?:\w+:)?f>)/.test(
        cellInner
      );
      if (hasFormulaTag) {
        formulaCols.push(colIndex);
      }

      let value = "";
      if (cellType === "inlineStr") {
        value = extractTextFromTNodes(cellInner);
      } else if (cellType === "s") {
        const vMatch = /<(?:\w+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?v>/.exec(cellInner);
        if (vMatch) {
          const ssIndex = parseInt(vMatch[1].trim(), 10);
          if (ssIndex < 0 || ssIndex >= sharedStrings.length) {
            throw new Error(
              `Índice de string compartilhada inválido (${ssIndex}) na aba "${sheetName}", linha ${rowNumber}.`
            );
          }
          value = sharedStrings[ssIndex] ?? "";
        }
      } else if (cellType === "e") {
        // Erro de fórmula no Excel (#REF!, #VALUE!, #NAME?)
        uncomputedFormulaCols.push(colIndex);
        value = "";
      } else {
        const vMatch = /<(?:\w+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?v>/.exec(cellInner);
        if (vMatch) {
          const rawV = decodeXmlEntities(vMatch[1]).trim();
          value = rawV;

          if ((cellType === "" || cellType === "n") && styleIdx >= 0) {
            const numFmtId = styles.cellXfNumFmtIds[styleIdx] ?? 0;
            const formatCode = styles.customNumFmts.get(numFmtId);
            if (isDateFormatCode(numFmtId, formatCode) && /^\d+(?:\.\d+)?$/.test(rawV)) {
              const formattedDate = excelSerialToPtBrDateString(Number(rawV), date1904, colIndex === 17);
              if (formattedDate) {
                value = formattedDate;
              }
            } else if (formatCode) {
              value = applyExplicitZeroPadFormatCode(rawV, formatCode);
            }
          }
        } else {
          if (hasFormulaTag) {
            uncomputedFormulaCols.push(colIndex);
          }
          value = extractTextFromTNodes(cellInner);
        }
      }

      cells[colIndex] = value;
    }

    rows.push({ rowNumber, cells, formulaCols, uncomputedFormulaCols });
  }

  return rows;
}

function resolveWorkbookMetaAndSheets(files: Map<string, Buffer>): {
  sheetPaths: Map<string, string>;
  date1904: boolean;
} {
  const workbookXml = files.get("xl/workbook.xml")?.toString("utf8");
  if (!workbookXml) {
    throw new Error("Arquivo .xlsx inválido: xl/workbook.xml ausente.");
  }
  assertNoXmlDoctypeOrEntities(workbookXml, "xl/workbook.xml");

  const wbPrMatch = /<(?:\w+:)?workbookPr\b([^>]*)\/?>/.exec(workbookXml);
  const date1904Attr = wbPrMatch ? /\bdate1904="([^"]+)"/.exec(wbPrMatch[1])?.[1] : undefined;
  const date1904 = date1904Attr === "1" || date1904Attr?.toLowerCase() === "true";

  const relsXml = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  assertNoXmlDoctypeOrEntities(relsXml, "xl/_rels/workbook.xml.rels");

  const ridToTarget = new Map<string, string>();
  const relRegex = /<(?:\w+:)?Relationship\b([^>]*)\/?>/g;
  let relMatch: RegExpExecArray | null;
  while ((relMatch = relRegex.exec(relsXml)) !== null) {
    const attrs = relMatch[1];
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
    if (id && target) {
      const normalizedTarget = target.startsWith("/")
        ? target.slice(1)
        : target.startsWith("xl/")
          ? target
          : `xl/${target.replace(/^\.\//, "")}`;
      ridToTarget.set(id, normalizedTarget);
    }
  }

  const sheetPaths = new Map<string, string>();
  const sheetRegex = /<(?:\w+:)?sheet\b([^>]*)\/?>/g;
  let sheetMatch: RegExpExecArray | null;
  let fallbackIndex = 1;
  while ((sheetMatch = sheetRegex.exec(workbookXml)) !== null) {
    const attrs = sheetMatch[1];
    const name = decodeXmlEntities(/\bname="([^"]+)"/.exec(attrs)?.[1] ?? "");
    const rid = /\br:id="([^"]+)"/.exec(attrs)?.[1];
    const target = (rid && ridToTarget.get(rid)) || `xl/worksheets/sheet${fallbackIndex}.xml`;
    if (name) {
      sheetPaths.set(name.trim(), target);
    }
    fallbackIndex++;
  }
  return { sheetPaths, date1904 };
}

function normalizeHeaderForComparison(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

/** Frases longas (termos de compromisso) mudam de redação a cada ano: basta o início coincidir. */
const LONG_HEADER_PREFIX = 44;

export function headersMatch(actualRaw: string, expectedRaw: string): boolean {
  const actual = normalizeHeaderForComparison(actualRaw);
  const expected = normalizeHeaderForComparison(expectedRaw);
  if (actual === expected) return true;
  return expected.length > 80 && actual.length > 80 && actual.slice(0, LONG_HEADER_PREFIX) === expected.slice(0, LONG_HEADER_PREFIX);
}

function isRowCompletelyEmpty(
  cells: readonly string[],
  uncomputedFormulaCols: readonly number[]
): boolean {
  return uncomputedFormulaCols.length === 0 && cells.every((c) => !c || c.trim() === "");
}

function normalizeRoleCategory(
  rawRole: string,
  fallbackSheet: RegistrationSheetName
): { role: RegistrationRoleCategory; valid: boolean } {
  const cleaned = rawRole.trim().toLocaleLowerCase("pt-BR");
  if (cleaned === "participante") {
    return { role: "Participante", valid: true };
  }
  if (cleaned === "consultor" || cleaned === "consultora") {
    return { role: "Consultor", valid: true };
  }
  if (!cleaned && (fallbackSheet === "Participante" || fallbackSheet === "Consultor")) {
    return { role: fallbackSheet, valid: true };
  }
  return {
    role: fallbackSheet === "Consultor" ? "Consultor" : "Participante",
    valid: false,
  };
}

function buildRecordFromRow(
  sheetName: RegistrationSheetName,
  row: ParsedWorksheetRow,
  date1904: boolean,
  nowIso: string
): RegistrationRecord {
  const { rowNumber, cells, formulaCols, uncomputedFormulaCols } = row;
  const rawColumns = {} as RegistrationRawColumns;
  const issues: RegistrationValidationIssue[] = [];

  for (const colIdx of uncomputedFormulaCols) {
    const colDesc = REGISTRATION_EXCEL_COLUMNS[colIdx];
    const err: RegistrationValidationIssue = {
      severity: "warning",
      code: "FORMULA_CHARACTER_NEUTRALIZED",
      sheetName,
      rowNumber,
      columnKey: colDesc?.key,
      message: `Linha ${rowNumber} (${sheetName}), coluna "${colDesc?.headerLabel.trim() ?? colIdx}": fórmula Excel sem valor calculado ou com erro (#REF!/#VALUE!). Salve apenas valores literais.`,
    };
    issues.push(err);
  }

  for (const colIdx of formulaCols) {
    if (uncomputedFormulaCols.includes(colIdx)) continue;
    const colDesc = REGISTRATION_EXCEL_COLUMNS[colIdx];
    issues.push({
      severity: "warning",
      code: "FORMULA_CHARACTER_NEUTRALIZED",
      sheetName,
      rowNumber,
      columnKey: colDesc?.key,
      message: `Célula "${colDesc?.headerLabel.trim() ?? colIdx}" contém fórmula Excel (<f>); apenas o valor cacheado literal foi lido sem execução da fórmula.`,
    });
  }

  for (const col of REGISTRATION_EXCEL_COLUMNS) {
    let val = (cells[col.index] ?? "").replace(/\r\n/g, "\n").trim();
    if (col.key === "birthDate" && date1904 && /^\d{4,5}(?:\.0+)?$/.test(val)) {
      const converted = excelSerialToPtBrDateString(Number(val), true);
      if (converted) val = converted;
    }
    rawColumns[col.key] = val;
    if (hasFormulaTriggerPrefix(val)) {
      issues.push({
        severity: "warning",
        code: "FORMULA_CHARACTER_NEUTRALIZED",
        sheetName,
        rowNumber,
        columnKey: col.key,
        message: `O campo "${col.headerLabel.trim()}" inicia com caractere de fórmula e foi neutralizado como texto puro.`,
      });
    }
  }

  const firstNameRaw = rawColumns.firstName;
  const lastNameRaw = rawColumns.lastName;
  const preferredNameRaw = rawColumns.preferredName || null;
  const fullNameRaw = [firstNameRaw, lastNameRaw].filter(Boolean).join(" ").trim();

  if (!firstNameRaw || !lastNameRaw) {
    const err: RegistrationValidationIssue = {
      severity: "warning",
      code: "MISSING_REQUIRED_FIELD",
      sheetName,
      rowNumber,
      columnKey: !firstNameRaw ? "firstName" : "lastName",
      message: `Linha ${rowNumber} (${sheetName}): ${!firstNameRaw ? "Nome" : "Sobrenome"} ausente; confira antes de gerar a autorização.`,
    };
    issues.push(err);
  }

  const firstNameNormalized = normalizePtBrPersonName(firstNameRaw);
  const lastNameNormalized = normalizePtBrPersonName(lastNameRaw);
  const preferredNameNormalized = preferredNameRaw
    ? normalizePtBrPersonName(preferredNameRaw)
    : null;
  const fullNameNormalized = [firstNameNormalized, lastNameNormalized]
    .filter(Boolean)
    .join(" ")
    .trim();

  const guardianNameRaw = rawColumns.guardianName || null;
  const guardianNameNormalized = guardianNameRaw
    ? normalizePtBrPersonName(guardianNameRaw)
    : null;
  const contact1NameRaw = rawColumns.contact1Name || null;
  const contact1NameNormalized = contact1NameRaw
    ? normalizePtBrPersonName(contact1NameRaw)
    : null;
  const contact2NameRaw = rawColumns.contact2Name || null;
  const contact2NameNormalized = contact2NameRaw
    ? normalizePtBrPersonName(contact2NameRaw)
    : null;
  const bishopNameRaw = rawColumns.bishopName || null;
  const bishopNameNormalized = bishopNameRaw ? normalizePtBrPersonName(bishopNameRaw) : null;

  const wasNameNormalized =
    firstNameRaw !== firstNameNormalized ||
    lastNameRaw !== lastNameNormalized ||
    (preferredNameRaw ?? "") !== (preferredNameNormalized ?? "") ||
    (guardianNameRaw ?? "") !== (guardianNameNormalized ?? "");

  const roleCheck = normalizeRoleCategory(rawColumns.roleCategory, sheetName);
  if (!roleCheck.valid) {
    const err: RegistrationValidationIssue = {
      severity: "warning",
      code: "INVALID_ROLE_CATEGORY",
      sheetName,
      rowNumber,
      columnKey: "roleCategory",
      message: `Linha ${rowNumber} (${sheetName}): Tipo "${rawColumns.roleCategory}" não reconhecido; considerado ${roleCheck.role}. Confira o cadastro.`,
    };
    issues.push(err);
  }

  const birthParsed = parseRegistrationBirthDate(rawColumns.birthDate);
  if (!birthParsed.valid) {
    issues.push({
      severity: "warning",
      code: "UNPARSABLE_BIRTH_DATE",
      sheetName,
      rowNumber,
      columnKey: "birthDate",
      message: `Data de nascimento "${rawColumns.birthDate || "(vazia)"}" ausente ou em formato não reconhecido.`,
    });
  }

  const ageNumeric = /^\d+$/.test(rawColumns.age) ? parseInt(rawColumns.age, 10) : null;

  const cpfInspection = inspectCpfField(rawColumns.cpf);
  let hasDocumentWarning = false;
  if (cpfInspection.warningMessage) {
    hasDocumentWarning = true;
    issues.push({
      severity: "warning",
      code: "TRUNCATED_OR_INVALID_CPF",
      sheetName,
      rowNumber,
      columnKey: "cpf",
      message: cpfInspection.warningMessage,
    });
  }

  const rgInspection = inspectRgOrPassportField(rawColumns.documentRgOrPassport);
  if (rgInspection.warningMessage) {
    hasDocumentWarning = true;
    issues.push({
      severity: "warning",
      code: "SUSPICIOUS_DOCUMENT_NUMBER",
      sheetName,
      rowNumber,
      columnKey: "documentRgOrPassport",
      message: rgInspection.warningMessage,
    });
  }

  const isMinorOrParticipant =
    roleCheck.role === "Participante" || (ageNumeric !== null && ageNumeric < 18);
  const guardianPhoneRaw = rawColumns.guardianPhone || null;
  const hasMissingGuardianForMinor =
    isMinorOrParticipant && (!guardianNameRaw || !guardianPhoneRaw);

  if (hasMissingGuardianForMinor) {
    issues.push({
      severity: "warning",
      code: "MISSING_GUARDIAN_FOR_MINOR",
      sheetName,
      rowNumber,
      columnKey: !guardianNameRaw ? "guardianName" : "guardianPhone",
      message:
        "Nome ou Telefone do Responsável (colunas AA/AB) ausente para participante menor; os campos do Responsável 1 ficarão em branco na Ficha de Autorização (Contatos 1/2 nunca substituem o responsável legal).",
    });
  }

  const hasHealthAlert =
    isPositiveHealthText(rawColumns.medicalInfo) ||
    isPositiveHealthText(rawColumns.dietaryInfo) ||
    isPositiveHealthText(rawColumns.healthConditionsSummary) ||
    isPositiveHealthText(rawColumns.healthConditionsDetails);

  const dedupKey = computeRegistrationDedupKey({
    cpfDigitsOnly: cpfInspection.digitsOnly,
    isValidElevenDigitsCpf: cpfInspection.isValidElevenDigits,
    rgOrPassportRaw: rgInspection.raw,
    email: rawColumns.email || null,
    birthDateIso: birthParsed.iso,
    birthDateRaw: birthParsed.raw,
    fullNameNormalized: fullNameNormalized || fullNameRaw,
    roleCategory: roleCheck.role,
  });

  const record: RegistrationRecord = {
    id: randomUUID(),
    batchId: null,
    dedupKey,
    sourceSheets: [sheetName],
    sourceRowNumbers: { [sheetName]: rowNumber },
    roleCategory: roleCheck.role,
    status: rawColumns.status || "Confirmado",
    registrationDateRaw: rawColumns.registrationDate || null,
    birthDateRaw: birthParsed.raw,
    birthDateIso: birthParsed.iso,
    ageAtRegistration: ageNumeric,
    sex: rawColumns.sex || null,
    phoneRaw: rawColumns.phone || null,
    email: rawColumns.email || null,
    tshirtSize: rawColumns.tshirtSize || null,
    stakeName: rawColumns.stakeName || null,
    wardName: rawColumns.wardName || null,
    bishopNameRaw,
    bishopNameNormalized,
    bishopEmail: rawColumns.bishopEmail || null,
    documentRgOrPassportRaw: rgInspection.raw,
    issuingAgencyRaw: rawColumns.issuingAgency || null,
    cpfRaw: cpfInspection.raw,
    cpfDigitsOnly: cpfInspection.digitsOnly,
    guardianNameRaw,
    guardianNameNormalized,
    guardianPhoneRaw,
    parentAuthorizationAckRaw: rawColumns.parentAuthorizationAck || null,
    contact1NameRaw,
    contact1NameNormalized,
    contact1Email: rawColumns.contact1Email || null,
    contact1PhoneRaw: rawColumns.contact1Phone || null,
    contact2NameRaw,
    contact2NameNormalized,
    contact2Email: rawColumns.contact2Email || null,
    contact2PhoneRaw: rawColumns.contact2Phone || null,
    isChurchMemberRaw: rawColumns.isChurchMember || null,
    talentShowPresentationRaw: rawColumns.talentShowPresentation || null,
    medicalInfoRaw: rawColumns.medicalInfo || null,
    dietaryInfoRaw: rawColumns.dietaryInfo || null,
    healthConditionsSummaryRaw: rawColumns.healthConditionsSummary || null,
    healthConditionsDetailsRaw: rawColumns.healthConditionsDetails || null,
    firstNameRaw,
    lastNameRaw,
    preferredNameRaw,
    fullNameRaw,
    firstNameNormalized,
    lastNameNormalized,
    preferredNameNormalized,
    fullNameNormalized,
    wasNameNormalized,
    hasHealthAlert,
    hasMissingGuardianForMinor,
    hasDocumentWarning,
    issues,
    rawColumns,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  return record;
}

/** Situações oficiais comparadas sem depender de acentos ou caixa. */
export function isApprovedRegistrationStatus(status: string): boolean {
  return normalizeHeaderForComparison(status) === "aprovado";
}

export function isCancelledRegistrationStatus(status: string): boolean {
  return normalizeHeaderForComparison(status) === "cancelado";
}

function registrationDateTimestamp(raw: string | null): number {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec((raw ?? "").trim());
  if (!match) return Number.NEGATIVE_INFINITY;
  const [, day, month, year, hour = "0", minute = "0", second = "0"] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    return Number.NEGATIVE_INFINITY;
  }
  return date.getTime();
}

function formatRegistrationDay(raw: string | null): string {
  const timestamp = registrationDateTimestamp(raw);
  if (!Number.isFinite(timestamp)) return "data n?o informada";
  const date = new Date(timestamp);
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface ParsedWorkbookPreviewResult {
  summary: RegistrationPreviewSummary;
  canonicalRows: RegistrationRecord[];
}

export function parseRegistrationsWorkbook(params: {
  fileBuffer: Buffer | Uint8Array;
  filename: string;
  createdByUserId: string;
  baseRevision: number;
  existingRecords?: readonly RegistrationRecord[];
  previewId?: string;
  now?: Date;
}): ParsedWorkbookPreviewResult {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const previewId = params.previewId ?? randomUUID();
  const buf = Buffer.isBuffer(params.fileBuffer)
    ? params.fileBuffer
    : Buffer.from(params.fileBuffer);
  const fileSha256 = createHash("sha256").update(buf).digest("hex");

  const files = readZipArchive(buf);
  const { sheetPaths, date1904 } = resolveWorkbookMetaAndSheets(files);
  const sharedStrings = parseSharedStrings(
    files.get("xl/sharedStrings.xml")?.toString("utf8")
  );
  const styles = parseStylesXml(files.get("xl/styles.xml")?.toString("utf8"));

  const workbookIssues: RegistrationValidationIssue[] = [];
  const sheetSummaries: RegistrationSheetSummary[] = [];
  const candidatesByKey = new Map<string, RegistrationRecord[]>();

  for (const sheetName of EXPECTED_SHEETS) {
    const targetPath = sheetPaths.get(sheetName);
    const sheetBuf = targetPath ? files.get(targetPath) : undefined;

    if (!sheetBuf) {
      sheetSummaries.push({
        sheetName,
        present: false,
        totalRows: 0,
        headerMatched: false,
      });
      workbookIssues.push({
        severity: "error",
        code: "MISSING_SHEET",
        sheetName,
        rowNumber: null,
        message: `Aba obrigatória "${sheetName}" não foi encontrada na planilha.`,
      });
      continue;
    }

    const parsedRows = parseWorksheetXml(
      sheetBuf.toString("utf8"),
      sharedStrings,
      styles,
      date1904,
      sheetName
    );
    if (parsedRows.length === 0) {
      sheetSummaries.push({
        sheetName,
        present: true,
        totalRows: 0,
        headerMatched: false,
      });
      workbookIssues.push({
        severity: "error",
        code: "HEADER_MISMATCH",
        sheetName,
        rowNumber: 1,
        message: `Aba "${sheetName}" está vazia e não possui a linha de cabeçalho A1..AH1.`,
      });
      continue;
    }

    const headerRow = parsedRows[0];
    let headerMatched = true;
    for (const col of REGISTRATION_EXCEL_COLUMNS) {
      if (!headersMatch(headerRow.cells[col.index] ?? "", col.headerLabel)) {
        headerMatched = false;
        workbookIssues.push({
          severity: "error",
          code: "HEADER_MISMATCH",
          sheetName,
          rowNumber: headerRow.rowNumber,
          columnKey: col.key,
          message: `Cabeçalho incompatível na aba "${sheetName}" coluna ${col.columnLetter}1: encontrado "${headerRow.cells[col.index] ?? ""}", esperado "${col.headerLabel.trim()}".`,
        });
      }
    }

    let dataRowCount = 0;
    for (let i = 1; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      if (isRowCompletelyEmpty(row.cells, row.uncomputedFormulaCols)) continue;
      dataRowCount++;

      if (!headerMatched) continue;

      const record = buildRecordFromRow(sheetName, row, date1904, nowIso);
      const candidates = candidatesByKey.get(record.dedupKey) ?? [];
      candidates.push(record);
      candidatesByKey.set(record.dedupKey, candidates);
    }

    sheetSummaries.push({
      sheetName,
      present: true,
      totalRows: dataRowCount,
      headerMatched,
    });
  }

  const canonicalRows: RegistrationRecord[] = [];
  for (const candidates of candidatesByKey.values()) {
    // Todas replica as abas por tipo; una cópias idênticas antes de escolher a versão.
    const versions: RegistrationRecord[] = [];
    for (const candidate of candidates) {
      const identical = versions.find((version) =>
        findConflictingColumnsBetweenRows(version.rawColumns, candidate.rawColumns).length === 0 &&
        !version.sourceSheets.some((sheet) => candidate.sourceSheets.includes(sheet))
      );
      if (identical) {
        identical.sourceSheets.push(...candidate.sourceSheets);
        Object.assign(identical.sourceRowNumbers, candidate.sourceRowNumbers);
      } else {
        versions.push(candidate);
      }
    }
    const winner = versions.reduce((best, candidate) => {
      const bestApproved = isApprovedRegistrationStatus(best.status);
      const candidateApproved = isApprovedRegistrationStatus(candidate.status);
      if (bestApproved !== candidateApproved) return candidateApproved ? candidate : best;
      return registrationDateTimestamp(candidate.registrationDateRaw) > registrationDateTimestamp(best.registrationDateRaw)
        ? candidate : best;
    });
    for (const discarded of versions) {
      if (discarded === winner) continue;
      const differingColumns = findConflictingColumnsBetweenRows(winner.rawColumns, discarded.rawColumns);
      const labels = REGISTRATION_EXCEL_COLUMNS.filter((column) => differingColumns.includes(column.key))
        .map((column) => column.headerLabel.trim());
      const sheetName = discarded.sourceSheets[0];
      const keptDate = formatRegistrationDay(winner.registrationDateRaw);
      winner.issues.push({
        severity: "warning",
        code: "CONFLICTING_DUPLICATE_KEY",
        sheetName,
        rowNumber: discarded.sourceRowNumbers[sheetName] ?? null,
        message: `Inscrição duplicada: mantida a de ${keptDate}${labels.length ? `. Campos diferentes: ${labels.join(", ")}` : ". Dados iguais"}.`,
      });
    }
    for (const candidate of candidates) {
      for (const sheet of candidate.sourceSheets) {
        if (!winner.sourceSheets.includes(sheet)) winner.sourceSheets.push(sheet);
        winner.sourceRowNumbers[sheet] ??= candidate.sourceRowNumbers[sheet];
      }
    }
    canonicalRows.push(winner);
  }
  canonicalRows.sort((a, b) => a.fullNameNormalized.localeCompare(b.fullNameNormalized, "pt-BR"));

  if (canonicalRows.length === 0) {
    workbookIssues.push({
      severity: "error",
      code: "EMPTY_WORKBOOK",
      sheetName: "Workbook",
      rowNumber: null,
      message:
        "A planilha não contém nenhum inscrito válido. Planilhas vazias são recusadas para nunca sobrescrever lotes existentes.",
    });
  }

  const existingByKey = new Map<string, RegistrationRecord>();
  for (const prev of params.existingRecords ?? []) {
    existingByKey.set(prev.dedupKey, prev);
  }
  let insertCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;
  const incomingKeys = new Set<string>();

  for (const row of canonicalRows) {
    incomingKeys.add(row.dedupKey);
    const prev = existingByKey.get(row.dedupKey);
    if (!prev) {
      insertCount++;
    } else {
      row.id = prev.id;
      const diffs = findConflictingColumnsBetweenRows(prev.rawColumns, row.rawColumns);
      if (diffs.length > 0) {
        updateCount++;
      } else {
        unchangedCount++;
      }
    }
  }

  let deleteCountOnReplaceAll = 0;
  const unmatchedExisting: RegistrationRecord[] = [];
  for (const [prevKey, prevRec] of existingByKey.entries()) {
    if (!incomingKeys.has(prevKey)) {
      deleteCountOnReplaceAll++;
      unmatchedExisting.push(prevRec);
    }
  }

  // M4: Detecta prováveis duplicados sem CPF válido (dentro da planilha ou contra registros existentes)
  // quando há mesmo nascimento com nome semelhante ou mesma pessoa mudando de Participante para Consultor.
  for (let i = 0; i < canonicalRows.length; i++) {
    const row = canonicalRows[i];
    const rowSheet = row.sourceSheets[0] ?? "Todas";
    const rowNum = row.sourceRowNumbers[rowSheet] ?? null;

    for (let j = i + 1; j < canonicalRows.length; j++) {
      const other = canonicalRows[j];
      if (row.dedupKey === other.dedupKey) continue;
      const sameDob =
        Boolean(row.birthDateIso && other.birthDateIso && row.birthDateIso === other.birthDateIso) ||
        Boolean(row.birthDateRaw && other.birthDateRaw && row.birthDateRaw === other.birthDateRaw);
      const sameEmail =
        Boolean(
          row.email &&
            other.email &&
            row.email.trim().toLowerCase() === other.email.trim().toLowerCase()
        );
      const similarName = areNamesProbablySamePerson(
        row.fullNameNormalized,
        other.fullNameNormalized
      );

      if ((sameDob && similarName) || (similarName && row.roleCategory !== other.roleCategory) || (sameEmail && similarName)) {
        row.issues.push({
          severity: "warning",
          code: "PROBABLE_DUPLICATE_PERSON",
          sheetName: rowSheet,
          rowNumber: rowNum,
          message: `Possível duplicata na própria planilha: "${row.fullNameNormalized}" (${row.roleCategory}) assemelha-se a "${other.fullNameNormalized}" (${other.roleCategory}) com chave de deduplicação distinta.`,
        });
      }
    }

    if (!existingByKey.has(row.dedupKey)) {
      for (const oldRec of unmatchedExisting) {
        const sameDob =
          Boolean(
            row.birthDateIso && oldRec.birthDateIso && row.birthDateIso === oldRec.birthDateIso
          ) ||
          Boolean(
            row.birthDateRaw && oldRec.birthDateRaw && row.birthDateRaw === oldRec.birthDateRaw
          );
        const similarName = areNamesProbablySamePerson(
          row.fullNameNormalized,
          oldRec.fullNameNormalized
        );
        if (sameDob && similarName) {
          row.issues.push({
            severity: "warning",
            code: "PROBABLE_DUPLICATE_PERSON",
            sheetName: rowSheet,
            rowNumber: rowNum,
            message: `Possível duplicata em relação ao cadastro existente: "${row.fullNameNormalized}" (${row.roleCategory}) pode ser a mesma pessoa que "${oldRec.fullNameNormalized}" (${oldRec.roleCategory}). No modo "Adicionar e atualizar", a entrada anterior permaneceria ativa.`,
          });
        }
      }
    }
  }

  const allIssues: RegistrationValidationIssue[] = [...workbookIssues];
  for (const row of canonicalRows) {
    for (const issue of row.issues) {
      if (issue.severity === "warning") {
        allIssues.push(issue);
      }
    }
  }

  const blockingErrorCount = allIssues.filter((i) => i.severity === "error").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;
  const participantCount = canonicalRows.filter((r) => r.roleCategory === "Participante" && !isCancelledRegistrationStatus(r.status)).length;
  const counselorCount = canonicalRows.filter((r) => r.roleCategory === "Consultor" && !isCancelledRegistrationStatus(r.status)).length;
  const normalizedNamesChangedCount = canonicalRows.filter((r) => r.wasNameNormalized).length;
  const healthAlertCount = canonicalRows.filter((r) => r.hasHealthAlert).length;
  const missingGuardianMinorCount = canonicalRows.filter(
    (r) => r.hasMissingGuardianForMinor
  ).length;
  const documentWarningCount = canonicalRows.filter((r) => r.hasDocumentWarning).length;

  const diffSummary: RegistrationPreviewDiffSummary = {
    insertCount,
    updateCount,
    unchangedCount,
    deleteCountOnReplaceAll,
  };

  // M3: Lista completa de nomes alterados + sampleRows priorizando linhas com nome normalizado
  const nameChanges: RegistrationNameChangePreviewItem[] = canonicalRows
    .filter((r) => r.wasNameNormalized)
    .map((r) => ({
      id: r.id,
      dedupKey: r.dedupKey,
      fullNameRaw: r.fullNameRaw,
      fullNameNormalized: r.fullNameNormalized,
      guardianNameRaw: r.guardianNameRaw,
      guardianNameNormalized: r.guardianNameNormalized,
    }));

  const changedSample = canonicalRows.filter((r) => r.wasNameNormalized);
  const unchangedSample = canonicalRows.filter((r) => !r.wasNameNormalized);
  const sampleRows = [...changedSample, ...unchangedSample].slice(0, 100);

  const summary: RegistrationPreviewSummary = {
    previewId,
    createdByUserId: params.createdByUserId,
    baseRevision: params.baseRevision,
    filename: params.filename,
    fileSha256,
    fileSizeBytes: buf.length,
    canCommit: blockingErrorCount === 0 && canonicalRows.length > 0,
    blockingErrorCount,
    warningCount,
    totalCanonicalRows: canonicalRows.length,
    participantCount,
    counselorCount,
    normalizedNamesChangedCount,
    healthAlertCount,
    missingGuardianMinorCount,
    documentWarningCount,
    diffSummary,
    sheets: sheetSummaries,
    issues: allIssues,
    sampleRows,
    nameChanges,
    expiresAt,
  };

  return { summary, canonicalRows };
}
