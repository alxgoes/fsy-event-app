import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import {
  EVENT_CITY_UF,
  EVENT_SHORT_NAME,
  EVENT_VALIDITY_SHORT,
  EVENT_VENUE,
} from "@/lib/event/identity";
import {
  isPositiveHealthText,
  parseRegistrationBirthDate,
} from "@/lib/registrations/normalize";
import { applyAuthorizationAdjustments } from "@/lib/registrations/authorization-adjustments";
import { createZipArchive, type ZipWriteEntry } from "@/lib/registrations/zip-archive";
import {
  MAX_AUTHORIZATION_PDF_BATCH_SIZE,
  type AuthorizationPdfBatchManifestEntry,
  type AuthorizationPdfBatchProgressInfo,
  type AuthorizationPdfMedicalCheckboxes,
  type AuthorizationPdfMedicalText,
  type AuthorizationPdfPayload,
} from "@/types/authorizations";
import type { RegistrationRecord } from "@/types/registrations";

const TEMPLATE_RELATIVE_PATH = path.join(
  process.cwd(),
  "src",
  "assets",
  "ficha-autorizacao-template.pdf"
);

const EXPECTED_TEMPLATE_SIZE_BYTES = 276809;
const TEMPLATE_XREF_OFFSET = 276309;

let cachedTemplateBuffer: Buffer | null = null;

export function getBlankAuthorizationTemplateBuffer(): Buffer {
  if (cachedTemplateBuffer) {
    return cachedTemplateBuffer;
  }
  const buf = fs.readFileSync(TEMPLATE_RELATIVE_PATH);
  if (buf.length !== EXPECTED_TEMPLATE_SIZE_BYTES) {
    throw new Error(
      `Modelo FICHA AUTORIZACAO.pdf inesperado (${buf.length} bytes; esperado ${EXPECTED_TEMPLATE_SIZE_BYTES}).`
    );
  }
  cachedTemplateBuffer = buf;
  return buf;
}

const LEFT_BLANK_FIELDS: readonly string[] = [
  "Naturalidade",
  "Data de Expedição (RG)",
  "Outro Documento com Foto (CPF não é documento com foto)",
  "Data de Validade",
  "Endereço",
  "Cidade/UF do Participante",
  "Tipo Sanguíneo",
  "Foto 3x4",
  "Parentesco do Responsável 1 (Pai/Mãe/Tutor/Guardiã(o))",
  "Responsável 2 (Nome, Telefone e Parentesco)",
  "Identificação do Acompanhante",
  "Assinaturas e Data de Assinatura",
] as const;

export function slugifyFilenamePart(input: string): string {
  const ascii = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii.slice(0, 64) || "participante";
}

export function formatAuthorizationCpf(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 ? digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : value;
}

export function formatAuthorizationPhone(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  let digits = value.replace(/\D/g, "");
  let prefix = "";
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
    prefix = "+55 ";
  }
  if (digits.length === 11) return prefix + digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (digits.length === 10) return prefix + digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return value;
}

function parseSexCheckbox(rawSex: string | null | undefined): "M" | "F" | null {
  if (!rawSex) return null;
  const cleaned = rawSex.trim().toLocaleLowerCase("pt-BR").replace(/^sexo\s+/, "");
  if (cleaned === "m" || cleaned === "masculino" || cleaned === "masc") {
    return "M";
  }
  if (cleaned === "f" || cleaned === "feminino" || cleaned === "fem") {
    return "F";
  }
  return null;
}

/**
 * Marca checkboxes médicos EXCLUSIVAMENTE a partir de seleções positivas estruturadas em AG1 (ou J1 estruturado),
 * sem inferir de narrativas livres nem marcar valores negativos ("Não", "Nenhuma").
 */
