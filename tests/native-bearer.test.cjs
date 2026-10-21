// Autenticação Bearer do app iOS nas mesmas APIs do site: validação no Auth, falha fechada sem cair no
// cookie, cargo/suspensão lidos do banco, respostas privadas e nenhum token em log.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createFakeDb, loadRoute, request } = require('./helpers/route-harness.cjs');

const plain = (v) => JSON.parse(JSON.stringify(v));
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LWxvZyJ9.assinatura-do-app';
const bearer = loadRoute('src/lib/auth/bearer.ts');

/** Carrega server.ts com cabeçalho Authorization, sessão de cookie e Auth/banco falsos. */
function server({ authorization = null, tokenUser = { id: 'u-log', email: 'log@fsy.test' }, cookieUser = { id: 'u-cookie' }, profiles = {} } = {}) {
  const seen = { tokenChecks: [], cookieChecks: 0, clients: [], profileReads: [] };
  const admin = {
    auth: { getUser: async (token) => { seen.tokenChecks.push(token); return tokenUser ? { data: { user: tokenUser }, error: null } : { data: { user: null }, error: { code: 'bad_jwt' } }; } },
    from: () => {
      let id;
      const builder = { select: () => builder, eq: (_c, value) => { id = value; return builder; }, single: async () => { seen.profileReads.push(id); const row = profiles[id]; return row ? { data: { id, full_name: 'Pessoa', company_id: null, suspended_at: null, ...row }, error: null } : { data: null, error: { code: 'PGRST116' } }; } };
      return builder;
    },
  };
  const ssr = {
    createServerClient: (_url, _key, options) => {
      seen.clients.push(options);
      return { auth: { getUser: async () => { seen.cookieChecks++; return { data: { user: cookieUser }, error: null }; } } };
    },
  };
  const headerMap = new Map(authorization === null ? [] : [['authorization', authorization]]);
  const mod = loadRoute('src/lib/supabase/server.ts', {
    extraModules: {
      '@supabase/ssr': ssr,
      '@/lib/supabase/admin': { createAdminClient: () => admin },
      'next/headers': { cookies: async () => ({ getAll: () => [{ name: 'sb', value: 'cookie' }], set() {} }), headers: async () => headerMap },
    },
  });
  return { mod, seen };
}

test('parser accepts only well-formed Bearer JWTs', () => {
  assert.deepEqual(plain(bearer.parseAuthorization(null)), { kind: 'none' });
  assert.deepEqual(plain(bearer.parseAuthorization(`Bearer ${TOKEN}`)), { kind: 'bearer', token: TOKEN });
  for (const value of ['', ' ', '   ', 'Basic abc', 'Bearer', 'Bearer abc', `bearer ${TOKEN}`, `Bearer ${TOKEN} extra`]) {
    assert.equal(bearer.parseAuthorization(value).kind, 'invalid', value);
  }
  assert.equal(bearer.isBearerApiPath('/api/admin/accounts'), true);
  assert.equal(bearer.isBearerApiPath('/api/medical/appointments'), true);
  for (const path of ['/api/auth/register', '/api/auth/recover', '/api/instagram', '/api/administrador', '/admin']) {
    assert.equal(bearer.isBearerApiPath(path), false, path);
  }
});

test('valid Bearer resolves identity from the database, never from the cookie', async () => {
  const { mod, seen } = server({ authorization: `Bearer ${TOKEN}`, profiles: { 'u-log': { role: 'logistica' } } });
  const identity = await mod.getCurrentIdentity();
  assert.equal(identity.user.id, 'u-log');
  assert.equal(identity.role, 'logistica');
  assert.deepEqual(seen.tokenChecks, [TOKEN]);
  assert.equal(seen.cookieChecks, 0);
  const pair = await mod.getCurrentUserAndRole();
  assert.equal(pair.role, 'logistica');
});

test('invalid, expired or revoked Bearer fails closed even with a valid cookie', async () => {
  for (const authorization of [`Bearer ${TOKEN}`, 'Basic abc', 'Bearer nao-e-jwt', '', '   ']) {
    const { mod, seen } = server({ authorization, tokenUser: null, profiles: { 'u-cookie': { role: 'coordenador' } } });
    assert.equal(await mod.getCurrentIdentity(), null, authorization);
    assert.equal((await mod.getCurrentUserAndRole()).user, null, authorization);
    assert.equal(seen.cookieChecks, 0, authorization);
    assert.equal(seen.profileReads.length, 0, authorization);
  }
});

