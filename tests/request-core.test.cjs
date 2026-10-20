// Run with: node --test tests/request-core.test.cjs
// Comportamento da camada de requisições do navegador (src/lib/requests/core.ts):
// deduplicação em voo, teto de concorrência, fila limitada, timeout, cancelamento
// por assinante e isolamento/invalidação do cache curto.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const test = require("node:test");
const ts = require("typescript");

function loadCore() {
  const exports = {};
  const source = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/lib/requests/core.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
  ).outputText;
  vm.runInNewContext(source, { exports, setTimeout, clearTimeout, AbortController, Promise, Date, Error, Map });
  return exports;
}

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("a mesma consulta em paralelo executa uma única busca e entrega o resultado a todos", async () => {
  const { createLimiter, createRequestCache } = loadCore();
  const cache = createRequestCache({ limiter: createLimiter({ maxConcurrent: 4, maxQueue: 8 }) });
  let calls = 0;
  const gate = deferred();
  const fetcher = async () => { calls++; return gate.promise; };
  const pending = [1, 2, 3].map(() => cache.get("avisos:ana:c1", fetcher));
  await tick();
  gate.resolve(["aviso"]);
  const results = await Promise.all(pending);
  assert.equal(calls, 1);
  results.forEach((r) => assert.deepEqual(r, ["aviso"]));
});

test("contas diferentes nunca compartilham resultado", async () => {
  const { createLimiter, createRequestCache } = loadCore();
  const cache = createRequestCache({ limiter: createLimiter({ maxConcurrent: 4, maxQueue: 8 }) });
  const [ana, bia] = await Promise.all([
    cache.get("avisos:ana:c1", async () => "dados-ana", { ttlMs: 60_000 }),
    cache.get("avisos:bia:c1", async () => "dados-bia", { ttlMs: 60_000 }),
  ]);
  assert.equal(ana, "dados-ana");
  assert.equal(bia, "dados-bia");
  assert.equal(await cache.get("avisos:bia:c1", async () => "nova-busca", { ttlMs: 60_000 }), "dados-bia");
});

test("o teto de concorrência é respeitado e a fila escoa até o fim", async () => {
  const { createLimiter } = loadCore();
  const limiter = createLimiter({ maxConcurrent: 2, maxQueue: 8 });
  let active = 0;
  let peak = 0;
  const gates = [];
  const tasks = Array.from({ length: 5 }, (_, i) => limiter.run(async () => {
    active++; peak = Math.max(peak, active);
    const gate = deferred(); gates.push(gate);
    await gate.promise;
    active--;
    return i;
  }));
  await tick();
  assert.equal(gates.length, 2, "apenas duas tarefas começam");
  assert.deepEqual({ ...limiter.stats() }, { active: 2, queued: 3 });
  while (gates.length) { gates.shift().resolve(); await tick(); await tick(); }
  assert.deepEqual(await Promise.all(tasks), [0, 1, 2, 3, 4]);
  assert.equal(peak, 2);
});

test("fila cheia recusa na hora, sem esperar indefinidamente", async () => {
  const { createLimiter } = loadCore();
  const limiter = createLimiter({ maxConcurrent: 1, maxQueue: 1 });
  const gate = deferred();
  const running = limiter.run(() => gate.promise);
  const queued = limiter.run(async () => "fila");
  await assert.rejects(limiter.run(async () => "excedente"), (e) => e.code === "queue_full");
  gate.resolve("primeira");
  assert.equal(await running, "primeira");
  assert.equal(await queued, "fila");
});

test("timeout na fila rejeita sem iniciar a tarefa; timeout em execução aborta o sinal", async () => {
  const { createLimiter } = loadCore();
  const limiter = createLimiter({ maxConcurrent: 1, maxQueue: 4 });
  const gate = deferred();
  let runningSignal;
  const running = limiter.run((signal) => { runningSignal = signal; return gate.promise; }, { timeoutMs: 30 });
  let queuedStarted = false;
  const queued = limiter.run(async () => { queuedStarted = true; }, { timeoutMs: 10 });
  await assert.rejects(queued, (e) => e.code === "timeout");
  assert.equal(queuedStarted, false);
  await assert.rejects(running, (e) => e.code === "timeout");
  assert.equal(runningSignal.aborted, true);
  assert.equal(await limiter.run(async () => "vaga liberada"), "vaga liberada");
});