export function extractStructuredMedicalCheckboxes(
  healthConditionsSummaryRaw: string | null | undefined,
  dietaryInfoRaw: string | null | undefined
): AuthorizationPdfMedicalCheckboxes {
  const result: AuthorizationPdfMedicalCheckboxes = {
    specialDiet: false,
    allergies: false,
    regularMedication: false,
    chronicDisease: false,
    otherProblems: false,
    recentSurgeryOrSeriousIllness: false,
    physicalLimitations: false,
  };

  const tokens: string[] = [];
  if (isPositiveHealthText(healthConditionsSummaryRaw)) {
    for (const part of (healthConditionsSummaryRaw ?? "").split(/[,;\n|/]+/)) {
      const t = part
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase("pt-BR")
        .replace(/[.!]+$/g, "");
      if (t && isPositiveHealthText(t)) {
        tokens.push(t);
      }
    }
  }

  if (isPositiveHealthText(dietaryInfoRaw)) {
    const d = (dietaryInfoRaw ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("pt-BR")
      .replace(/[.!]+$/g, "");
    if (
      d === "dieta especial" ||
      d === "restrição alimentar" ||
      d === "restricao alimentar" ||
      d === "alimentação especial" ||
      d === "alimentacao especial"
    ) {
      result.specialDiet = true;
    }
  }

  for (const token of tokens) {
    if (
      token === "dieta especial" ||
      token === "restrição alimentar" ||
      token === "restricao alimentar" ||
      token === "alimentação especial" ||
      token === "alimentacao especial"
    ) {
      result.specialDiet = true;
    } else if (
      token === "alergia" ||
      token === "alergias" ||
      token === "alergia alimentar" ||
      token === "alergia medicamentosa"
    ) {
      result.allergies = true;
    } else if (
      token === "medicação regular" ||
      token === "medicacao regular" ||
      token === "uso de medicação" ||
      token === "uso de medicacao" ||
      token === "uso contínuo de medicação" ||
      token === "uso continuo de medicacao" ||
      token === "medicamento contínuo" ||
      token === "medicamento continuo"
    ) {
      result.regularMedication = true;
    } else if (
      token === "doença crônica" ||
      token === "doenca cronica" ||
      token === "doenças crônicas" ||
      token === "doencas cronicas" ||
      token === "condição crônica" ||
      token === "condicao cronica"
    ) {
      result.chronicDisease = true;
    } else if (
      token === "outros problemas" ||
      token === "outros" ||
      token === "outras condições" ||
      token === "outras condicoes" ||
      token === "outra condição de saúde" ||
      token === "outra condicao de saude"
    ) {
      result.otherProblems = true;
    } else if (
      token === "cirurgia" ||
      token === "cirurgia recente" ||
      token === "cirurgia ou doença grave" ||
      token === "cirurgia ou doenca grave" ||
      token === "cirurgia ou doença grave nos últimos 12 meses" ||
      token === "cirurgia ou doenca grave nos ultimos 12 meses" ||
      token === "cirurgia nos últimos 12 meses" ||
      token === "cirurgia nos ultimos 12 meses"
    ) {
      result.recentSurgeryOrSeriousIllness = true;
    } else if (
      token === "problemas físicos" ||
      token === "problemas fisicos" ||
      token === "problemas físicos / limitações" ||
      token === "problemas fisicos / limitacoes" ||
      token === "problemas físicos ou limitações" ||
      token === "problemas fisicos ou limitacoes" ||
      token === "limitações físicas" ||
      token === "limitacoes fisicas" ||
      token === "mobilidade reduzida" ||
      token === "deficiência física" ||
      token === "deficiencia fisica"
    ) {
      result.physicalLimitations = true;
    }
  }

  return result;
}

const FONT_SIZE_CANDIDATES = [9, 8.5, 8, 7.5, 7, 6.5, 6] as const;

// Larguras AFM conservadoras de Helvetica/Helvetica-Bold; acentos usam a base.
const HELVETICA_WIDTHS = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,1015,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,334,280,334,584];

function estimateTextWidthPt(text: string, fontSizePt: number): number {
  let units = 0;
  for (const char of text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
    const code = char.charCodeAt(0);
    units += code >= 32 && code <= 126 ? HELVETICA_WIDTHS[code - 32] : 1000;
  }
  return units * fontSizePt / 1000;
}

