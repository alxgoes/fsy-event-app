// Gate das evidências existentes: não altera regras de acessibilidade ou fixtures.
const fs = require('node:fs');
const assert = require('node:assert/strict');

const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const failures = [];
const axeCases = report.filter((item) => item.axe);
assert.equal(axeCases.length, 56, 'Esperadas 14 rotas × 2 tamanhos × 2 temas.');

for (const item of report) {
  const context = `${item.route || 'interação'} ${item.mobile ? 'celular' : 'desktop'} ${item.dark ? 'escuro' : 'claro'}`;
  for (const violation of item.axe?.violations || []) {
    failures.push(`${context}: ${violation.id} (${violation.nodes.length} elementos)`);
  }
  if (item.overflow) failures.push(`${context}: conteúdo transbordando`);
  if (item.unlabeled?.length) failures.push(`${context}: campo sem rótulo`);
  if (item.smallTargets?.length) failures.push(`${context}: alvo interativo abaixo de 44 px`);
  if (item.runtimeErrors?.length) failures.push(`Erros de execução: ${item.runtimeErrors.join('; ')}`);
}

assert.ok(report.some((item) => item.instagramExpanded === 'true'), 'Legenda não foi expandida.');
assert.ok(report.some((item) => item.instagramDialog?.hasEnd && item.instagramDialog?.contain && item.instagramDialog?.region), 'Leitura integral do post não confirmada.');
assert.ok(report.some((item) => item.dialogClosed === true), 'Fechamento do post não confirmado.');
assert.ok(report.some((item) => item.layout?.handleCount > 1 && item.layout.moved && item.layout.persistedAfterReload), 'Reordenação e persistência do layout não confirmadas.');
assert.ok(report.some((item) => item.layoutRestored === true), 'Restauração do layout não confirmada.');
assert.ok(report.some((item) => item.themeToggleRoundTrip === true), 'Alternância de tema não confirmada.');
assert.ok(report.some((item) => item.adminMediaDialog?.named && item.adminMediaDialog.hasVisibilityAction && item.adminMediaDialog.closed && item.adminMediaDialog.focusRestored), 'Diálogo administrativo, Escape e retorno de foco não confirmados.');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('56 telas sem violações automatizadas; zoom, legendas, layout e temas verificados.');
}
