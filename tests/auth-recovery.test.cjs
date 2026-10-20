const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadRoute, request } = require('./helpers/route-harness.cjs');

function recoverRoute() {
  const sent = [];
  const route = loadRoute('src/app/api/auth/recover/route.ts', {
    extraModules: {
      '@/lib/auth/recovery': {
        sendRecoveryEmail: async (email, origin) => { sent.push({ email, origin }); return { ok: true }; },
      },
    },
  });
  return { route, sent };
}

const post = (body, headers) => request('/api/auth/recover', { method: 'POST', body, headers });

test('recovery answers with the same neutral message for any e-mail', async () => {
  const { route, sent } = recoverRoute();
  const a = await route.POST(post({ email: 'existe@fsy.test' }, { 'x-forwarded-for': '1.1.1.1' }));
  const b = await route.POST(post({ email: 'naoexiste@fsy.test' }, { 'x-forwarded-for': '1.1.1.2' }));
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, b.body);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].origin, 'https://fsy.test');
});

test('recovery rejects malformed e-mail without calling the provider', async () => {
  const { route, sent } = recoverRoute();
  const res = await route.POST(post({ email: 'nao-e-email' }, { 'x-forwarded-for': '1.1.1.3' }));
  assert.equal(res.status, 400);
  assert.equal(sent.length, 0);
});

test('recovery is rate limited per address and per client', async () => {
  const { route, sent } = recoverRoute();
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await route.POST(post({ email: 'repetido@fsy.test' }, { 'x-forwarded-for': '9.9.9.9' }))).status);
  assert.deepEqual(statuses.slice(0, 3), [200, 200, 200]);
  assert.equal(statuses[4], 429);
  assert.ok(sent.length <= 3);
});

test('recovery refuses cross-origin posts', async () => {
  const { route, sent } = recoverRoute();
  const res = await route.POST(post({ email: 'a@fsy.test' }, { origin: 'https://evil.test', 'x-forwarded-for': '7.7.7.7' }));
  assert.equal(res.status, 403);
  assert.equal(sent.length, 0);
});

test('origin helper accepts same host and rejects foreign origins', () => {
  const { isSameOriginRequest } = loadRoute('src/lib/security/origin.ts');
  const req = (origin, host = 'fsy.test') => ({ headers: { get: (k) => ({ origin, host }[k] ?? null) } });
  assert.equal(isSameOriginRequest(req('https://fsy.test')), true);
  assert.equal(isSameOriginRequest(req(null)), true, 'same-origin fetches may omit Origin on GET-like flows');
  assert.equal(isSameOriginRequest(req('https://evil.test')), false);
  assert.equal(isSameOriginRequest(req('https://fsy.test.evil.test')), false);
  assert.equal(isSameOriginRequest(req('null')), false);
});

test('rate limiter forgets entries after the window', () => {
  const { createRateLimiter } = loadRoute('src/lib/security/rate-limit.ts');
  let now = 0;
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
  assert.equal(limiter.hit('k'), true);
  assert.equal(limiter.hit('k'), true);
  assert.equal(limiter.hit('k'), false);
  now = 1001;
  assert.equal(limiter.hit('k'), true);
});
