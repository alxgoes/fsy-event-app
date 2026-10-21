const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createFakeDb, loadRoute, request } = require('./helpers/route-harness.cjs');

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_test';

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt = (claims) => `${b64url({ alg: 'HS256' })}.${b64url(claims)}.assinatura`;
const plain = (v) => JSON.parse(JSON.stringify(v));
const now = () => Math.floor(Date.now() / 1000);

function setup({ profile = { role: 'logistica', suspended_at: null }, user = { id: 'u-log', email: 'log@fsy.test' }, verifiedId = 'u-log', linkFails = false, verifyFails = false } = {}) {
  const seen = { getUser: [], links: [], verify: [], cookies: [], signOut: [] };
  const db = createFakeDb({ profiles: () => ({ data: profile, error: profile ? null : { code: 'PGRST116' } }) });
  db.auth = {
    getUser: async (token) => { seen.getUser.push(token); return user ? { data: { user }, error: null } : { data: { user: null }, error: { code: 'bad_jwt' } }; },
    signOut: async (args) => { seen.signOut.push(args); return { error: null }; },
    admin: { generateLink: async (args) => { seen.links.push(args); return linkFails ? { data: null, error: { code: 'user_not_found' } } : { data: { properties: { hashed_token: 'hash-1' } }, error: null }; } },
  };
  const ssr = {
    createServerClient: (url, key, { cookies }) => ({
      auth: {
        verifyOtp: async (args) => {
          seen.verify.push({ url, key, ...args });
          if (verifyFails) return { data: { user: null }, error: { code: 'otp_expired' } };
          cookies.setAll([{ name: 'sb-proj-auth-token', value: 'base64-sessao-web', options: { path: '/', sameSite: 'lax', maxAge: 100 } }]);
          return { data: { user: { id: verifiedId } }, error: null };
        },
      },
    }),
  };
  const nextServer = {
    NextResponse: {
      json: (body, options = {}) => ({
        body, status: options.status ?? 200, headers: options.headers ?? {},
        cookies: { set: (name, value, opts) => seen.cookies.push({ name, value, opts }) },
      }),
    },
  };
  const route = loadRoute('src/app/api/auth/native-session/route.ts', { db, extraModules: { '@supabase/ssr': ssr, 'next/server': nextServer } });
  const call = (headers, method = 'POST') => route[method](request('/api/auth/native-session', { method, headers: { origin: undefined, ...headers } }));
  return { call, seen, db };
}

test('fresh app token opens an independent web session as cookies only', async () => {
  const { call, seen } = setup();
  const token = jwt({ sub: 'u-log', iat: now() - 10 });
  const res = await call({ authorization: `Bearer ${token}` });
  assert.equal(res.status, 200);
  assert.deepEqual(plain(res.body), { success: true });
  assert.match(res.headers['Cache-Control'], /private/);
  assert.match(res.headers['Cache-Control'], /no-store/);
  assert.deepEqual(seen.getUser, [token]);
  assert.deepEqual(plain(seen.links), [{ type: 'magiclink', email: 'log@fsy.test' }]);
  assert.equal(seen.verify[0].token_hash, 'hash-1');
  assert.equal(seen.verify[0].key, 'sb_publishable_test');
  assert.deepEqual(seen.cookies.map((c) => c.name), ['sb-proj-auth-token']);
  assert.equal(JSON.stringify(res.body).includes(token), false);
});

test('missing, malformed or stale bearer never reaches Auth', async () => {
  for (const authorization of [undefined, 'Basic abc', 'Bearer nao-e-jwt', `Bearer ${jwt({ sub: 'u', iat: now() - 3600 })}`, `Bearer ${jwt({ sub: 'u' })}`]) {
    const { call, seen } = setup();
    const res = await call(authorization ? { authorization } : {});
    assert.equal(res.status, 401, String(authorization));
    assert.equal(seen.getUser.length + seen.links.length + seen.cookies.length, 0);
  }
});

test('foreign origin is refused by the route itself, before Auth', async () => {
  const { call, seen } = setup();
  const res = await call({ origin: 'https://atacante.test', authorization: `Bearer ${jwt({ sub: 'u-log', iat: now() })}` });
  assert.equal(res.status, 403);
  assert.equal(seen.getUser.length + seen.cookies.length, 0);
});

