const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const zlib = require("node:zlib");
const { test } = require("node:test");
const { loadRoute } = require("./helpers/route-harness.cjs");

function loadModules() {
  const regTypes = loadRoute("src/types/registrations.ts");
  const normalize = loadRoute("src/lib/registrations/normalize.ts");
  const parser = loadRoute("src/lib/registrations/xlsx-parser.ts");
  const exporter = loadRoute("src/lib/registrations/xlsx-exporter.ts");
  const zip = loadRoute("src/lib/registrations/zip-archive.ts");
  return { regTypes, normalize, parser, exporter, zip };
}

/**
 * Gera um arquivo .xlsx independente via Python (zipfile padrão do Python, sem usar o exporter do projeto),
 * permitindo injetar `date1904`, `styles.xml` customizados (`numFmtId`), `sharedStrings.xml`,
 * células com `<f>` (fórmulas), entidades XML inválidas ou entradas duplicadas.
 */
function buildIndependentXlsxViaPython(spec) {
  const pyScript = `
import sys, json, zipfile, io

spec = json.loads(sys.stdin.read())
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for entry in spec['entries']:
        zf.writestr(entry['name'], entry['content'].encode('utf-8'))
sys.stdout.buffer.write(buf.getvalue())
`;
  return execFileSync("python", ["-X", "utf8", "-c", pyScript], {
    input: JSON.stringify(spec),
    maxBuffer: 10 * 1024 * 1024,
  });
}

function buildHeaderCellsXml(columns) {
  return columns
    .map(
      (col) =>
        `<c r="${col.columnLetter}1" t="inlineStr"><is><t>${col.headerLabel
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</t></is></c>`
    )
    .join("");
}

function buildStandardOoxmlEntries({
  columns,
  date1904 = false,
  stylesXml,
  sharedStringsXml,
  consultorRowsXml = "",
  participanteRowsXml = "",
  todasRowsXml = "",
}) {
  const headerXml = `<row r="1">${buildHeaderCellsXml(columns)}</row>`;
  const defaultStyles =
    stylesXml ||
    `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="165" formatCode="00000000000"/>
    <numFmt numFmtId="166" formatCode="dd/mm/yyyy"/>
  </numFmts>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    <xf numFmtId="14" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;

  const entries = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr date1904="${date1904 ? "1" : "0"}"/>
  <sheets>
    <sheet name="Consultor" sheetId="1" r:id="rId1"/>
    <sheet name="Participante" sheetId="2" r:id="rId2"/>
    <sheet name="Todas" sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
</Relationships>`,
    },
    { name: "xl/styles.xml", content: defaultStyles },
    {
      name: "xl/worksheets/sheet1.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>${headerXml}${consultorRowsXml}</sheetData></worksheet>`,
    },
    {
      name: "xl/worksheets/sheet2.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>${headerXml}${participanteRowsXml}</sheetData></worksheet>`,
    },
    {
      name: "xl/worksheets/sheet3.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>${headerXml}${todasRowsXml}</sheetData></worksheet>`,
    },
  ];

  if (sharedStringsXml) {
    entries.push({ name: "xl/sharedStrings.xml", content: sharedStringsXml });
  }
  return entries;
}