function fitSingleLineText(
  text: string,
  maxWidthPt: number
): { fittedText: string; fontSizePt: number; overflowed: boolean; horizontalScale?: number } {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return { fittedText: "", fontSizePt: 9, overflowed: false };
  }
  for (const size of FONT_SIZE_CANDIDATES) {
    if (estimateTextWidthPt(clean, size) <= maxWidthPt) {
      return { fittedText: clean, fontSizePt: size, overflowed: false };
    }
  }
  // Mantém todos os caracteres, inclusive quando a fonte mínima exige escala.
  return {
    fittedText: clean,
    fontSizePt: 6,
    horizontalScale: Math.min(100, maxWidthPt / estimateTextWidthPt(clean, 6) * 100),
    overflowed: true,
  };
}

function splitIntoTwoLines(
  text: string,
  lineMaxWidthPt: number,
  fontSizePt: number
): { line1: string; line2: string; fits: boolean } {
  let maxCharsPerLine = 0;
  let lineWidth = 0;
  for (const char of text) {
    const charWidth = estimateTextWidthPt(char, fontSizePt);
    if (lineWidth + charWidth > lineMaxWidthPt) break;
    lineWidth += charWidth;
    maxCharsPerLine += char.length;
  }
  maxCharsPerLine = Math.max(1, maxCharsPerLine);
  if (text.length <= maxCharsPerLine) {
    return { line1: text, line2: "", fits: true };
  }

  // Quebra em espaço na linha 1
  let splitIdx = text.lastIndexOf(" ", maxCharsPerLine);
  if (splitIdx <= 0) {
    splitIdx = maxCharsPerLine;
  }
  const line1 = text.slice(0, splitIdx).trim();
  const remainder = text.slice(splitIdx).trim();

  if (estimateTextWidthPt(remainder, fontSizePt) <= lineMaxWidthPt) {
    return { line1, line2: remainder, fits: true };
  }
  return {
    line1,
    line2: remainder,
    fits: false,
  };
}

function buildMedicalLines(
  record: RegistrationRecord,
  lineMaxWidthPt = 520
): AuthorizationPdfMedicalText {
  const segments: string[] = [];
  if (isPositiveHealthText(record.dietaryInfoRaw)) {
    segments.push(`Alimentação: ${record.dietaryInfoRaw!.replace(/\s+/g, " ").trim()}`);
  }
  if (isPositiveHealthText(record.medicalInfoRaw)) {
    segments.push(`Saúde: ${record.medicalInfoRaw!.replace(/\s+/g, " ").trim()}`);
  }
  if (isPositiveHealthText(record.healthConditionsDetailsRaw)) {
    segments.push(`Detalhes: ${record.healthConditionsDetailsRaw!.replace(/\s+/g, " ").trim()}`);
  }

  const combined = segments.join(" | ").trim();
  if (!combined) {
    return {
      line1Text: "",
      line2Text: "",
      appliedFontSizePt: 8.5,
      exceededBoxCapacity: false,
    };
  }

  // O modelo oferece duas faixas estreitas entre o título e as opções médicas.
  for (const size of [7, 6.5, 6]) {
    const attempt = splitIntoTwoLines(combined, lineMaxWidthPt, size);
    if (attempt.fits) {
      return {
        line1Text: attempt.line1,
        line2Text: attempt.line2,
        appliedFontSizePt: size,
        exceededBoxCapacity: false,
      };
    }
  }

  const fallback = splitIntoTwoLines(combined, lineMaxWidthPt, 6);
  return {
    line1Text: fallback.line1,
    line2Text: fallback.line2,
    appliedFontSizePt: 6,
    exceededBoxCapacity: true,
  };
}

/**
 * Constrói o payload determinístico da Ficha de Autorização para um inscrito,
 * aplicando todas as regras de isolamento e segurança jurídica.
 */