test('suspended or profile-less Bearer user gets nothing; JWT/metadata roles are ignored', async () => {
  const tokenUser = { id: 'u-log', user_metadata: { role: 'coordenador' }, app_metadata: { role: 'casal_diretor' } };
  const suspended = server({ authorization: `Bearer ${TOKEN}`, tokenUser, profiles: { 'u-log': { role: 'logistica', suspended_at: '2026-10-20T00:00:00Z' } } });
  assert.equal(await suspended.mod.getCurrentIdentity(), null);
  assert.equal((await suspended.mod.getCurrentUserAndRole()).role, null);
  const missing = server({ authorization: `Bearer ${TOKEN}`, tokenUser });
  assert.equal(await missing.mod.getCurrentIdentity(), null);
  const youth = server({ authorization: `Bearer ${TOKEN}`, tokenUser, profiles: { 'u-log': { role: 'jovem' } } });
  assert.equal((await youth.mod.getCurrentIdentity()).role, 'jovem');
});

test('without Authorization the site cookie flow is unchanged', async () => {
  const { mod, seen } = server({ profiles: { 'u-cookie': { role: 'medico' } } });
  assert.equal((await mod.getCurrentIdentity()).role, 'medico');
  assert.equal(seen.tokenChecks.length, 0);
  assert.equal(seen.cookieChecks, 1);
});

test('database client for a Bearer request carries only that token, no cookies', async () => {
  const { mod, seen } = server({ authorization: `Bearer ${TOKEN}` });
  await mod.createAuthenticatedServerClient();
  const options = seen.clients.at(-1);
  assert.deepEqual(plain(options.global), { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.deepEqual(plain(options.cookies.getAll()), []);
  const invalid = server({ authorization: 'Basic abc' });
  await invalid.mod.createAuthenticatedServerClient();
  assert.equal(invalid.seen.clients.at(-1).global, undefined);
  assert.deepEqual(plain(invalid.seen.clients.at(-1).cookies.getAll()), []);
});

/** Proxy com verificador de token falso. */
function proxy({ tokenValid = true, cookieUser = null } = {}) {
  const seen = { verified: [], cookieChecks: 0 };
  const ssr = {
    createServerClient: () => ({
      auth: {
        getUser: async (token) => {
          if (token) { seen.verified.push(token); return tokenValid ? { data: { user: { id: 'u-log' } }, error: null } : { data: { user: null }, error: { code: 'bad_jwt' } }; }
          seen.cookieChecks++;
          return { data: { user: cookieUser } };
        },
      },
      from: () => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: { role: 'logistica' } }) }),
    }),
  };
  const nextServer = {
    NextResponse: {
      next: () => ({ kind: 'next', status: 200, cookies: { set() {} } }),
      json: (body, options = {}) => ({ kind: 'json', body, status: options.status ?? 200, headers: options.headers ?? {} }),
      redirect: (url) => ({ kind: 'redirect', status: 307, url: String(url.pathname ?? url) }),
    },
  };
  const { proxy: run } = loadRoute('src/proxy.ts', { extraModules: { '@supabase/ssr': ssr, 'next/server': nextServer } });
  const call = (pathname, { method = 'GET', headers = {} } = {}) => {
    const h = new Map(Object.entries(headers));
    return run({
      method,
      headers: { get: (k) => h.get(k.toLowerCase()) ?? null },
      cookies: { getAll: () => [], set() {} },
      nextUrl: { pathname, clone: () => ({ pathname, searchParams: new URLSearchParams() }) },
    });
  };
  return { call, seen };
}

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_test';