test("planilha independente gerada via Python: suporta date1900, date1904, numFmt 00000000000, sharedStrings com rich-text e inlineStr", () => {
  const { regTypes, parser } = loadModules();
  const cols = regTypes.REGISTRATION_EXCEL_COLUMNS;

  const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
  <si><t>HELENA</t></si>
  <si><r><t>DOS </t></r><r><t>SANTOS</t></r></si>
  <si><t>Participante</t></si>
  <si><t>Confirmado</t></si>
</sst>`;

  // Linha 2:
  // A2 = sharedString[0] ("HELENA"), B2 = sharedString[1] ("DOS SANTOS")
  // D2 = serial 40215 (2010-02-06 em date1900) com style s="1" (numFmtId=14 data)
  // S2 = sharedString[3] ("Confirmado"), T2 = sharedString[2] ("Participante")
  // Y2 = inlineStr "12.345.678-9"
  // AA2 = inlineStr "MARIA DOS SANTOS", AB2 = inlineStr "16991112222"
  // AD2 = numérico 2314509835 com style s="2" (numFmtId=165 formatCode="00000000000" -> "02314509835")
  const row1900Xml = `<row r="2">
    <c r="A2" t="s"><v>0</v></c>
    <c r="B2" t="s"><v>1</v></c>
    <c r="D2" s="1"><v>40215</v></c>
    <c r="E2" t="inlineStr"><is><t>Feminino</t></is></c>
    <c r="Q2"><v>16</v></c>
    <c r="S2" t="s"><v>3</v></c>
    <c r="T2" t="s"><v>2</v></c>
    <c r="Y2" t="inlineStr"><is><t>12.345.678-9</t></is></c>
    <c r="AA2" t="inlineStr"><is><t>MARIA DOS SANTOS</t></is></c>
    <c r="AB2" t="inlineStr"><is><t>16991112222</t></is></c>
    <c r="AD2" s="2"><v>2314509820</v></c>
  </row>`;

  const xlsx1900 = buildIndependentXlsxViaPython({
    entries: buildStandardOoxmlEntries({
      columns: cols,
      date1904: false,
      sharedStringsXml,
      participanteRowsXml: row1900Xml,
      todasRowsXml: row1900Xml,
    }),
  });

  const parsed1900 = parser.parseRegistrationsWorkbook({
    fileBuffer: xlsx1900,
    filename: "independente-1900.xlsx",
    createdByUserId: "33333333-3333-4333-8333-333333333333",
    baseRevision: 0,
  });

  assert.equal(parsed1900.summary.canCommit, true);
  assert.equal(parsed1900.canonicalRows.length, 1);
  const helena = parsed1900.canonicalRows[0];
  assert.equal(helena.fullNameNormalized, "Helena dos Santos");
  assert.equal(helena.birthDateIso, "2010-02-06");
  assert.equal(helena.birthDateRaw, "06/02/2010");
  assert.equal(
    helena.cpfRaw,
    "02314509820",
    "numFmt explícito 00000000000 em styles.xml restaura o zero à esquerda formatado pelo Excel"
  );
  assert.equal(helena.hasDocumentWarning, false);

  // Agora testa date1904="1" (serial 38753 em date1904 equivale a 40215 em date1900 = 06/02/2010)
  // e CPF numérico SEM formatCode de zeros (s="0", numFmtId=0) -> NÃO deve inventar zero à esquerda!
  const row1904Xml = `<row r="2">
    <c r="A2" t="s"><v>0</v></c>
    <c r="B2" t="s"><v>1</v></c>
    <c r="D2" s="3"><v>38753</v></c>
    <c r="S2" t="s"><v>3</v></c>
    <c r="T2" t="s"><v>2</v></c>
    <c r="Y2" t="inlineStr"><is><t>12.345.678-9</t></is></c>
    <c r="AA2" t="inlineStr"><is><t>MARIA DOS SANTOS</t></is></c>
    <c r="AB2" t="inlineStr"><is><t>16991112222</t></is></c>
    <c r="AD2" s="0"><v>2314509820</v></c>
  </row>`;

  const xlsx1904 = buildIndependentXlsxViaPython({
    entries: buildStandardOoxmlEntries({
      columns: cols,
      date1904: true,
      sharedStringsXml,
      participanteRowsXml: row1904Xml,
      todasRowsXml: row1904Xml,
    }),
  });

  const parsed1904 = parser.parseRegistrationsWorkbook({
    fileBuffer: xlsx1904,
    filename: "independente-1904.xlsx",
    createdByUserId: "33333333-3333-4333-8333-333333333333",
    baseRevision: 0,
  });

  const helena1904 = parsed1904.canonicalRows[0];
  assert.equal(helena1904.birthDateIso, "2010-02-06", "date1904 convertido corretamente");
  assert.equal(
    helena1904.cpfDigitsOnly,
    "2314509820",
    "sem formatCode 000..., jamais inventa zero à esquerda"
  );
  assert.equal(helena1904.hasDocumentWarning, true);
  assert.ok(helena1904.issues.some((i) => i.code === "TRUNCATED_OR_INVALID_CPF"));
});

test("rejeita Tipo desconhecido, fórmulas sem valor calculado (<f> sem <v>), entidades XML inválidas/DOCTYPE, ZIP duplicado, zip-bomb e ZIP truncado", () => {
  const { regTypes, parser, zip } = loadModules();
  const cols = regTypes.REGISTRATION_EXCEL_COLUMNS;

  // 1. Tipo desconhecido ("Visitante") + fórmula sem valor cacheado (<f>NOW()</f>)
  const badRowXml = `<row r="2">
    <c r="A2" t="inlineStr"><is><t>CARLOS</t></is></c>
    <c r="B2" t="inlineStr"><is><t>SILVA</t></is></c>
    <c r="D2"><f>TODAY()</f></c>
    <c r="S2" t="inlineStr"><is><t>Confirmado</t></is></c>
    <c r="T2" t="inlineStr"><is><t>Visitante</t></is></c>
  </row>`;

  const badXlsx = buildIndependentXlsxViaPython({
    entries: buildStandardOoxmlEntries({
      columns: cols,
      participanteRowsXml: badRowXml,
      todasRowsXml: badRowXml,
    }),
  });

  const badParsed = parser.parseRegistrationsWorkbook({
    fileBuffer: badXlsx,
    filename: "invalido.xlsx",
    createdByUserId: "33333333-3333-4333-8333-333333333333",
    baseRevision: 0,
  });

  assert.equal(badParsed.summary.canCommit, false);
  assert.ok(badParsed.summary.issues.some((i) => i.code === "INVALID_ROLE_CATEGORY"));
  assert.ok(
    badParsed.summary.issues.some(
      (i) => i.code === "FORMULA_CHARACTER_NEUTRALIZED" && i.severity === "error"
    )
  );

  // 2. Entidade XML inválida (&entidadeDesconhecida;) ou DOCTYPE/XXE
  const xxeEntries = buildStandardOoxmlEntries({
    columns: cols,
    participanteRowsXml: `<row r="2"><c r="A2" t="inlineStr"><is><t>&entidadeMaliciosa;</t></is></c></row>`,
  });
  const xxeXlsx = buildIndependentXlsxViaPython({ entries: xxeEntries });
  assert.throws(
    () =>
      parser.parseRegistrationsWorkbook({
        fileBuffer: xxeXlsx,
        filename: "xxe.xlsx",
        createdByUserId: "33333333-3333-4333-8333-333333333333",
        baseRevision: 0,
      }),
    /Entidade XML desconhecida/
  );

  // 3. Entrada duplicada no ZIP
  const dupZip = buildIndependentXlsxViaPython({
    entries: [
      { name: "xl/workbook.xml", content: "<workbook/>" },
      { name: "xl/workbook.xml", content: "<workbook/>" },
    ],
  });
  assert.throws(() => zip.readZipArchive(dupZip), /Entrada duplicada/);

  // 4. Zip-bomb (alta taxa de compressão)
  const hugeZeros = "0".repeat(250 * 1024);
  const bombZip = zip.createZipArchive([{ name: "xl/sharedStrings.xml", data: hugeZeros }]);
  assert.throws(
    () => zip.readZipArchive(bombZip, { maxCompressionRatio: 10 }),
    /Taxa de compressão suspeita/
  );

  // 5. ZIP truncado
  assert.throws(() => zip.readZipArchive(bombZip.subarray(0, 15)), /cabeçalho ZIP ausente/);
});

test("M3 + M4: preserva caixa mista (McDonald) e algarismos romanos (II, III), retorna nameChanges e sinaliza prováveis duplicados", () => {
  const { regTypes, normalize, parser } = loadModules();
  const cols = regTypes.REGISTRATION_EXCEL_COLUMNS;

  assert.equal(normalize.normalizePtBrPersonName("Ronald McDonald"), "Ronald McDonald");
  assert.equal(normalize.normalizePtBrPersonName("RONALD MCDONALD"), "Ronald McDonald");
  assert.equal(normalize.normalizePtBrPersonName("JOÃO PAULO II"), "João Paulo II");
  assert.equal(normalize.normalizePtBrPersonName("carlos eduardo iii da silva"), "Carlos Eduardo III da Silva");

  // Duas linhas sem CPF válido com mesmo nascimento e grafia quase idêntica ("PEDRO ALVES" vs "PEDRO ALVEZ")
  const rowsXml = `<row r="2">
    <c r="A2" t="inlineStr"><is><t>PEDRO</t></is></c>
    <c r="B2" t="inlineStr"><is><t>ALVES</t></is></c>
    <c r="D2" t="inlineStr"><is><t>10/05/2010</t></is></c>
    <c r="S2" t="inlineStr"><is><t>Confirmado</t></is></c>
    <c r="T2" t="inlineStr"><is><t>Participante</t></is></c>
  </row>
  <row r="3">
    <c r="A3" t="inlineStr"><is><t>PEDRO</t></is></c>
    <c r="B3" t="inlineStr"><is><t>ALVEZ</t></is></c>
    <c r="D3" t="inlineStr"><is><t>10/05/2010</t></is></c>
    <c r="S3" t="inlineStr"><is><t>Confirmado</t></is></c>
    <c r="T3" t="inlineStr"><is><t>Participante</t></is></c>
  </row>`;

  const xlsx = buildIndependentXlsxViaPython({
    entries: buildStandardOoxmlEntries({
      columns: cols,
      participanteRowsXml: rowsXml,
      todasRowsXml: rowsXml,
    }),
  });

  const parsed = parser.parseRegistrationsWorkbook({
    fileBuffer: xlsx,
    filename: "duplicados-provaveis.xlsx",
    createdByUserId: "33333333-3333-4333-8333-333333333333",
    baseRevision: 0,
  });

  assert.equal(parsed.summary.nameChanges.length, 2);
  assert.ok(
    parsed.summary.issues.some((i) => i.code === "PROBABLE_DUPLICATE_PERSON"),
    "deve emitir aviso PROBABLE_DUPLICATE_PERSON para mesmo nascimento e nome semelhante sem CPF"
  );
});