export function buildAuthorizationPdfPayload(
  record: RegistrationRecord,
  options: { useNormalizedNames?: boolean } = {}
): AuthorizationPdfPayload {
  record = applyAuthorizationAdjustments(record);
  const useNormalizedNames = options.useNormalizedNames ?? true;
  const fullName = useNormalizedNames
    ? record.fullNameNormalized || record.fullNameRaw
    : record.fullNameRaw || record.fullNameNormalized;

  const guardian1FullName = useNormalizedNames
    ? record.guardianNameNormalized ?? record.guardianNameRaw ?? ""
    : record.guardianNameRaw ?? record.guardianNameNormalized ?? "";

  // EXCLUSIVAMENTE de AB1 (Telefone do Responsável) — jamais usa Contato 1 ou Contato 2
  const guardian1Phone = formatAuthorizationPhone(record.guardianPhoneRaw);

  const birthParsed = parseRegistrationBirthDate(record.birthDateRaw);
  const birthDateFormatted = birthParsed.formattedPtBr ?? "";

  const medicalCheckboxes = extractStructuredMedicalCheckboxes(
    record.healthConditionsSummaryRaw,
    record.dietaryInfoRaw
  );
  const medicalText = buildMedicalLines(record, 520);

  const overflowFields: string[] = [];
  const warnings: string[] = [];

  if (fitSingleLineText(fullName, 380).overflowed) {
    overflowFields.push("Nome Completo do Participante");
  }
  if (fitSingleLineText(guardian1FullName, 380).overflowed) {
    overflowFields.push("Nome Completo do Responsável 1");
  }
  if (fitSingleLineText(record.wardName ?? "", 186).overflowed) {
    overflowFields.push("Ala/Ramo");
  }
  if (fitSingleLineText(record.stakeName ?? "", 202).overflowed) {
    overflowFields.push("Estaca/Distrito");
  }
  if (medicalText.exceededBoxCapacity) {
    overflowFields.push("Informações Médicas e Alimentares");
  }

  if (overflowFields.length > 0) {
    warnings.push(
      `Texto muito extenso preservado com redução de escala na página única nos campos: ${overflowFields.join(", ")}. Confira a legibilidade antes de imprimir.`
    );
  }

  if (!guardian1FullName || !guardian1Phone) {
    warnings.push(
      "Responsável 1 incompleto na planilha (colunas AA/AB); campos deixados em branco para preenchimento manual (Contatos 1/2 não preenchem o responsável legal)."
    );
  }

  const suggestedFilename = `autorizacao-${slugifyFilenamePart(fullName)}.pdf`;

  return {
    registrationId: record.id,
    roleCategory: record.roleCategory,
    suggestedFilename,
    header: {
      activityName: EVENT_SHORT_NAME,
      validityPeriod: EVENT_VALIDITY_SHORT,
      venueName: EVENT_VENUE,
      destinationCityUf: EVENT_CITY_UF,
    },
    youth: {
      fullName,
      birthDateFormatted,
      rgOrPassport: (record.documentRgOrPassportRaw ?? "").trim(),
      issuingAgency: (record.issuingAgencyRaw ?? "").trim(),
      cpfFormatted: formatAuthorizationCpf(record.cpfRaw),
      bishopName: (useNormalizedNames ? record.bishopNameNormalized ?? record.bishopNameRaw : record.bishopNameRaw ?? record.bishopNameNormalized) ?? "",
      tshirtSize: record.tshirtSize ?? "",
      sexCheckbox: parseSexCheckbox(record.sex),
      phone: formatAuthorizationPhone(record.phoneRaw),
      wardName: (record.wardName ?? "").trim(),
      stakeName: (record.stakeName ?? "").trim(),
    },
    guardian: {
      guardian1FullName: guardian1FullName.trim(),
      guardian1Phone,
    },
    medicalCheckboxes,
    medicalText,
    leftBlankFields: LEFT_BLANK_FIELDS,
    hasOverflowWarning: overflowFields.length > 0,
    overflowFields,
    warnings,
  };
}

/**
 * Codifica uma string Unicode em string literal PDF usando WinAnsiEncoding (CP1252 / Latin-1),
 * suportando todos os caracteres acentuados do Português (`á`, `ã`, `ç`, `ê`, `—`, etc.).
 */
function encodePdfWinAnsiLiteral(text: string): string {
  const CP1252_EXTRA: Record<number, number> = {
    0x20ac: 0x80,
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a,
    0x2039: 0x8b,
    0x0152: 0x8c,
    0x017d: 0x8e,
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96, // en-dash
    0x2014: 0x97, // em-dash (—)
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
  };

  let out = "(";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x28 || code === 0x29 || code === 0x5c) {
      // Escapa parênteses e barra invertida
      out += `\\${String.fromCharCode(code)}`;
    } else if (code >= 0x20 && code <= 0x7e) {
      out += String.fromCharCode(code);
    } else if (code >= 0xa0 && code <= 0xff) {
      out += `\\${code.toString(8).padStart(3, "0")}`;
    } else if (CP1252_EXTRA[code] !== undefined) {
      out += `\\${CP1252_EXTRA[code].toString(8).padStart(3, "0")}`;
    } else {
      out += " ";
    }
  }
  out += ")";
  return out;
}