test("falha é entregue a todos os assinantes e não fica em cache", async () => {
  const { createLimiter, createRequestCache } = loadCore();
  const cache = createRequestCache({ limiter: createLimiter({ maxConcurrent: 2, maxQueue: 4 }) });
  let calls = 0;
  const failing = async () => { calls++; throw new Error("503"); };
  const results = await Promise.allSettled([
    cache.get("agenda:ana:all", failing, { ttlMs: 60_000 }),
    cache.get("agenda:ana:all", failing, { ttlMs: 60_000 }),
  ]);
  assert.deepEqual(results.map((r) => r.status), ["rejected", "rejected"]);
  assert.equal(calls, 1);
  assert.equal(await cache.get("agenda:ana:all", async () => { calls++; return "ok"; }), "ok");
  assert.equal(calls, 2);
});

test("cancelar um assinante não aborta os demais; cancelar todos aborta a busca", async () => {
  const { createLimiter, createRequestCache } = loadCore();
  const cache = createRequestCache({ limiter: createLimiter({ maxConcurrent: 2, maxQueue: 4 }) });
  const gate = deferred();
  let sharedSignal;
  const fetcher = (signal) => { sharedSignal = signal; return gate.promise; };
  const first = new AbortController();
  const a = cache.get("fotos:ana", fetcher, { signal: first.signal });
  const b = cache.get("fotos:ana", fetcher);
  await tick();
  first.abort();
  await assert.rejects(a, (e) => e.code === "aborted");
  assert.equal(sharedSignal.aborted, false);
  gate.resolve("fotos");
  assert.equal(await b, "fotos");

  const gate2 = deferred();
  let signal2;
  const c1 = new AbortController();
  const c2 = new AbortController();
  const x = cache.get("fotos:bia", (s) => { signal2 = s; return gate2.promise; }, { signal: c1.signal });
  const y = cache.get("fotos:bia", (s) => gate2.promise, { signal: c2.signal });
  await tick();
  c1.abort(); c2.abort();
  await Promise.allSettled([x, y]);
  assert.equal(signal2.aborted, true);
});

test("cache curto expira, invalida por prefixo e limpa na troca de sessão", async () => {
  const { createLimiter, createRequestCache } = loadCore();
  let clock = 1_000;
  const cache = createRequestCache({ limiter: createLimiter({ maxConcurrent: 2, maxQueue: 4 }), now: () => clock });
  let calls = 0;
  const fetcher = async () => ++calls;
  assert.equal(await cache.get("avisos:ana:c1", fetcher, { ttlMs: 100 }), 1);
  assert.equal(await cache.get("avisos:ana:c1", fetcher, { ttlMs: 100 }), 1);
  clock += 101;
  assert.equal(await cache.get("avisos:ana:c1", fetcher, { ttlMs: 100 }), 2);
  await cache.get("agenda:ana:all", async () => "agenda", { ttlMs: 100 });
  cache.invalidate("avisos:");
  assert.equal(await cache.get("avisos:ana:c1", fetcher, { ttlMs: 100 }), 3);
  assert.equal(await cache.get("agenda:ana:all", async () => "outra", { ttlMs: 100 }), "agenda");
  // sem ttl: só deduplica, não guarda
  assert.equal(await cache.get("saude:ana", async () => "x"), "x");
  assert.equal(await cache.get("saude:ana", async () => "y"), "y");
});

test("clear aborta buscas em voo e resposta atrasada da sessão anterior não volta ao cache", async () => {
  const { createLimiter, createRequestCache } = loadCore();
  const cache = createRequestCache({ limiter: createLimiter({ maxConcurrent: 2, maxQueue: 4 }) });
  const gate = deferred();
  let signal;
  const old = cache.get("avisos:ana:c1", (s) => { signal = s; return gate.promise; }, { ttlMs: 60_000 });
  await tick();
  cache.clear();
  await assert.rejects(old, (e) => e.code === "aborted");
  assert.equal(signal.aborted, true);
  gate.resolve("dados-antigos");
  await tick();
  assert.equal(await cache.get("avisos:ana:c1", async () => "dados-novos", { ttlMs: 60_000 }), "dados-novos");
});
