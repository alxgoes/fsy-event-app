// Loads TypeScript route handlers in isolation with a fake Supabase client.
// Every database call is recorded so tests can assert that denied requests
// never reach storage and that trusted identity, not the body, is persisted.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..', '..');

function createFakeDb(handlers = {}) {
  const calls = [];
  const db = {
    calls,
    from(table) {
      const call = { table, ops: [], filters: [] };
      calls.push(call);
      const builder = {
        then(resolve, reject) {
          return Promise.resolve(respond()).then(resolve, reject);
        },
      };
      const respond = () => {
        const handler = handlers[table];
        const result = typeof handler === 'function' ? handler(call) : handler;
        return result || { data: call.single ? null : [], error: null, count: 0 };
      };
      for (const op of ['select', 'insert', 'update', 'upsert', 'delete']) {
        builder[op] = (payload, options) => { call.ops.push(op); if (op !== 'select') call.payload = payload; if (options) call.options = options; return builder; };
      }
      for (const f of ['eq', 'neq', 'in', 'is', 'or', 'gte', 'lte', 'lt', 'gt', 'ilike', 'order', 'limit', 'range', 'not', 'match']) {
        builder[f] = (...args) => { call.filters.push([f, ...args]); return builder; };
      }
      builder.single = () => { call.single = true; return builder; };
      builder.maybeSingle = () => { call.single = true; return builder; };
      return builder;
    },
    rpc: async (name, payload) => {
      calls.push({ rpc: name, payload });
      const handler = handlers[`rpc:${name}`];
      return (typeof handler === 'function' ? handler(payload) : handler) || { data: null, error: null };
    },
    auth: { admin: {} },
  };
  return db;
}

function jsonResponse(body, options = {}) {
  return { body, status: options.status ?? 200, headers: options.headers ?? {} };
}

/**
 * identity: { user, role, profile? } returned by the auth guard.
 * extraModules: overrides by import specifier.
 */
function loadRoute(file, { identity = { user: null, role: null }, db = createFakeDb(), extraModules = {} } = {}) {
  const modules = {
    zod: require('zod'),
    'server-only': {},
    'next/server': { NextResponse: { json: jsonResponse, redirect: (url) => ({ status: 307, headers: { location: String(url) } }) } },
    'next/headers': { cookies: () => ({ getAll: () => [], set() {} }), headers: () => new Map() },
    '@/lib/supabase/server': {
      getCurrentUserAndRole: async () => ({ user: identity.user, role: identity.role }),
      getCurrentIdentity: async () => identity.user ? { user: identity.user, role: identity.role, profile: identity.profile ?? { id: identity.user.id, full_name: identity.fullName ?? 'Pessoa Teste', role: identity.role, company_id: identity.companyId ?? null } } : null,
      createAuthenticatedServerClient: async () => db,
    },
    '@/lib/supabase/admin': { createAdminClient: () => db },
    ...extraModules,
  };
  const cache = {};
  const load = (specifier, from) => {
    if (modules[specifier]) return modules[specifier];
    let resolved;
    if (specifier.startsWith('@/')) resolved = path.join(ROOT, 'src', specifier.slice(2));
    else if (path.isAbsolute(specifier)) resolved = specifier;
    else if (specifier.startsWith('.')) resolved = path.resolve(path.dirname(from), specifier);
    else return require(specifier);
    const candidates = [resolved, `${resolved}.ts`, `${resolved}.tsx`, path.join(resolved, 'index.ts')];
    const found = candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    if (!found) throw new Error(`Cannot resolve ${specifier} from ${from}`);
    if (cache[found]) return cache[found];
    const exports = {};
    const module = { exports };
    cache[found] = exports;
    const source = ts.transpileModule(fs.readFileSync(found, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(source, {
      exports, module, require: (name) => load(name, found), URL, URLSearchParams, console, process, Date, Math, JSON, Promise, setTimeout, clearTimeout, crypto: globalThis.crypto, TextEncoder, Response, Headers, fetch: (...args) => globalThis.fetch(...args),
    });
    if (module.exports !== exports) Object.assign(cache[found], module.exports);
    return cache[found];
  };
  return load(path.join(ROOT, file), ROOT);
}

function request(url, { method = 'GET', body, headers = {} } = {}) {
  const h = new Map(Object.entries({ 'content-type': 'application/json', origin: 'https://fsy.test', host: 'fsy.test', ...headers }));
  return {
    url: url.startsWith('http') ? url : `https://fsy.test${url}`,
    method,
    headers: { get: (k) => h.get(k.toLowerCase()) ?? null },
    json: async () => { if (body === undefined) throw new SyntaxError('no body'); return body; },
  };
}

const mutations = (db) => db.calls.filter((c) => c.rpc || c.ops?.some((op) => op !== 'select'));

module.exports = { createFakeDb, loadRoute, request, mutations };