test('proxy lets a verified Bearer reach allowed APIs without touching cookies', async () => {
  const { call, seen } = proxy();
  const res = await call('/api/admin/accounts', { headers: { authorization: `Bearer ${TOKEN}` } });
  assert.equal(res.kind, 'next');
  assert.deepEqual(seen.verified, [TOKEN]);
  assert.equal(seen.cookieChecks, 0);
  const write = await call('/api/schedule', { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` } });
  assert.equal(write.kind, 'next');
});

test('proxy refuses invalid, rejected or out-of-scope Bearer with a private 401', async () => {
  for (const [path, authorization, valid] of [
    ['/api/admin/accounts', 'Basic abc', true],
    ['/api/admin/accounts', '', true],
    ['/api/medical', '  ', true],
    ['/api/admin/accounts', `Bearer ${TOKEN}`, false],
    ['/api/auth/register', `Bearer ${TOKEN}`, true],
  ]) {
    const { call, seen } = proxy({ tokenValid: valid, cookieUser: { id: 'cookie-user' } });
    const res = await call(path, { headers: { authorization } });
    assert.equal(res.status, 401, `${path} ${authorization}`);
    assert.match(res.headers['Cache-Control'], /private, no-store/);
    assert.equal(seen.cookieChecks, 0);
  }
});

test('proxy keeps browser origin protection for Bearer mutations', async () => {
  const { call, seen } = proxy();
  const res = await call('/api/schedule', { method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, origin: 'https://atacante.test', host: 'fsy-event-app.vercel.app' } });
  assert.equal(res.status, 403);
  assert.equal(seen.verified.length, 0);
});

test('tokens never reach logs on any rejection path', async () => {
  const lines = [];
  const original = { error: console.error, log: console.log, warn: console.warn };
  for (const k of Object.keys(original)) console[k] = (...args) => lines.push(args.map(String).join(' '));
  try {
    await server({ authorization: `Bearer ${TOKEN}`, tokenUser: null }).mod.getCurrentIdentity();
    await proxy({ tokenValid: false }).call('/api/admin/accounts', { headers: { authorization: `Bearer ${TOKEN}` } });
  } finally {
    Object.assign(console, original);
  }
  assert.equal(lines.some((line) => line.includes(TOKEN) || line.includes('assinatura-do-app')), false);
});

test('overview: management roles get counts only, others are refused, response is private', async () => {
  const db = createFakeDb({
    profiles: { data: [{ role: 'jovem', company_id: 'cia-1', room: '12' }, { role: null, company_id: null, room: null }, { role: 'consultor', company_id: 'cia-1', room: null }], error: null },
    companies: { data: null, error: null, count: 4 },
    medical_records: { data: null, error: null, count: 7 },
    announcements: { data: [{ id: 'a1', title: 'Aviso', priority: 'urgent', category: 'Geral', created_at: '2026-10-20T10:00:00Z' }], error: null, count: 9 },
    media_photos: { data: null, error: null, count: 3 },
  });
  for (const role of ['logistica', 'coordenador', 'casal_diretor']) {
    const route = loadRoute('src/app/api/admin/overview/route.ts', { identity: { user: { id: 'u' }, role }, db });
    const res = await route.GET(request('/api/admin/overview'));
    assert.equal(res.status, 200, role);
    assert.match(res.headers['Cache-Control'], /private, no-store/);
    const body = plain(res.body);
    assert.deepEqual([body.total_youth, body.youth_with_company, body.youth_with_room, body.total_counselors], [2, 1, 1, 1]);
    assert.deepEqual([body.total_companies, body.medical_records, body.total_announcements, body.total_photos], [4, 7, 9, 3]);
    assert.equal(JSON.stringify(body).includes('allerg'), false);
  }
  for (const role of ['jovem', 'consultor', 'midia', 'medico']) {
    const route = loadRoute('src/app/api/admin/overview/route.ts', { identity: { user: { id: 'u' }, role }, db: createFakeDb() });
    assert.equal((await route.GET(request('/api/admin/overview'))).status, 403, role);
  }
  const anonymous = loadRoute('src/app/api/admin/overview/route.ts');
  assert.equal((await anonymous.GET(request('/api/admin/overview'))).status, 401);
});

test('health, audit and account listings answer private no-store', async () => {
  const db = createFakeDb({ medical_records: { data: [], error: null } });
  const medical = loadRoute('src/app/api/medical/route.ts', { identity: { user: { id: 'u' }, role: 'logistica' }, db });
  const res = await medical.GET(request('/api/medical'));
  assert.match(res.headers['Cache-Control'], /private, no-store/);
  const denied = loadRoute('src/app/api/medical/route.ts', { identity: { user: { id: 'u' }, role: 'jovem' }, db });
  const refused = await denied.GET(request('/api/medical'));
  assert.ok([401, 403].includes(refused.status));
  assert.match(refused.headers['Cache-Control'], /private, no-store/);
});
