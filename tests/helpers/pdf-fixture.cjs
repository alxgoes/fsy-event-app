const fs = require('node:fs');
const path = require('node:path');
const { loadRoute } = require('./route-harness.cjs');
const ROOT = path.resolve(__dirname, '../..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/inscricoes-2027-sintetica.xlsx');
const OUTPUT = path.join(ROOT, 'docs/redesign-2026-11/amostras-pdf');

function fixtureRecords() {
  return loadRoute('src/lib/registrations/xlsx-parser.ts').parseRegistrationsWorkbook({
    fileBuffer: fs.readFileSync(FIXTURE), filename: 'inscricoes-2027-sintetica.xlsx',
    createdByUserId: '00000000-0000-4000-8000-000000000001', baseRevision: 0,
    now: new Date('2026-11-02T12:00:00Z'),
  }).canonicalRows;
}

// O gerador acrescenta um stream não comprimido (objeto 19) ao modelo original.
// Lê os operadores de texto reais, decodificando escapes PDF/WinAnsi, sem depender
// de programas opcionais no ambiente de execução da suíte.
function extractOverlayText(buffer) {
  const source = buffer.toString('latin1');
  const objectStart = source.lastIndexOf('19 0 obj');
  if (objectStart < 0) throw new Error('Stream de preenchimento ausente.');
  const streamStart = source.indexOf('stream\n', objectStart) + 7;
  const stream = source.slice(streamStart, source.indexOf('endstream', streamStart));
  const text = [];
  for (const match of stream.matchAll(/\(((?:\\[\s\S]|[^\\)])*)\)\s*Tj/g)) {
    const bytes = [];
    const literal = match[1];
    for (let i = 0; i < literal.length; i++) {
      if (literal[i] !== '\\') { bytes.push(literal.charCodeAt(i)); continue; }
      const octal = literal.slice(i + 1).match(/^[0-7]{1,3}/);
      if (octal) { bytes.push(parseInt(octal[0], 8)); i += octal[0].length; }
      else {
        i++;
        const escape = { n: 10, r: 13, t: 9, b: 8, f: 12 };
        bytes.push(escape[literal[i]] ?? literal.charCodeAt(i));
      }
    }
    text.push(new TextDecoder('windows-1252').decode(Uint8Array.from(bytes)));
  }
  return text.join('\n');
}

if (require.main === module) {
  const pdf = loadRoute('src/lib/pdf/authorization-pdf.ts');
  fs.mkdirSync(OUTPUT, { recursive: true });
  for (const record of fixtureRecords()) {
    const result = pdf.renderAuthorizationPdfBuffer(record);
    fs.writeFileSync(path.join(OUTPUT, result.payload.suggestedFilename), result.pdfBuffer);
  }
  console.log('Amostras geradas exclusivamente da fixture sintética.');
}
module.exports = { fixtureRecords, extractOverlayText, OUTPUT };
