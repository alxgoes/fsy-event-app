// Run with: node --test tests/request-services.test.cjs
// Serviços do painel (agenda, companhia, fotos, avisos) sobre a camada de requisições:
// deduplicação real, sem cache buster, sem cascata ao Supabase em falha de autorização
// ou rede, isolamento por conta e limpeza na troca de sessão.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const test = require("node:test");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");

function createEnv({ routes = {}, tables = {} } = {}) {
  const env = { userId: "ana", fetches: [], queries: [], authListeners: [], storage: new Map() };
  env.signIn = (id) => {
    env.userId = id;
    env.authListeners.forEach((cb) => cb(id ? "SIGNED_IN" : "SIGNED_OUT", id ? { user: { id } } : null));
  };
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: env.userId ? { user: { id: env.userId } } : null }, error: null }),
      onAuthStateChange: (cb) => {
        env.authListeners.push(cb);
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from(table) {
      const query = { table, filters: [], user: env.userId };
      env.queries.push(query);
      const builder = {
        then(resolve, reject) {
          const handler = tables[table];
          const result = typeof handler === "function" ? handler(query) : handler || { data: [], error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      for (const op of ["select", "eq", "or", "is", "order", "single", "maybeSingle"]) {
        builder[op] = (...args) => { query.filters.push([op, ...args]); return builder; };
      }
      builder.abortSignal = (signal) => { query.signal = signal; return builder; };
      return builder;
    },
  };
  const fetch = async (url, init = {}) => {
    const call = { url: String(url), init, user: env.userId };
    env.fetches.push(call);
    const pathname = call.url.split("?")[0];
    const route = routes[pathname];
    const result = typeof route === "function" ? await route(call) : route;
    if (result instanceof Error) throw result;
    const { status = 200, body = {} } = result || { status: 404 };
    return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(JSON.stringify(body)) };
  };
  const localStorage = {
    get length() { return env.storage.size; },
    key: (i) => [...env.storage.keys()][i] ?? null,
    getItem: (k) => (env.storage.has(k) ? env.storage.get(k) : null),
    setItem: (k, v) => env.storage.set(k, String(v)),
    removeItem: (k) => env.storage.delete(k),
  };
  const globals = {
    window: {}, localStorage, fetch, AbortController, setTimeout, clearTimeout, Promise, Date, JSON, Error, Map,
    console, encodeURIComponent, Intl,
  };
  const cache = {};
  const load = (specifier, from) => {
    if (specifier === "@/lib/supabase/client") return { createClient: () => supabase };
    let resolved = specifier.startsWith("@/") ? path.join(ROOT, "src", specifier.slice(2)) : path.resolve(path.dirname(from), specifier);
    resolved = [resolved, `${resolved}.ts`].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    if (!resolved) throw new Error(`Cannot resolve ${specifier}`);
    if (cache[resolved]) return cache[resolved];
    const exports = (cache[resolved] = {});
    const source = ts.transpileModule(fs.readFileSync(resolved, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    vm.runInNewContext(source, { ...globals, exports, require: (name) => load(name, resolved) });
    return exports;
  };
  env.load = (name) => load(`@/services/${name}`, ROOT);
  return env;
}

const announcements = (label) => ({ status: 200, body: { data: [{ id: label, title: label, content: "", priority: "normal", created_at: "2026-10-20", target_company_id: null }] } });

test("avisos em paralelo para a mesma conta fazem uma só requisição, sem cache buster", async () => {
  const env = createEnv({ routes: { "/api/announcements": () => announcements("a1") } });
  const { getAnnouncements } = env.load("announcementsService");
  const [x, y] = await Promise.all([getAnnouncements("c1"), getAnnouncements("c1")]);
  assert.equal(env.fetches.length, 1);
  assert.equal(env.fetches[0].url, "/api/announcements?company_id=c1");
  assert.equal(x.data[0].id, "a1");
  assert.equal(y.data[0].id, "a1");
  assert.equal(x.fromCache, false);
});

test("falha de autorização da API não cai para consulta direta ao Supabase", async () => {
  const env = createEnv({ routes: { "/api/announcements": { status: 401 }, "/api/media": { status: 403 }, "/api/schedule": { status: 401 } } });
  const notices = await env.load("announcementsService").getAnnouncements("c1");
  const photos = await env.load("mediaService").getFeaturedPhotos();
  const schedule = await env.load("scheduleService").getSchedule();
  assert.equal(env.queries.length, 0, "nenhuma consulta direta ao banco");
  assert.deepEqual([notices.fromCache, photos.fromCache, schedule.fromCache], [true, true, true]);
  assert.ok(schedule.data.length > 0, "agenda oficial estática continua disponível");
});

test("sem rede, serviço usa o armazenamento offline sem tentar o Supabase", async () => {
  const env = createEnv({ routes: { "/api/media": new TypeError("Failed to fetch") } });
  env.storage.set("fsy_offline_featured_photos", JSON.stringify([{ id: "p-offline", visible: true }]));
  const { data, fromCache } = await env.load("mediaService").getFeaturedPhotos();
  assert.equal(env.queries.length, 0);
  assert.equal(fromCache, true);
  assert.equal(data[0].id, "p-offline");
});

test("erro do servidor (5xx) ainda permite um único fallback direto", async () => {
  const env = createEnv({
    routes: { "/api/announcements": { status: 503 } },
    tables: { announcements: { data: [{ id: "db-1", title: "db", content: "", priority: "normal", created_at: "x" }], error: null } },
  });
  const { getAnnouncements } = env.load("announcementsService");
  const [x, y] = await Promise.all([getAnnouncements("c1"), getAnnouncements("c1")]);
  assert.equal(env.queries.length, 1);
  assert.equal(x.data[0].id, "db-1");
  assert.equal(y.data[0].id, "db-1");
});

test("contas diferentes não reaproveitam avisos e a troca de sessão limpa o cache", async () => {
  let version = 0;
  const env = createEnv({ routes: { "/api/announcements": (call) => announcements(`${call.user}-${++version}`) } });
  const { getAnnouncements } = env.load("announcementsService");
  assert.equal((await getAnnouncements("c1")).data[0].id, "ana-1");
  assert.equal((await getAnnouncements("c1")).data[0].id, "ana-1", "reaproveita no prazo curto");
  env.signIn("bia");
  assert.equal((await getAnnouncements("c1")).data[0].id, "bia-2");
  env.signIn("ana");
  assert.equal((await getAnnouncements("c1")).data[0].id, "ana-3", "cache da sessão anterior foi descartado");
});

test("curtir um aviso invalida a lista em cache", async () => {
  let version = 0;
  const env = createEnv({
    routes: {
      "/api/announcements": () => announcements(`v${++version}`),
      "/api/announcements/like": { status: 200, body: { likes_count: 3 } },
    },
  });
  const service = env.load("announcementsService");
  await service.getAnnouncements("c1");
  const like = await service.toggleLikeAnnouncement("v1");
  assert.equal(like.likesCount, 3);
  assert.equal((await service.getAnnouncements("c1")).data[0].id, "v2");
});

test("companhia em paralelo gera uma consulta e fica isolada por conta", async () => {
  const env = createEnv({ tables: { companies: (q) => ({ data: { id: "c1", name: `Companhia de ${q.user}`, motto: null, counselors: [] }, error: null }) } });
  const { getCompany } = env.load("companyService");
  const [x, y] = await Promise.all([getCompany("c1"), getCompany("c1")]);
  assert.equal(env.queries.length, 1);
  assert.equal(x.data.name, "Companhia de ana");
  assert.equal(y.data.name, "Companhia de ana");
  assert.ok(env.queries[0].signal, "consulta pode ser cancelada");
  env.signIn("bia");
  assert.equal((await getCompany("c1")).data.name, "Companhia de bia");
});

test("agenda e fotos em paralelo deduplicam e mantêm o contrato público", async () => {
  const env = createEnv({
    routes: {
      "/api/schedule": { status: 200, body: { data: [{ id: "s1", day: "dia1", date: "2027-02-06", title: "Abertura", start_time: "08:00", end_time: "09:00", location: "", description: null, category: "Geral", is_highlight: false }] } },
      "/api/media": { status: 200, body: { data: [{ id: "p1", visible: true }, { id: "p2", visible: false }] } },
    },
  });
  const schedule = env.load("scheduleService");
  const media = env.load("mediaService");
  const [a, b, p, q] = await Promise.all([schedule.getSchedule(), schedule.getSchedule("all"), media.getFeaturedPhotos(), media.getFeaturedPhotos()]);
  assert.equal(env.fetches.filter((f) => f.url.startsWith("/api/schedule")).length, 1);
  assert.equal(env.fetches.filter((f) => f.url.startsWith("/api/media")).length, 1);
  assert.ok(env.fetches.every((f) => !f.url.includes("_t=")));
  assert.equal(a.data[0].id, "s1");
  assert.equal(b.fromCache, false);
  assert.deepEqual(p.data.map((x) => x.id), ["p1"]);
  assert.deepEqual(q.data.map((x) => x.id), ["p1"]);
  assert.equal(typeof schedule.calculateActiveAndNextEvents, "function");
});

test("cancelar o painel aborta as quatro leituras em voo sem fallback remoto", async () => {
  const pending = (call) => new Promise((resolve, reject) => {
    call.init.signal.addEventListener("abort", () => reject(new Error("Abortado")), { once: true });
  });
  const env = createEnv({
    routes: { "/api/schedule": pending, "/api/media": pending, "/api/announcements": pending },
    tables: { companies: (query) => new Promise((resolve) => {
      query.signal.addEventListener("abort", () => resolve({ data: null, error: new Error("Abortado") }), { once: true });
    }) },
  });
  const controller = new AbortController();
  const calls = [
    env.load("scheduleService").getSchedule(undefined, controller.signal),
    env.load("mediaService").getFeaturedPhotos(controller.signal),
    env.load("announcementsService").getAnnouncements("c1", controller.signal),
    env.load("companyService").getCompany("c1", controller.signal),
  ];
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(env.fetches.length, 3);
  assert.equal(env.queries.length, 1);
  controller.abort();
  await Promise.all(calls);
  assert.ok(env.fetches.every((call) => call.init.signal.aborted));
  assert.ok(env.queries[0].signal.aborted);
  assert.equal(env.queries.length, 1, "cancelamento não dispara fallback ao banco");
});
