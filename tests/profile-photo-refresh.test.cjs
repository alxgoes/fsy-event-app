const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const code = ts.transpileModule(fs.readFileSync('src/lib/profile-photo/useOwnPhoto.ts','utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true }
}).outputText;
const photo = (status) => ({ status,approved_url: status==='approved' ? 'https://example.invalid/aprovada.jpg' : null,
  pending_url: status==='pending' ? 'https://example.invalid/pendente.jpg' : null,submitted_at:null,reviewed_at:null,review_note:null });

function fixture() {
  const states=[], effects=[], pendingEffects=[], requests=[], intervals=new Map();
  const listeners=new Map(), docs=new Map(); let cursor=0, owner='pessoa-a', timer=0;
  const on=(map,name,fn)=> { if(!map.has(name)) map.set(name,new Set()); map.get(name).add(fn); };
  const off=(map,name,fn)=>map.get(name)?.delete(fn);
  class Event { constructor(type){this.type=type;} }
  class CustomEvent extends Event { constructor(type,opts){super(type);this.detail=opts.detail;} }
  const window={
    addEventListener:(name,fn)=>on(listeners,name,fn),removeEventListener:(name,fn)=>off(listeners,name,fn),
    dispatchEvent:(e)=>{for(const fn of listeners.get(e.type)||[])fn(e);},
    setInterval:(fn)=>{intervals.set(++timer,fn);return timer;},clearInterval:(id)=>intervals.delete(id),
  };
  const document={visibilityState:'visible',addEventListener:(name,fn)=>on(docs,name,fn),removeEventListener:(name,fn)=>off(docs,name,fn)};
  const react={useState:(initial)=>{const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],(value)=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
    useCallback:(fn)=>fn,useEffect:(fn,deps)=>{const i=cursor++;const old=effects[i];
      if(!old||deps.some((value,j)=>value!==old.deps[j])){const effect={deps};effects[i]=effect;pendingEffects.push(()=>{old?.cleanup?.();effect.cleanup=fn();});}}};
  const exports={};
  vm.runInNewContext(code,{exports,window,document,Event,CustomEvent,AbortController,
    require:(name)=>name==='react'?react:{useProfile:()=>({profile:owner?{id:owner}:null})},
    fetch:(_url,options)=>new Promise((resolve)=>requests.push({options,resolve:(state,status=200)=>resolve({ok:status===200,status,json:async()=>state})})),
  });
  return{requests,render:()=>{cursor=0;return exports.useOwnPhoto();},run:()=>{while(pendingEffects.length)pendingEffects.shift()();},
    owner:(id)=>{owner=id;},focus:()=>window.dispatchEvent(new Event('focus')),
    visible:(value)=>{document.visibilityState=value;for(const fn of docs.get('visibilitychange')||[])fn();},
    poll:()=>{for(const fn of intervals.values())fn();},
    publish:(userId,state)=>window.dispatchEvent(new CustomEvent('fsy_profile_photo_updated',{detail:{userId,state}})),
    cleanup:()=>effects.forEach((effect)=>effect?.cleanup?.()),
    remaining:()=>[...listeners.values(),...docs.values()].reduce((n,set)=>n+set.size,0)+intervals.size};
}

test('foto aprovada externamente é relida ao foco/visibilidade e URLs assinadas são renovadas sem logout',async()=>{
  const f=fixture();f.render();f.run();assert.equal(f.requests.length,1);
  f.requests[0].resolve(photo('pending'));await flush();assert.equal(f.render().state.status,'pending');
  f.focus();assert.equal(f.requests.length,2);f.requests[1].resolve(photo('approved'));await flush();
  assert.equal(f.render().state.status,'approved');
  f.visible('hidden');f.poll();assert.equal(f.requests.length,2);
  f.visible('visible');assert.equal(f.requests.length,3);f.requests[2].resolve(photo('approved'));await flush();
  f.poll();assert.equal(f.requests.length,4);
  f.cleanup();assert.equal(f.remaining(),0);
});

test('resposta anterior não restaura foto de outra conta, após troca ou saída',async()=>{
  const f=fixture();f.render();f.run();
  f.owner('pessoa-b');assert.equal(f.render().state,null);f.run();
  f.requests[0].resolve(photo('approved'));await flush();assert.equal(f.render().state,null);
  f.requests[1].resolve(photo('none'));await flush();assert.equal(f.render().state.status,'none');
  f.owner(null);assert.equal(f.render().state,null);f.run();
  f.owner('pessoa-a');assert.equal(f.render().state,null);f.run();assert.equal(f.requests.length,3);
  f.cleanup();
});

test('um GET antigo não substitui uma foto que acabou de ser publicada',async()=>{
  const f=fixture();f.render();f.run();
  f.publish('pessoa-a',photo('approved'));assert.equal(f.render().state.status,'approved');
  f.requests[0].resolve(photo('pending'));await flush();assert.equal(f.render().state.status,'approved');
  f.cleanup();
});
