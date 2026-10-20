// QA local com identidades fictícias. Requer build feito com URL http://127.0.0.1:54399 e chaves dev.
// Não testa RLS: use npm test para as políticas reais em Postgres local.
const {spawn}=require('child_process');
const fs=require('fs');
const root=process.cwd();
// Puppeteer pode estar em um scratchpad; não é dependência de produção.
const puppeteer=require(process.env.FSY_PUPPETEER_MODULE || 'puppeteer');
const path=require('path'), net=require('net');
const output=name=>path.join(process.env.FSY_QA_OUTPUT_DIR || require('os').tmpdir(),name);
fs.mkdirSync(path.dirname(output('qa')), {recursive:true});
async function ensureFree(port){await new Promise((resolve,reject)=>{const check=net.createServer();check.once('error',()=>reject(new Error(`Porta ${port} ocupada. Nenhum servidor existente será usado.`)));check.listen(port,'127.0.0.1',()=>check.close(resolve));});}
const servers=[];
async function run(){
await ensureFree(3117);
await ensureFree(54399);
const session=await import(root+'/scripts/visual-qa/session.mjs');
function server(args,env){const p=spawn(process.execPath,args,{cwd:root,env:{...process.env,...env},stdio:['ignore',fs.openSync(output('fsy-visual-server.log'),'a'),'pipe']});p.stderr.on('data',d=>fs.appendFileSync(output('fsy-visual-server.log'),d));servers.push(p);}
server(['scripts/visual-qa/fake-supabase.mjs'],{});
server(['node_modules/next/dist/bin/next','start','-p','3117','-H','127.0.0.1'],{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54399',NEXT_PUBLIC_SUPABASE_ANON_KEY:'dev',SUPABASE_SERVICE_ROLE_KEY:'dev'});
for(let i=0;i<120;i++){try{const r=await fetch('http://127.0.0.1:3117/login');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
const browser=await puppeteer.launch({headless:true});
try{
const page=await browser.newPage();
await page.evaluateOnNewDocument(()=>{localStorage.setItem('fsy_pwa_dismissed_at',Date.now().toString());});
await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
const cookie=session.sessionCookie('1');
await page.setCookie({name:'sb-127-auth-token',value:cookie,domain:'127.0.0.1',path:'/'});
await page.setRequestInterception(true);
page.on('request',r=>r.url().includes('/api/instagram')?r.respond({status:200,contentType:'application/json',body:JSON.stringify({data:[{id:'qa-long',imageUrl:'https://example.test/qa.svg',caption:'Legenda completa de teste.\n'+('Texto integral com acentos, @fsy_ribeiraopreto e #FSY2027.\n'.repeat(35))+'FIM DA LEGENDA',authorHandle:'fsy_ribeiraopreto',publishedAt:'2026-10-20T12:00:00Z',postUrl:'https://www.instagram.com/p/qa/',mediaType:'IMAGE'}]})}):r.url()==='https://example.test/qa.svg'?r.respond({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#007da5"/><text x="30" y="200" fill="white" font-size="32">FSY · Foto fictícia</text></svg>'}):r.continue());
const report=[];
const detectorReports=[];
for(const mobile of [false,true]){
await page.setViewport({width:mobile?390:1365,height:mobile?844:900});
for(const route of ['/login','/dashboard','/schedule','/announcements','/consultor','/admin','/admin/users','/admin/medical','/admin/companies','/admin/logistics','/admin/schedule','/admin/announcements','/admin/media','/admin/counselor-audit']){
await page.setCookie({name:'sb-127-auth-token',value:session.sessionCookie(route==='/consultor'?'4':'1'),domain:'127.0.0.1',path:'/'});
await page.goto('http://127.0.0.1:3117'+route,{waitUntil:'networkidle2',timeout:120000});
await page.waitForFunction(()=>!document.body.innerText.includes('Sincronizando')&&!document.body.innerText.includes('Carregando seu perfil')&&!!document.querySelector('h1,h2'),{timeout:30000}).catch(()=>{});
await new Promise(r=>setTimeout(r,1200));
await page.evaluate(dark=>{document.documentElement.classList.toggle('dark',dark);},mobile);
await new Promise(r=>setTimeout(r,400));
const state=await page.evaluate(()=>({url:location.pathname,title:document.querySelector('h1,h2')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth,unlabeled:[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(e=>e.getBoundingClientRect().width>0&&!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')).map(e=>({tag:e.tagName,id:e.id,placeholder:e.placeholder})),smallTargets:[...document.querySelectorAll('button,a[href]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<43||r.width<43)}).length}));
await page.evaluate(()=>{window.__IMPECCABLE_CONFIG__={autoScan:false};});
await page.addScriptTag({path:root+'/.agent/skills/impeccable/scripts/detector/detect-antipatterns-browser.js'});
const detected=await page.evaluate(()=>window.impeccableDetect({decorate:false,serialize:true}));
detectorReports.push({route,mobile,groups:detected});
report.push({route,mobile,...state});console.log('QA',route,mobile?'mobile':'desktop',JSON.stringify(state));
if(['/dashboard','/consultor','/admin','/admin/medical'].includes(route))await page.screenshot({path:output(`fsy-${route.slice(1).replaceAll('/','-')}-${mobile?'mobile':'desktop'}.png`),fullPage:true});
}
}
await page.setCookie({name:'sb-127-auth-token',value:session.sessionCookie('5'),domain:'127.0.0.1',path:'/'});
await page.goto('http://127.0.0.1:3117/dashboard',{waitUntil:'networkidle2'});
await page.waitForSelector('button[aria-label^="Ampliar publicação"]',{timeout:30000});
const expand=await page.$('article button[aria-expanded=false]');if(expand){await expand.click();report.push({instagramExpanded:await expand.evaluate(e=>e.getAttribute('aria-expanded'))});}
const trigger=await page.$('button[aria-label^="Ampliar publicação"]');if(trigger){await trigger.click();await page.waitForSelector('[role=dialog]');report.push({instagramDialog:await page.$eval('[role=dialog]',e=>({hasEnd:e.textContent.includes('FIM DA LEGENDA'),contain:!!e.querySelector('.object-contain'),region:!!e.querySelector('[role=region][tabindex="0"]')}))});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));report.push({dialogClosed:!(await page.$('[role=dialog]'))});}
const before=await page.$$eval('[data-control=handle]',els=>els.map(e=>e.getAttribute('aria-label')));
const customize=await page.$('button');
const buttons=await page.$$('button');
for(const b of buttons){if((await b.evaluate(e=>e.textContent)).includes('Personalizar layout')){await b.click();break;}}
const handles=await page.$$eval('[data-control=handle]',els=>els.map(e=>e.getAttribute('aria-label')));
const down=await page.$('[data-control=down]:not([disabled])');if(down)await down.click();
const afterMove=await page.$$eval('[data-control=handle]',els=>els.map(e=>e.getAttribute('aria-label')));
for(const b of await page.$$('button')){if((await b.evaluate(e=>e.textContent)).includes('Salvar layout')){await b.click();break;}}
await new Promise(r=>setTimeout(r,500));
await page.reload({waitUntil:'networkidle2'});
for(const b of await page.$$('button')){if((await b.evaluate(e=>e.textContent)).includes('Personalizar layout')){await b.click();break;}}
const reloaded=await page.$$eval('[data-control=handle]',els=>els.map(e=>e.getAttribute('aria-label')));
report.push({layout:{handleCount:handles.length,moved:handles[0]!==afterMove[0],persistedAfterReload:reloaded[0]===afterMove[0]}});
for(const b of await page.$$('button')){if((await b.evaluate(e=>e.textContent)).includes('Restaurar padrão')){await b.click();break;}}
const restored=await page.$$eval('[data-control=handle]',els=>els.map(e=>e.getAttribute('aria-label')));
report.push({layoutRestored:restored[0]===handles[0]});
for(const b of await page.$$('button')){if((await b.evaluate(e=>e.textContent)).includes('Salvar layout')){await b.click();break;}}
fs.writeFileSync(output('fsy-impeccable-dom.json'),JSON.stringify(detectorReports,null,2));
fs.writeFileSync(output('fsy-visual-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>servers.forEach(p=>p.kill('SIGTERM')));
