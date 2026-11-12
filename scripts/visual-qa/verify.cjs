// QA local com identidades fictícias. O build deve usar Supabase local e chaves dev.
// Este roteiro verifica interface; permissões/RLS reais são verificadas por npm test.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { pathToFileURL } = require('node:url');
const puppeteer = require(process.env.FSY_PUPPETEER_MODULE || 'puppeteer');

const root = process.cwd();
const base = 'http://127.0.0.1:3117';
const output = (name) => path.join(process.env.FSY_QA_OUTPUT_DIR || require('node:os').tmpdir(), name);
const routes = ['/login', '/dashboard', '/schedule', '/announcements', '/mais', '/fotos', '/consultor', '/admin', '/admin/users', '/admin/medical', '/admin/companies', '/admin/logistics', '/admin/schedule', '/admin/announcements', '/admin/media', '/admin/counselor-audit'];
const youthRoutes = new Set(['/dashboard', '/schedule', '/announcements', '/mais', '/fotos']);
const servers = [], report = [], detectorReports = [], runtimeErrors = [], blockedSupabase = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
fs.mkdirSync(path.dirname(output('qa')), { recursive: true });

async function ensureFree(port) {
  await new Promise((resolve, reject) => {
    const check = net.createServer();
    check.once('error', () => reject(new Error(`Porta ${port} ocupada. Nenhum servidor existente será usado.`)));
    check.listen(port, '127.0.0.1', () => check.close(resolve));
  });
}

function server(args, env) {
  const log = fs.openSync(output('fsy-visual-server.log'), 'a');
  const proc = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', log, log] });
  fs.closeSync(log);
  servers.push(proc);
  return proc;
}

function image(w = 400, h = 600) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#005e7c"/><text x="10%" y="50%" fill="white" font-size="32">FSY · Foto fictícia</text></svg>`;
}