test('expired or revoked JWT rejected by Auth gets no session', async () => {
  // iat recente mas o Auth recusa (exp vencido, sessão revogada ou assinatura inválida).
  const { call, seen } = setup({ user: null });
  const res = await call({ authorization: `Bearer ${jwt({ sub: 'u-log', iat: now() - 30, exp: now() - 1 })}` });
  assert.equal(res.status, 401);
  assert.match(res.headers['Cache-Control'], /private, no-store/);
  assert.equal(seen.links.length + seen.cookies.length, 0);
});

test('closing the panel revokes only the web session (local scope), privately', async () => {
  const { call, seen, db } = setup();
  const res = await call({}, 'DELETE');
  assert.equal(res.status, 200);
  assert.deepEqual(plain(seen.signOut), [{ scope: 'local' }]);
  assert.match(res.headers['Cache-Control'], /private, no-store/);
  assert.equal(seen.links.length + seen.getUser.length, 0);
  assert.equal(db.calls.length, 0);
  const foreign = await call({ origin: 'https://atacante.test' }, 'DELETE');
  assert.equal(foreign.status, 403);
  assert.equal(seen.signOut.length, 1);
});

test('invalid token, suspended or missing profile get no session', async () => {
  const fresh = { authorization: `Bearer ${jwt({ sub: 'u-log', iat: now() })}` };
  for (const [options, status] of [[{ user: null }, 401], [{ profile: { role: 'logistica', suspended_at: '2026-10-20T00:00:00Z' } }, 403], [{ profile: null }, 403]]) {
    const { call, seen } = setup(options);
    const res = await call(fresh);
    assert.equal(res.status, status);
    assert.equal(seen.links.length + seen.cookies.length, 0);
  }
});

test('session for another user is refused', async () => {
  const { call, seen } = setup({ verifiedId: 'outra-pessoa' });
  const res = await call({ authorization: `Bearer ${jwt({ sub: 'u-log', iat: now() })}` });
  assert.equal(res.status, 500);
  assert.equal(seen.cookies.length, 0);
});

test('native user agent token only marks the iOS app context', () => {
  const contract = loadRoute('src/types/native-session.ts');
  assert.equal(contract.isNativeAppUserAgent('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 FSYiOSApp/1'), true);
  for (const ua of ['Mozilla/5.0 (iPhone) Safari/604.1', 'XFSYiOSApp/1', 'FSYiOSApp', '', null]) {
    assert.equal(contract.isNativeAppUserAgent(ua), false, String(ua));
  }
});

test('announcement author embed names the author_id relationship', () => {
  const fs = require('node:fs');
  for (const file of ['src/app/api/announcements/route.ts', 'src/components/admin/AnnouncementsManager.tsx']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /profiles!author_id\(/, file);
    assert.equal(/[^!]profiles\(full_name/.test(source.replace(/profiles!author_id\(/g, '')), false, file);
  }
});

test('generateLink or verifyOtp failures return a generic error without cookies', async () => {
  for (const options of [{ linkFails: true }, { verifyFails: true }]) {
    const { call, seen } = setup(options);
    const res = await call({ authorization: `Bearer ${jwt({ sub: 'u-log', iat: now() })}` });
    assert.equal(res.status, 500, JSON.stringify(options));
    assert.deepEqual(plain(res.body), { error: 'Não foi possível abrir o painel. Tente novamente.' });
    assert.match(res.headers['Cache-Control'], /private, no-store/);
    assert.equal(seen.cookies.length, 0);
  }
});

test('per-user limit stops session minting after 20 openings in the window', async () => {
  const { call, seen } = setup();
  const headers = { authorization: `Bearer ${jwt({ sub: 'u-log', iat: now() })}` };
  for (let i = 0; i < 20; i += 1) assert.equal((await call(headers)).status, 200);
  const limited = await call(headers);
  assert.equal(limited.status, 429);
  assert.equal(seen.links.length, 20);
  assert.equal(seen.cookies.length, 20);
});
