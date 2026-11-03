const assert = require("node:assert/strict");
const zlib = require("node:zlib");
const { test } = require("node:test");
const { loadRoute } = require("./helpers/route-harness.cjs");
const fs = require("node:fs");
const path = require("node:path");

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
function buildIndependentXlsx(spec) {
  const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  const crc32 = (bytes) => {
    let value = 0xffffffff;
    for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
    return (value ^ 0xffffffff) >>> 0;
  };
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of spec.entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = Buffer.from(entry.content, "utf8");
    const compressed = zlib.deflateRawSync(content);
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(spec.entries.length, 8);
  end.writeUInt16LE(spec.entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
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

function syntheticRowXml(rowNumber, overrides = {}) {
  const values = {
    A: "ÉRICA", B: "DA CONCEIÇÃO", D: "10/05/2010", R: "01/08/2026, 10:00:00",
    S: "Aprovado", T: "Participante", Y: "12.345.678-9", AA: "JOSÉ DA CONCEIÇÃO",
    AB: "16999990000", AD: "02314509820", ...overrides,
  };
  const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<row r="${rowNumber}">${Object.entries(values).map(([column, value]) =>
    `<c r="${column}${rowNumber}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`
  ).join("")}</row>`;
}

function parseSyntheticRows(rows, overrides = {}) {
  const { regTypes, parser } = loadModules();
  return parser.parseRegistrationsWorkbook({
    fileBuffer: buildIndependentXlsx({ entries: buildStandardOoxmlEntries({
      columns: regTypes.REGISTRATION_EXCEL_COLUMNS, participanteRowsXml: rows, todasRowsXml: rows,
      ...overrides,
    }) }),
    filename: "cenario-ficticio.xlsx", createdByUserId: "33333333-3333-4333-8333-333333333333", baseRevision: 0,
  });
}

test("duplicatas mantêm a aprovação mais recente, avisam divergências e aceitam sobrenome vazio", () => {
  const rows = [
    syntheticRowXml(2, { R: "01/08/2026, 10:00:00", H: "Alergia antiga" }),
    syntheticRowXml(3, { R: "02/08/2026, 09:00:00", H: "Alergia revisada", B: "" }),
    syntheticRowXml(4, { R: "02/08/2026, 11:00:00", S: "Cancelado" }),
    syntheticRowXml(5, { R: "03/08/2026, 11:00:00", S: "Aguardando aprovação" }),
  ].join("");
  const result = parseSyntheticRows(rows);
  assert.equal(result.summary.canCommit, true);
  assert.equal(result.summary.blockingErrorCount, 0);
  assert.equal(result.canonicalRows.length, 1);
  assert.equal(result.canonicalRows[0].fullNameNormalized, "Érica");
  assert.equal(result.canonicalRows[0].medicalInfoRaw, "Alergia revisada");
  assert.equal(result.canonicalRows[0].registrationDateRaw, "02/08/2026, 09:00:00");
  const duplicates = result.summary.issues.filter((issue) => issue.code === "CONFLICTING_DUPLICATE_KEY");
  assert.equal(duplicates.length, 3, "cópias da aba Todas não duplicam os avisos");
  assert.ok(duplicates.every((issue) => issue.severity === "warning" && issue.message.includes("mantida a de 02/08")));
  assert.ok(duplicates.some((issue) => issue.message.includes("Informações médicas")));
  assert.ok(result.summary.issues.some((issue) => issue.code === "MISSING_REQUIRED_FIELD" && issue.columnKey === "lastName"));
});

test("sem aprovação, usa data e hora mais recentes; cancelados persistem fora das contagens", () => {
  const result = parseSyntheticRows([
    syntheticRowXml(2, { S: "Aguardando aprovação", R: "10/09/2026, 08:00:00" }),
    syntheticRowXml(3, { S: "Em lista de espera", R: "10/09/2026, 09:00:01" }),
    syntheticRowXml(4, { S: "Cancelado", AD: "52998224725", Y: "77.222.333-4" }),
  ].join(""));
  assert.equal(result.summary.canCommit, true);
  assert.equal(result.canonicalRows.length, 2);
  assert.equal(result.canonicalRows.find((row) => row.cpfDigitsOnly === "02314509820").status, "Em lista de espera");
  assert.equal(result.summary.participantCount, 1);
  assert.equal(result.canonicalRows.filter((row) => row.status === "Cancelado").length, 1);
});

test("homônimos com documentos ou nascimentos diferentes permanecem separados", () => {
  const result = parseSyntheticRows([
    syntheticRowXml(2, { AD: "", Y: "", D: "10/05/2010" }),
    syntheticRowXml(3, { AD: "", Y: "", D: "11/05/2010" }),
    syntheticRowXml(4, { AD: "", Y: "DOC-123456", D: "10/05/2010" }),
    syntheticRowXml(5, { AD: "", Y: "DOC-654321", D: "10/05/2010" }),
  ].join(""));
  assert.equal(result.summary.canCommit, true);
  assert.equal(result.canonicalRows.length, 4);
  assert.equal(new Set(result.canonicalRows.map((row) => row.dedupKey)).size, 4);
  assert.ok(!result.summary.issues.some((issue) => issue.code === "CROSS_SHEET_MISMATCH"));
});

test("sem documento, alteração de e-mail, cargo ou acentos não altera a identidade", () => {
  const { normalize } = loadModules();
  const params = { cpfDigitsOnly: null, isValidElevenDigitsCpf: false, rgOrPassportRaw: null,
    email: "antigo@example.test", birthDateIso: "2010-05-10", birthDateRaw: "10/05/2010",
    fullNameNormalized: "Érica da Conceição", roleCategory: "Participante" };
  assert.equal(normalize.computeRegistrationDedupKey(params), normalize.computeRegistrationDedupKey({
    ...params, fullNameNormalized: "Erica da Conceicao", email: "novo@example.test", roleCategory: "Consultor",
  }));
});

test("cabeçalho AC alternativo aceita acentos/espaços e compromisso anual; cabeçalho incompatível bloqueia", () => {
  const { regTypes, parser } = loadModules();
  const columns = regTypes.REGISTRATION_EXCEL_COLUMNS.map((column) => column.key === "parentAuthorizationAck"
    ? { ...column, headerLabel: "  ME COMPROMETO A BAIXAR A AUTORIZACAO DOS PAIS, preencher e entregar aos coordenadores para o FSY 2027, conforme orientações deste ano.  " }
    : column);
  assert.equal(parseSyntheticRows(syntheticRowXml(2), { columns }).summary.canCommit, true);
  assert.equal(parser.headersMatch("CPF de terceiro", "CPF"), false);
  assert.equal(parseSyntheticRows(syntheticRowXml(2), { columns: columns.map((column) =>
    column.key === "cpf" ? { ...column, headerLabel: "Documento desconhecido" } : column
  ) }).summary.canCommit, false);
});

test("fixture fictícia oficial importa sem bloqueio, resolve duplicatas e preserva nome sem sobrenome", () => {
  const { parser } = loadModules();
  const result = parser.parseRegistrationsWorkbook({
    fileBuffer: fs.readFileSync(path.join(__dirname, "fixtures", "inscricoes-2027-sintetica.xlsx")),
    filename: "inscricoes-2027-sintetica.xlsx", createdByUserId: "33333333-3333-4333-8333-333333333333", baseRevision: 0,
  });
  assert.equal(result.summary.canCommit, true);
  assert.equal(result.summary.blockingErrorCount, 0);
  assert.equal(result.canonicalRows.length, 38);
  assert.ok(result.canonicalRows.some((row) => !row.lastNameRaw && row.fullNameNormalized === row.firstNameNormalized));
  assert.ok(result.summary.issues.some((issue) => issue.code === "CONFLICTING_DUPLICATE_KEY" && issue.severity === "warning"));
});

test("planilha independente gerada via Node: suporta date1900, date1904, numFmt 00000000000, sharedStrings com rich-text e inlineStr", () => {
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

  const xlsx1900 = buildIndependentXlsx({
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

  const xlsx1904 = buildIndependentXlsx({
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

test("avisa Tipo desconhecido e fórmula sem valor calculado; rejeita XML inválido, ZIP duplicado, zip-bomb e ZIP truncado", () => {
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

  const badXlsx = buildIndependentXlsx({
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

  assert.equal(badParsed.summary.canCommit, true);
  assert.ok(badParsed.summary.issues.some((i) => i.code === "INVALID_ROLE_CATEGORY"));
  assert.ok(
    badParsed.summary.issues.some(
      (i) => i.code === "FORMULA_CHARACTER_NEUTRALIZED" && i.severity === "warning"
    )
  );

  // 2. Entidade XML inválida (&entidadeDesconhecida;) ou DOCTYPE/XXE
  const xxeEntries = buildStandardOoxmlEntries({
    columns: cols,
    participanteRowsXml: `<row r="2"><c r="A2" t="inlineStr"><is><t>&entidadeMaliciosa;</t></is></c></row>`,
  });
  const xxeXlsx = buildIndependentXlsx({ entries: xxeEntries });
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
  const dupZip = buildIndependentXlsx({
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

  const xlsx = buildIndependentXlsx({
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