async function run() {
  const axeScript = process.env.FSY_AXE_MODULE ? path.join(process.env.FSY_AXE_MODULE, 'axe.min.js') : require.resolve('axe-core/axe.min.js');
  await ensureFree(3117);
  await ensureFree(54399);
  const session = await import(pathToFileURL(path.join(root, 'scripts/visual-qa/session.mjs')).href);
  const youth = session.findUser('5');
  const youthProfile = session.fixtures.tables.profiles.find((p) => p.id === youth.id);
  const review = { user_id: youth.id, full_name: `${youth.full_name} de Oliveira e Albuquerque`, company_id: youthProfile.company_id, company_name: 'Companhia fictícia — Firmes e constantes na fé', pending_url: 'https://example.test/qa.svg', current_url: 'https://example.test/avatar-anterior.svg', submitted_at: '2026-11-02T12:00:00Z' };
  // Sentinelas internas comprovam o filtro inclusive em bancos antigos (Logística).
  const schedule = [
    { id: 'qa-day-zero', day: 'dia0', date: '2027-02-05', title: 'QA INTERNO DIA ZERO', category: 'Atividade', start_time: '10:00', end_time: '11:00' },
    { id: 'qa-team', day: 'dia1', date: '2027-02-06', title: 'QA INTERNO EQUIPE', category: 'Equipe', start_time: '08:00', end_time: '09:00' },
    { id: 'qa-legacy-team', day: 'dia1', date: '2027-02-06', title: 'Preparação QA INTERNO LEGADO', category: 'Logística', start_time: '09:00', end_time: '10:00' },
    { id: 'qa-opening', day: 'dia1', date: '2027-02-06', title: 'Boas-vindas ao FSY', category: 'Espiritual', start_time: '14:00', end_time: '15:00' },
    { id: 'qa-meal', day: 'dia1', date: '2027-02-06', title: 'Jantar com a companhia', category: 'Alimentação', start_time: '18:00', end_time: '19:00' },
  ].map((item) => ({ location: '', description: 'Atividade fictícia para verificação.', is_highlight: false, ...item }));
  server(['scripts/visual-qa/fake-supabase.mjs'], {});
  const next = server(['node_modules/next/dist/bin/next', 'start', '-p', '3117', '-H', '127.0.0.1'], { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54399', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'dev', SUPABASE_SERVICE_ROLE_KEY: 'dev', NEXT_PUBLIC_SITE_URL: base });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (next.exitCode !== null) throw new Error('Servidor de QA encerrou antes de ficar pronto. Confira fsy-visual-server.log.');
    try { if ((await fetch(`${base}/login`)).ok) { ready = true; break; } } catch { /* inicializando */ }
    await sleep(1000);
  }
  if (!ready) throw new Error('Servidor de QA não ficou pronto.');

  const browser = await puppeteer.launch({ headless: true, ...(process.env.FSY_CHROME_EXECUTABLE ? { executablePath: process.env.FSY_CHROME_EXECUTABLE } : {}), args: ['--renderer-process-limit=1', '--disable-extensions', ...(process.env.CI ? ['--no-sandbox'] : [])] });
  let activeUser = '5', pendingPhoto = false, approvedPhoto = false;
  const ownPhoto = () => ({ status: pendingPhoto ? 'pending' : approvedPhoto ? 'approved' : 'none', approved_url: approvedPhoto ? 'https://example.test/avatar-aprovado.svg' : null, pending_url: pendingPhoto ? review.pending_url : null, submitted_at: pendingPhoto ? review.submitted_at : null, reviewed_at: approvedPhoto ? review.submitted_at : null, review_note: null });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('fsy_pwa_dismissed_at', Date.now().toString());
      // Uma execução nunca reutiliza o JS de um service worker anterior.
      navigator.serviceWorker?.getRegistrations().then((items) => items.forEach((item) => item.unregister()));
    });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    page.on('pageerror', (error) => runtimeErrors.push(String(error)));
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      const url = new URL(request.url());
      const json = (body) => request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (/(^|\.)supabase\.(co|com)$/.test(url.hostname)) {
        blockedSupabase.push(url.hostname);
        return request.abort();
      }
      if (url.hostname === 'media.fsy.test') {
        const [, w, h] = url.pathname.match(/(\d+)x(\d+)/) || [];
        return request.respond({ status: 200, contentType: 'image/svg+xml', body: image(w, h) });
      }
      if (url.hostname === 'example.test') return request.respond({ status: 200, contentType: 'image/svg+xml', body: image() });
      if (request.url().includes('id=INVALIDO') || request.url().includes('/d/INVALIDO')) return request.respond({ status: 404, body: 'Fixture indisponível' });
      if (url.origin === base && url.pathname === '/api/instagram') return json({ data: [{ id: 'qa-long', imageUrl: 'https://example.test/qa.svg', caption: 'Legenda completa de teste.\n' + 'Texto integral com acentos, @fsy_ribeiraopreto e #FSY2027.\n'.repeat(35) + 'FIM DA LEGENDA', authorHandle: 'fsy_ribeiraopreto', publishedAt: '2026-10-20T12:00:00Z', postUrl: 'https://www.instagram.com/p/qa/', mediaType: 'IMAGE' }] });
      if (url.origin === base && url.pathname === '/api/profile/photo' && request.method() === 'POST') {
        pendingPhoto = activeUser === '5';
        approvedPhoto = !pendingPhoto;
        return json(ownPhoto());
      }
      if (url.origin === base && request.method() === 'GET') {
        if (url.pathname === '/api/schedule') return json({ data: schedule });
        // Só contratos visuais de foto são simulados aqui; autorização é testada no servidor.
        if (url.pathname === '/api/profile/photo') return json(ownPhoto());
        if (url.pathname === '/api/profile/photo/reviews' && ['1', '2', '3', '4'].includes(activeUser)) return json({ data: [review] });
        if (url.pathname === '/api/profile/photo/company') return json({ data: {} });
      }
      return request.continue();
    });

    async function identity(who) {
      activeUser = who;
      await page.deleteCookie({ name: 'sb-127-auth-token', domain: '127.0.0.1', path: '/' });
      if (who) await page.setCookie({ name: 'sb-127-auth-token', value: session.sessionCookie(who), domain: '127.0.0.1', path: '/' });
    }
    async function visit(route, who, dark = false) {
      await identity(who);
      await page.evaluate((theme) => localStorage.setItem('theme', theme), dark ? 'dark' : 'light');
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle2', timeout: 120000 });
      await page.waitForFunction(() => !!document.querySelector('main h1,main h2') && !document.querySelector('main .animate-pulse'), { timeout: 30000 });
      await page.waitForFunction((value) => document.documentElement.classList.contains('dark') === value, {}, dark);
      await page.evaluate(() => document.fonts.ready);
      await sleep(250);
    }
    // Conteúdo que chega depois (ex.: link do WhatsApp em Mais) pode re-renderizar a lista entre achar e clicar:
    // busca de novo e tenta outra vez em vez de clicar num elemento substituído.
    async function clickVisible(selector) {
      let lastError = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        for (const element of await page.$$(selector)) {
          try {
            const box = await element.boundingBox();
            if (box?.width && box?.height) { await element.click(); return element; }
          } catch (error) {
            lastError = error;
          }
        }
        await sleep(300);
      }
      throw lastError ?? new Error(`Controle visível ausente: ${selector}`);
    }
    async function audit(context) {
      const state = await page.evaluate(() => {
        const visible = (element) => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
        const controls = [...document.querySelectorAll('button,a[href]')].filter(visible);
        const nav = [...document.querySelectorAll('nav[aria-label="Navegação principal"]')].find(visible);
        // O documento pode caber mesmo quando o texto de um controle invade o vizinho.
        const internalOverlaps = [];
        const contained = (child, parent) => child.left >= parent.left - 1 && child.right <= parent.right + 1 && child.top >= parent.top - 1 && child.bottom <= parent.bottom + 1;
        const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        for (const group of document.querySelectorAll('[role=tablist],section[aria-labelledby="photo-reviews-title"] li')) {
          const buttons = [...group.querySelectorAll('button')].filter(visible);
          if (group.getAttribute('aria-label') === 'Dias da programação') {
            const selected = group.querySelector('[aria-selected=true]');
            const selectedBox = selected?.getBoundingClientRect();
            const strip = group.getBoundingClientRect();
            if (selectedBox && (selectedBox.right <= strip.left || selectedBox.left >= strip.right)) internalOverlaps.push('Aba selecionada fora da faixa visível');
          }
          for (let i = 0; i < buttons.length; i++) {
            const box = buttons[i].getBoundingClientRect();
            for (const other of buttons.slice(i + 1)) if (overlaps(box, other.getBoundingClientRect())) internalOverlaps.push(`Botões sobrepostos: ${buttons[i].innerText} / ${other.innerText}`);
            const walker = document.createTreeWalker(buttons[i], NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              if (!walker.currentNode.textContent.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(walker.currentNode);
              if ([...range.getClientRects()].some((rect) => !contained(rect, box))) internalOverlaps.push(`Rótulo fora do botão: ${buttons[i].innerText}`);
            }
          }
          if (group.matches('li')) {
            const card = group.getBoundingClientRect();
            for (const element of group.querySelectorAll('button,img,p')) if (!contained(element.getBoundingClientRect(), card)) internalOverlaps.push(`Conteúdo fora do cartão de aprovação: ${element.textContent || element.tagName}`);
          }
        }
        for (const element of document.querySelectorAll('[data-counselor-company-title],[data-registration-stat-card]')) {
          const bounds = element.getBoundingClientRect();
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            if (!walker.currentNode.textContent.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(walker.currentNode);
            if ([...range.getClientRects()].some((rect) => !contained(rect, bounds))) internalOverlaps.push(`Texto fora do quadro: ${walker.currentNode.textContent.trim()}`);
          }
        }
        return {
          url: location.pathname, title: document.querySelector('main h1,main h2')?.textContent,
          overflow: document.documentElement.scrollWidth > innerWidth,
          internalOverlaps,
          unlabeled: [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter((element) => visible(element) && !element.labels?.length && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')).map((element) => ({ tag: element.tagName, id: element.id, placeholder: element.placeholder })),
          smallTargets: controls.filter((element) => { const box = element.getBoundingClientRect(); return !element.closest('p') && (box.width < 43.99 || box.height < 43.99); }).map((element) => ({ text: element.innerText, aria: element.getAttribute('aria-label'), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
          navigation: nav ? [...nav.querySelectorAll('a')].map((link) => ({ href: link.getAttribute('href'), text: link.innerText })) : [],
          privateLinks: controls.filter((element) => /^\/(admin|consultor)(\/|$)/.test(element.getAttribute('href') || '') || /^(Gestão|Administração|Painel do consultor|Publicar)$/.test((element.getAttribute('aria-label') || element.innerText).trim())).map((element) => element.innerText),
          internalSchedule: document.querySelector('main')?.innerText.includes('QA INTERNO') || false,
          dayTabs: [...document.querySelectorAll('[role=tablist][aria-label="Dias do evento"] [role=tab]')].map((element) => element.innerText),
          customization: controls.some((element) => /Personalizar|Salvar layout|Restaurar padrão/.test(element.getAttribute('aria-label') || element.innerText)) || !!document.querySelector('[data-control=handle]'),
          instagramOnHome: location.pathname === '/dashboard' && !!document.querySelector('button[aria-label^="Ampliar publicação"]'),
        };
      });
      await page.evaluate(() => { window.__IMPECCABLE_CONFIG__ = { autoScan: false }; });
      await page.addScriptTag({ path: path.join(root, '.agent/skills/impeccable/scripts/detector/detect-antipatterns-browser.js') });
      detectorReports.push({ ...context, groups: await page.evaluate(() => window.impeccableDetect({ decorate: false, serialize: true })) });
      await page.addScriptTag({ path: axeScript });
      const axe = await page.evaluate(async () => {
        const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
        return { violations: result.violations, incomplete: result.incomplete.map((item) => ({ id: item.id, nodes: item.nodes.length })), passes: result.passes.length };
      });
      report.push({ ...context, ...state, axe });
      console.log('QA', context.route, context.mobile ? 'celular' : 'desktop', context.dark ? 'escuro' : 'claro', JSON.stringify(state));
    }

    await page.goto(`${base}/offline`, { waitUntil: 'networkidle2' });
    for (const mobile of [false, true]) for (const dark of [false, true]) {
      await page.setViewport({ width: mobile ? 390 : 1365, height: mobile ? 844 : 900 });
      for (const route of routes) {
        const who = route === '/login' ? '' : youthRoutes.has(route) ? '5' : route === '/consultor' ? '4' : '1';
        await visit(route, who, dark);
        await audit({ matrix: true, route, mobile, dark, youth: who === '5' });
        if (youthRoutes.has(route) || ['/consultor', '/admin', '/admin/medical'].includes(route)) await page.screenshot({ path: output(`fsy-${route.slice(1).replaceAll('/', '-')}-${mobile ? 'mobile' : 'desktop'}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      }
    }

    // Fonte ampliada mantém o mesmo gate de alvos, rótulos, contraste e transbordamento.
    for (const width of [1280, 768, 390]) for (const route of ['/dashboard', '/schedule', '/announcements', '/mais', '/fotos', '/admin/users', '/admin/companies', '/admin/schedule', '/consultor', '/admin/inscricoes']) {
      await page.setViewport({ width, height: 1024 });
      await visit(route, youthRoutes.has(route) ? '5' : route === '/consultor' ? '4' : '1');
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await sleep(250);
      await audit({ textScale200: true, width, route, mobile: width < 768, dark: false, youth: youthRoutes.has(route) });
    }

    for (const width of [320, 360]) for (const route of ['/mais', '/fotos', '/consultor', '/admin/companies', '/admin/inscricoes', '/admin/schedule']) for (const enlarged of [false, true]) {
      await page.setViewport({ width, height: 844 });
      const who = youthRoutes.has(route) ? '5' : route === '/consultor' ? '4' : '3';
      await visit(route, who, true);
      if (enlarged) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await audit({ mobileLayoutRegression: true, enlarged, width, route, mobile: true, dark: true, youth: youthRoutes.has(route) });
      await page.screenshot({ path: output(`fsy-correcao-${route.slice(1).replaceAll('/', '-')}-${width}-${enlarged ? 'fonte200' : 'normal'}.png`), fullPage: true });
    }

    // Verifica diálogos de WhatsApp da companhia em /consultor e /admin/companies (320px e fonte 200%).
    await page.setViewport({ width: 320, height: 844 });
    await visit('/consultor', '4', false);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await clickVisible('section[aria-label="Grupo do WhatsApp"] button');
    await page.waitForSelector('[role=dialog]');
    await audit({ route: '/consultor', mobile: true, dark: false, enlarged: true, width: 320, whatsappDialog: true });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });

    await page.setViewport({ width: 390, height: 844 });
    await visit('/dashboard', '5');
    for (const route of ['/schedule', '/announcements', '/mais', '/dashboard']) {
      await clickVisible(`nav[aria-label="Navegação principal"] a[href="${route}"]`);
      await page.waitForFunction((target) => location.pathname === target, {}, route);
    }
    report.push({ fourTabNavigation: true });
    for (const route of ['/admin', '/consultor']) {
      await visit(route, '5');
      report.push({ youthRedirect: route, destination: new URL(page.url()).pathname });
    }
    await visit('/schedule?dia=dia0', '5');
    await audit({ route: '/schedule?dia=dia0', mobile: true, dark: false, youth: true, dayZeroRequest: true });

    await visit('/mais', '5');
    await clickVisible('main a[href="/fotos"]');
    await page.waitForSelector('button[aria-label^="Ampliar publicação"]');
    report.push({ photosDestination: new URL(page.url()).pathname });
    const expand = await clickVisible('article button[aria-expanded=false]');
    report.push({ instagramExpanded: await expand.evaluate((element) => element.getAttribute('aria-expanded')) });
    const instagramTrigger = await clickVisible('button[aria-label^="Ampliar publicação"]');
    await page.waitForSelector('[role=dialog]');
    report.push({ instagramDialog: await page.$eval('[role=dialog]', (element) => ({ hasEnd: element.textContent.includes('FIM DA LEGENDA'), contain: !!element.querySelector('.object-contain'), region: !!element.querySelector('[role=region][tabindex="0"]') })) });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
    report.push({ dialogClosed: true, instagramFocusRestored: await instagramTrigger.evaluate((element) => document.activeElement === element) });

    await visit('/mais', '5');
    await clickVisible('[role=radio][aria-checked=false]');
    await clickVisible('[role=radio]:nth-child(3)');
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    await clickVisible('[role=radio]:nth-child(2)');
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark'));
    report.push({ appearanceChoices: await page.$$eval('[role=radiogroup][aria-label="Aparência"] [role=radio]', (items) => items.map((item) => item.innerText)), themeToggleRoundTrip: true });
    pendingPhoto = true;
    await visit('/mais', '5');
    await page.waitForFunction(() => document.body.innerText.includes('Em análise pelo seu consultor'));
    await audit({ route: '/mais', mobile: true, dark: false, youth: true, pendingPhoto: true });
    await page.screenshot({ path: output('fsy-mais-foto-pendente.png'), fullPage: true });
    pendingPhoto = false;

    await visit('/consultor', '4');
    report.push({ counselorPhotoReviews: await page.$eval('#photo-reviews-title', (element) => element.textContent.includes('Fotos para aprovar')) });

    // Envio fictício da equipe: a resposta aprovada precisa atualizar foto e texto imediatamente.
    await visit('/mais', '3');
    const publishedPhoto = page.waitForResponse((response) => response.url() === `${base}/api/profile/photo` && response.request().method() === 'POST');
    await page.$eval('main input[type=file]', async (input) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 32;
      const context = canvas.getContext('2d');
      context.fillStyle = '#007da5';
      context.fillRect(0, 0, 32, 32);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], 'foto-ficticia.png', { type: 'image/png' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await publishedPhoto;
    await page.waitForFunction(() => [...document.querySelectorAll('main img')].some((img) => img.src === 'https://example.test/avatar-aprovado.svg' && img.complete && img.naturalWidth > 0));
    report.push({ staffPhotoPublished: await page.$eval('main', (element) => !/Em análise pelo seu consultor|Sua foto precisa da aprovação/.test(element.innerText)) });

    for (const width of [390, 1365]) for (const enlarged of [false, true]) {
      await page.setViewport({ width, height: 1024 });
      await visit('/admin/inscricoes', '3', true);
      if (enlarged) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await page.waitForSelector('[data-admin-profile-trigger] img');
      await clickVisible('[data-admin-profile-trigger]');
      await page.waitForSelector('#admin-profile-popover');
      const adminApprovedAvatar = await page.evaluate(() => {
        const trigger = document.querySelector('[data-admin-profile-trigger]');
        const popover = document.querySelector('#admin-profile-popover');
        const loaded = (element) => { const img = element?.querySelector('img'); return img?.src === 'https://example.test/avatar-aprovado.svg' && img.complete && img.naturalWidth > 0; };
        const rect = popover.getBoundingClientRect();
        return { trigger: loaded(trigger), popover: loaded(popover), profileLink: !!popover.querySelector('a[href="/mais"]'), fitsViewport: rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight };
      });
      report.push({ route: '/admin/inscricoes', width, enlarged, adminApprovedAvatar });
      await audit({ route: '/admin/inscricoes', mobile: width < 768, dark: true, enlarged, profilePopover: true });
      await page.screenshot({ path: output(`fsy-avatar-gestao-${width}-${enlarged ? 'fonte200' : 'normal'}.png`), fullPage: true });
    }
    approvedPhoto = false;
    await page.setViewport({ width: 390, height: 844 });
    // Logística inspeciona os cargos de direção, sem gravar nenhuma conta.
    await visit('/admin/users', '3');
    await page.waitForSelector('button[aria-label^="Gerenciar conta de"]');
    const allManageEnabled = await page.$$eval('button[aria-label^="Gerenciar conta de"]', (items) => items.length > 0 && items.every((item) => !item.disabled));
    const director = session.fixtures.tables.profiles.find((p) => p.role === 'casal_diretor');
    await clickVisible(`button[aria-label="Gerenciar conta de ${director.full_name}"]`);
    await page.waitForSelector('#acc-role');
    report.push({ adminRoleAccess: { allManageEnabled, allRoleOptions: await page.$$eval('#acc-role option', (items) => items.length === 7) } });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[role=dialog]'));

    await visit('/admin/media', '1');
    let mediaTrigger;
    for (const button of await page.$$('button')) if ((await button.evaluate((element) => element.textContent)).includes('Expandir')) { mediaTrigger = button; break; }
    if (!mediaTrigger) throw new Error('Prévia administrativa de foto ausente.');
    await mediaTrigger.click();
    await page.waitForSelector('[role=dialog]');
    const adminMediaDialog = await page.$eval('[role=dialog]', (element) => ({ named: !!element.getAttribute('aria-labelledby'), hasVisibilityAction: /Visível|Oculta/.test(element.textContent) }));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
    report.push({ adminMediaDialog: { ...adminMediaDialog, closed: true, focusRestored: await mediaTrigger.evaluate((element) => document.activeElement === element) } });
  } finally {
    report.push({ runtimeErrors, blockedSupabase });
    fs.writeFileSync(output('fsy-impeccable-dom.json'), JSON.stringify(detectorReports, null, 2));
    fs.writeFileSync(output('fsy-visual-report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => servers.forEach((proc) => proc.kill('SIGTERM')));
