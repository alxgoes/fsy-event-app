import { Buffer } from "node:buffer";
import {
  REGISTRATION_EXCEL_COLUMNS,
  type RegistrationRecord,
  type RegistrationSheetName,
} from "@/types/registrations";
import { neutralizeSpreadsheetFormula } from "./normalize";
import { createZipArchive } from "./zip-archive";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getColumnValueForExport(
  record: RegistrationRecord,
  key: (typeof REGISTRATION_EXCEL_COLUMNS)[number]["key"],
  useNormalizedNames: boolean
): string {
  if (useNormalizedNames) {
    switch (key) {
      case "firstName":
        return record.firstNameNormalized || record.firstNameRaw;
      case "lastName":
        return record.lastNameNormalized || record.lastNameRaw;
      case "preferredName":
        return record.preferredNameNormalized ?? record.preferredNameRaw ?? "";
      case "guardianName":
        return record.guardianNameNormalized ?? record.guardianNameRaw ?? "";
      case "contact1Name":
        return record.contact1NameNormalized ?? record.contact1NameRaw ?? "";
      case "contact2Name":
        return record.contact2NameNormalized ?? record.contact2NameRaw ?? "";
      case "bishopName":
        return record.bishopNameNormalized ?? record.bishopNameRaw ?? "";
      default:
        break;
    }
  }
  return record.rawColumns?.[key] ?? "";
}

function buildWorksheetXml(
  records: readonly RegistrationRecord[],
  useNormalizedNames: boolean
): string {
  const rowsXml: string[] = [];

  // Linha 1: Cabeçalhos oficiais A1..AH1
  const headerCells = REGISTRATION_EXCEL_COLUMNS.map((col) => {
    const ref = `${col.columnLetter}1`;
    const escaped = escapeXml(col.headerLabel);
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escaped}</t></is></c>`;
  }).join("");
  rowsXml.push(`<row r="1">${headerCells}</row>`);

  // Linhas 2..N: Dados com preservação de texto e prevenção de fórmulas
  for (let i = 0; i < records.length; i++) {
    const rowNumber = i + 2;
    const record = records[i];
    const cellsXml = REGISTRATION_EXCEL_COLUMNS.map((col) => {
      const ref = `${col.columnLetter}${rowNumber}`;
      const rawVal = getColumnValueForExport(record, col.key, useNormalizedNames);
      const safeVal = neutralizeSpreadsheetFormula(rawVal);

      // Apenas a coluna Idade (Q) é gravada como número se for inteiro puro e não forçada como texto
      if (!col.forceTextOnExport && col.key === "age" && /^\d+$/.test(safeVal)) {
        return `<c r="${ref}"><v>${safeVal}</v></c>`;
      }

      const escaped = escapeXml(safeVal);
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escaped}</t></is></c>`;
    }).join("");

    rowsXml.push(`<row r="${rowNumber}">${cellsXml}</row>`);
  }

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    "<sheetData>",
    ...rowsXml,
    "</sheetData>",
    "</worksheet>",
  ].join("");
}

/**
 * Gera em memória um arquivo `.xlsx` válido seguindo exatamente o modelo oficial de 3 abas
 * (`Consultor`, `Participante`, `Todas`) e 34 colunas (`A1..AH1`), com:
 * - Nomes revisados/normalizados em Title Case `pt-BR` (ou originais se `useNormalizedNames = false`)
 * - Documentos (`CPF`, `RG/CIN/Passaporte`), telefones e datas gravados como texto (`inlineStr`)
 * - Neutralização de fórmulas (`=`, `+`, `-`, `@`, `\t`, `\r`) e ausência total de tags `<f>`.
 */
export function exportRegistrationsWorkbookBuffer(
  records: readonly RegistrationRecord[],
  options: { useNormalizedNames?: boolean } = {}
): Buffer {
  const useNormalizedNames = options.useNormalizedNames ?? true;

  const counselors = records.filter((r) => r.roleCategory === "Consultor");
  const participants = records.filter((r) => r.roleCategory === "Participante");
  const allRecords = [...records];

  const sheets: { name: RegistrationSheetName; rows: readonly RegistrationRecord[] }[] = [
    { name: "Consultor", rows: counselors },
    { name: "Participante", rows: participants },
    { name: "Todas", rows: allRecords },
  ];

  const contentTypesXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
    '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
    '<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
    "</Types>",
  ].join("");

  const rootRelsXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
    "</Relationships>",
  ].join("");

  const workbookXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    "<sheets>",
    '<sheet name="Consultor" sheetId="1" r:id="rId1"/>',
    '<sheet name="Participante" sheetId="2" r:id="rId2"/>',
    '<sheet name="Todas" sheetId="3" r:id="rId3"/>',
    "</sheets>",
    "</workbook>",
  ].join("");

  const workbookRelsXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>',
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>',
    '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    "</Relationships>",
  ].join("");

  const stylesXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<fonts count="1"><font><sz val="10"/><name val="Calibri"/></font></fonts>',
    '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>',
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
    '<cellXfs count="1"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>',
    "</styleSheet>",
  ].join("");

  return createZipArchive([
    { name: "[Content_Types].xml", data: contentTypesXml },
    { name: "_rels/.rels", data: rootRelsXml },
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml },
    { name: "xl/styles.xml", data: stylesXml },
    {
      name: "xl/worksheets/sheet1.xml",
      data: buildWorksheetXml(sheets[0].rows, useNormalizedNames),
    },
    {
      name: "xl/worksheets/sheet2.xml",
      data: buildWorksheetXml(sheets[1].rows, useNormalizedNames),
    },
    {
      name: "xl/worksheets/sheet3.xml",
      data: buildWorksheetXml(sheets[2].rows, useNormalizedNames),
    },
  ]);
}
