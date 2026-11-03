// Gates do redesign atual. Nenhuma regra WCAG, contraste ou alvo de toque é omitida.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const failures = [];
const matrix = report.filter((item) => item.matrix);
const expectedRoutes = ['/login', '/dashboard', '/schedule', '/announcements', '/mais', '/fotos', '/consultor', '/admin', '/admin/users', '/admin/medical', '/admin/companies', '/admin/logistics', '/admin/schedule', '/admin/announcements', '/admin/media', '/admin/counselor-audit'];
assert.equal(matrix.length, 64, 'Esperadas 16 rotas × 2 tamanhos × 2 temas.');
assert.equal(new Set(matrix.map((item) => `${item.route}:${item.mobile}:${item.dark}`)).size, 64, 'As 64 combinações devem ser distintas.');
assert.deepEqual([...new Set(matrix.map((item) => item.route))].sort(), expectedRoutes.sort());
assert.ok(matrix.every((item) => item.axe), 'Axe precisa executar em todas as telas da matriz.');
assert.equal(report.filter((item) => item.textScale200).length, 18, 'Esperados nove destinos em dois tamanhos com fonte 200%.');
assert.equal(report.filter((item) => item.mobileLayoutRegression).length, 8, 'Esperados cartões e abas em 320/360px, com fonte normal e 200%.');

for (const item of report) {
  const context = `${item.route || 'interação'} ${item.mobile ? 'celular' : 'desktop'} ${item.dark ? 'escuro' : 'claro'}${item.textScale200 ? ' fonte200%' : ''}`;
  for (const violation of item.axe?.violations || []) failures.push(`${context}: ${violation.id} (${violation.nodes.length} elementos)`);
  if (item.overflow) failures.push(`${context}: conteúdo transbordando`);
  if (item.internalOverlaps?.length) failures.push(`${context}: ${item.internalOverlaps.join('; ')}`);
  if (item.unlabeled?.length) failures.push(`${context}: campo sem rótulo`);
  if (item.smallTargets?.length) failures.push(`${context}: alvo interativo abaixo de 44px ${JSON.stringify(item.smallTargets)}`);
  if (item.runtimeErrors?.length) failures.push(`Erros de execução: ${item.runtimeErrors.join('; ')}`);
  if (item.blockedSupabase?.length) failures.push('Build tentou acessar Supabase real. Recompile usando exclusivamente o servidor falso.');
  if (item.youth) {
    if (item.privateLinks?.length) failures.push(`${context}: entrada de gestão exposta ao jovem`);
    if (item.internalSchedule) failures.push(`${context}: atividade interna exposta ao jovem`);
    if (item.customization) failures.push(`${context}: personalização removida reapareceu`);
    if (item.instagramOnHome) failures.push(`${context}: Instagram deve estar em Fotos`);
    if (item.route.startsWith('/schedule') && item.dayTabs?.length !== 5) failures.push(`${context}: jovem deve ver somente os cinco dias`);
    assert.deepEqual(item.navigation?.map((link) => link.href), ['/dashboard', '/schedule', '/announcements', '/mais'], `${context}: quatro destinos principais`);
  }
}

assert.ok(report.some((item) => item.fourTabNavigation), 'Navegação pelas quatro abas não confirmada.');
for (const route of ['/admin', '/consultor']) assert.ok(report.some((item) => item.youthRedirect === route && item.destination === '/dashboard'), `Jovem em ${route} precisa voltar ao Início.`);
assert.ok(report.some((item) => item.dayZeroRequest && item.dayTabs.length === 5 && !item.internalSchedule), 'Deep link de dia zero não foi verificado.');
assert.ok(report.some((item) => item.photosDestination === '/fotos'), 'Mais deve abrir Fotos.');
assert.ok(report.some((item) => item.instagramExpanded === 'true'), 'Legenda não foi expandida em Fotos.');
assert.ok(report.some((item) => item.instagramDialog?.hasEnd && item.instagramDialog?.contain && item.instagramDialog?.region), 'Leitura integral do post não confirmada.');
assert.ok(report.some((item) => item.dialogClosed && item.instagramFocusRestored), 'Escape e retorno de foco do post não confirmados.');
assert.ok(report.some((item) => item.themeToggleRoundTrip), 'Alternância de tema em Mais não confirmada.');
assert.ok(report.some((item) => JSON.stringify(item.appearanceChoices) === JSON.stringify(['Automático', 'Claro', 'Escuro'])), 'Três opções de aparência precisam continuar disponíveis.');
assert.ok(report.some((item) => item.pendingPhoto && item.youth), 'Estado de foto em análise não confirmado.');
assert.ok(report.some((item) => item.counselorPhotoReviews), 'Fotos para aprovar do consultor não confirmadas.');
assert.ok(report.some((item) => item.staffPhotoPublished), 'Equipe deve publicar foto sem cartão de aprovação.');
const adminAvatars = report.filter((item) => item.adminApprovedAvatar);
assert.equal(adminAvatars.length, 4, 'Foto aprovada da gestão precisa ser conferida em dois tamanhos e duas escalas de fonte.');
assert.ok(adminAvatars.every(({ adminApprovedAvatar: state }) => state.trigger && state.popover && state.profileLink && state.fitsViewport), 'Foto aprovada e acesso ao perfil devem aparecer no topo e no menu, dentro da tela.');
assert.ok(report.some((item) => item.adminMediaDialog?.named && item.adminMediaDialog.hasVisibilityAction && item.adminMediaDialog.closed && item.adminMediaDialog.focusRestored), 'Diálogo administrativo, Escape e retorno de foco não confirmados.');
assert.ok(report.some((item) => item.adminRoleAccess?.allManageEnabled && item.adminRoleAccess.allRoleOptions), 'Gestão equivalente de cargos para Logística não confirmada.');
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('64 telas sem violações automatizadas; fonte200%, encaixe móvel, foto direta da equipe, avatar da gestão, quatro abas e cargos verificados.');