function pdfTextOp(
  text: string,
  x: number,
  y: number,
  maxWidthPt: number,
  fontRef: "/F1" | "/F2" = "/F1"
): string {
  const { fittedText, fontSizePt, horizontalScale = 100 } = fitSingleLineText(text, maxWidthPt);
  if (!fittedText) return "";
  return `BT ${fontRef} ${fontSizePt.toFixed(1)} Tf ${horizontalScale.toFixed(3)} Tz 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm ${encodePdfWinAnsiLiteral(fittedText)} Tj ET`;
}

function pdfMarkCheckboxOp(checked: boolean, x: number, y: number): string {
  if (!checked) return "";
  return `BT /F2 9.0 Tf 100 Tz 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (X) Tj ET`;
}

/**
 * Renderiza em memória o PDF de página única sobrepondo os campos confirmados no template
 * oficial `src/assets/ficha-autorizacao-template.pdf`.
 */
export function renderAuthorizationPdfBuffer(
  record: RegistrationRecord,
  options: { useNormalizedNames?: boolean } = {}
): { pdfBuffer: Buffer; payload: AuthorizationPdfPayload } {
  const template = getBlankAuthorizationTemplateBuffer();
  const payload = buildAuthorizationPdfPayload(record, options);

  const ops: string[] = [
    "q",
    "0.08 0.12 0.20 rg", // Azul-marinho escuro legível para impressão e leitura óptica
    // Faixa complementar; CPF do jovem não ocupa documento com foto nem CPF de terceiros.
    pdfTextOp(payload.youth.cpfFormatted ? `CPF do participante: ${payload.youth.cpfFormatted}` : "", 43, 686, 180),
    pdfTextOp(payload.youth.bishopName ? `Bispo: ${payload.youth.bishopName}` : "", 228, 686, 245),
    pdfTextOp(payload.youth.tshirtSize ? `Camiseta: ${payload.youth.tshirtSize}` : "", 480, 686, 86),
    // 1. Identificação do Local
    pdfTextOp(payload.header.activityName, 43, 665, 380, "/F2"),
    pdfTextOp(payload.header.validityPeriod, 429, 665, 138, "/F2"),
    pdfTextOp(payload.header.venueName, 43, 643, 380, "/F1"),
    pdfTextOp(payload.header.destinationCityUf, 429, 643, 138, "/F1"),
    // 2. Identificação do Jovem
    pdfTextOp(payload.youth.fullName, 43, 538, 380, "/F2"),
    pdfTextOp(payload.youth.birthDateFormatted, 429, 538, 138, "/F1"),
    pdfTextOp(payload.youth.rgOrPassport, 171, 516, 123, "/F1"),
    pdfTextOp(payload.youth.issuingAgency, 300, 516, 120, "/F1"),
    pdfMarkCheckboxOp(payload.youth.sexCheckbox === "M", 43.5, 492.5),
    pdfMarkCheckboxOp(payload.youth.sexCheckbox === "F", 112.0, 492.5),
    pdfTextOp(payload.youth.phone, 429, 495, 138, "/F1"),
    pdfTextOp(payload.youth.wardName, 171, 451, 186, "/F1"),
    pdfTextOp(payload.youth.stakeName, 364, 451, 202, "/F1"),
    // 3. Responsável 1 (exclusivamente AA1 / AB1)
    pdfTextOp(payload.guardian.guardian1FullName, 43, 414, 380, "/F2"),
    pdfTextOp(payload.guardian.guardian1Phone, 429, 414, 138, "/F1"),
    // 4. Informações Médicas (checkboxes estruturados + até 2 linhas com auto-fit dentro da caixa)
    pdfMarkCheckboxOp(payload.medicalCheckboxes.specialDiet, 40.5, 243.8),
    pdfMarkCheckboxOp(payload.medicalCheckboxes.allergies, 121.2, 243.8),
    pdfMarkCheckboxOp(payload.medicalCheckboxes.regularMedication, 178.5, 243.8),
    pdfMarkCheckboxOp(payload.medicalCheckboxes.chronicDisease, 275.5, 243.8),
    pdfMarkCheckboxOp(payload.medicalCheckboxes.otherProblems, 360.5, 243.8),
    pdfMarkCheckboxOp(payload.medicalCheckboxes.recentSurgeryOrSeriousIllness, 40.5, 223.6),
    pdfMarkCheckboxOp(payload.medicalCheckboxes.physicalLimitations, 282.5, 223.6),
  ];

  if (payload.medicalText.line1Text) {
    const sz = payload.medicalText.appliedFontSizePt.toFixed(1);
    ops.push(
      `BT /F1 ${sz} Tf 100 Tz 1 0 0 1 43.0 254.0 Tm ${encodePdfWinAnsiLiteral(payload.medicalText.line1Text)} Tj ET`
    );
  }
  if (payload.medicalText.line2Text) {
    const sz = Math.min(payload.medicalText.appliedFontSizePt, 7.0).toFixed(1);
    ops.push(
      `BT /F1 ${sz} Tf ${Math.min(100, 520 / estimateTextWidthPt(payload.medicalText.line2Text, Number(sz)) * 100).toFixed(3)} Tz 1 0 0 1 43.0 233.0 Tm ${encodePdfWinAnsiLiteral(payload.medicalText.line2Text)} Tj ET`
    );
  }
  ops.push("Q");

  const contentStreamStr = ops.filter(Boolean).join("\n") + "\n";
  const contentStreamBuf = Buffer.from(contentStreamStr, "latin1");

  // Preserva os primeiros 276.309 bytes do template original (todos os 16 objetos originais)
  // e grava os objetos atualizados (1, 4, 17, 18, 19) + tabela xref limpa de 20 entradas.
  const baseBody = template.subarray(0, TEMPLATE_XREF_OFFSET);
  const appendedChunks: Buffer[] = [baseBody];
  let currentOffset = baseBody.length;

  const offsets = new Map<number, number>([
    [1, 668],
    [2, 267632],
    [3, 22],
    [4, 772],
    [5, 267597],
    [6, 267765],
    [7, 274364],
    [8, 930],
    [9, 264885],
    [10, 267715],
    [11, 268420],
    [12, 268699],
    [13, 274867],
    [14, 274562],
    [15, 275145],
    [16, 275849],
  ]);

  const appendObject = (objNum: number, bodyStr: string | Buffer) => {
    offsets.set(objNum, currentOffset);
    const header = Buffer.from(`${objNum} 0 obj\n`, "latin1");
    const body = typeof bodyStr === "string" ? Buffer.from(bodyStr, "latin1") : bodyStr;
    const footer = Buffer.from("\nendobj\n", "latin1");
    appendedChunks.push(header, body, footer);
    currentOffset += header.length + body.length + footer.length;
  };

  // Obj 17: Helvetica (WinAnsiEncoding)
  appendObject(
    17,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  );
  // Obj 18: Helvetica-Bold (WinAnsiEncoding)
  appendObject(
    18,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
  );
  // Obj 19: Overlay Content Stream
  const streamHeader = Buffer.from(`<< /Length ${contentStreamBuf.length} >>\nstream\n`, "latin1");
  const streamFooter = Buffer.from("endstream", "latin1");
  appendObject(19, Buffer.concat([streamHeader, contentStreamBuf, streamFooter]));

  // Obj 4 (Resources atualizado com /F1 e /F2)
  appendObject(
    4,
    "<< /ProcSet [ /PDF /Text /ImageB /ImageC /ImageI ] /ColorSpace << /Cs1 5 0 R >> /Font << /TT1 6 0 R /TT2 7 0 R /F1 17 0 R /F2 18 0 R >> /XObject << /Im1 8 0 R >> >>"
  );

  // Obj 1 (Page 1 com /Contents [ 3 0 R 19 0 R ] — sempre página única)
  appendObject(
    1,
    "<< /Type /Page /Parent 2 0 R /Resources 4 0 R /Contents [ 3 0 R 19 0 R ] /MediaBox [0 0 595 842] >>"
  );

  const xrefOffset = currentOffset;
  const totalObjects = 20;
  const xrefLines: string[] = [`xref`, `0 ${totalObjects}`, `0000000000 65535 f `];
  for (let i = 1; i < totalObjects; i++) {
    const off = offsets.get(i) ?? 0;
    xrefLines.push(`${String(off).padStart(10, "0")} 00000 n `);
  }
  const trailerStr = [
    ...xrefLines,
    "trailer",
    `<< /Size ${totalObjects} /Root 10 0 R /Info 16 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
    "",
  ].join("\n");

  appendedChunks.push(Buffer.from(trailerStr, "latin1"));
  return {
    pdfBuffer: Buffer.concat(appendedChunks),
    payload,
  };
}

/**
 * Gera um pacote `.zip` em memória para até `MAX_AUTHORIZATION_PDF_BATCH_SIZE` (50) inscritos,
 * incluindo `manifesto-autorizacoes.json` com metadados de paginação e avisos de overflow.
 */
export function generateAuthorizationPdfBatchZip(params: {
  records: readonly RegistrationRecord[];
  useNormalizedNames?: boolean;
  partIndex?: number;
  partSize?: number;
  totalEligibleCount?: number;
}): {
  zipBuffer: Buffer;
  progress: AuthorizationPdfBatchProgressInfo;
  manifest: AuthorizationPdfBatchManifestEntry[];
} {
  const partSize = Math.min(
    MAX_AUTHORIZATION_PDF_BATCH_SIZE,
    Math.max(1, params.partSize ?? MAX_AUTHORIZATION_PDF_BATCH_SIZE)
  );
  if (params.records.length > MAX_AUTHORIZATION_PDF_BATCH_SIZE) {
    throw new Error(
      `O lote excede o limite máximo de ${MAX_AUTHORIZATION_PDF_BATCH_SIZE} PDFs por pacote ZIP.`
    );
  }

  const totalEligibleCount = params.totalEligibleCount ?? params.records.length;
  const totalParts = Math.max(1, Math.ceil(totalEligibleCount / partSize));
  const partIndex = Math.min(totalParts, Math.max(1, params.partIndex ?? 1));

  const zipEntries: ZipWriteEntry[] = [];
  const manifest: AuthorizationPdfBatchManifestEntry[] = [];
  const usedNames = new Set<string>();
  let overflowWarningCount = 0;

  for (let i = 0; i < params.records.length; i++) {
    const record = params.records[i];
    const { pdfBuffer, payload } = renderAuthorizationPdfBuffer(record, {
      useNormalizedNames: params.useNormalizedNames,
    });

    if (payload.hasOverflowWarning) {
      overflowWarningCount++;
    }

    let pdfFilename = payload.suggestedFilename;
    if (usedNames.has(pdfFilename)) {
      pdfFilename = `autorizacao-${slugifyFilenamePart(payload.youth.fullName)}-${record.id}.pdf`;
    }
    usedNames.add(pdfFilename);

    zipEntries.push({
      name: pdfFilename,
      data: pdfBuffer,
      compress: true,
    });

    manifest.push({
      registrationId: record.id,
      fullName: payload.youth.fullName,
      roleCategory: record.roleCategory,
      pdfFilename,
      hasOverflowWarning: payload.hasOverflowWarning,
      overflowFields: payload.overflowFields,
      warnings: payload.warnings,
    });
  }

  const progress: AuthorizationPdfBatchProgressInfo = {
    partIndex,
    partSize,
    totalParts,
    totalEligibleCount,
    generatedCount: manifest.length,
    overflowWarningCount,
  };

  zipEntries.push({
    name: "manifesto-autorizacoes.json",
    data: JSON.stringify(
      {
        eventName: EVENT_SHORT_NAME,
        generatedAtIso: new Date().toISOString(),
        progress,
        entries: manifest,
      },
      null,
      2
    ),
    compress: true,
  });

  return {
    zipBuffer: createZipArchive(zipEntries),
    progress,
    manifest,
  };
}
