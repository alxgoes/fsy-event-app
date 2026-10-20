const assert = require('node:assert/strict');
const { test } = require('node:test');
// Valores criados dentro do vm têm outro realm; compara pela forma serializada.
const plain = (v) => JSON.parse(JSON.stringify(v));
const { loadRoute, createFakeDb, request } = require('./helpers/route-harness.cjs');

const U = (n) => `40000000-0000-4000-8000-00000000000${n}`;
const people = () => ([
  { id: U(1), full_name: 'Diretora', role: 'casal_diretor', company_id: null, email: 'dir@fsy.test', providers: ['email'] },
  { id: U(2), full_name: 'Coord', role: 'coordenador', company_id: null, email: 'coord@fsy.test', providers: ['email'] },
  { id: U(3), full_name: 'Logística', role: 'logistica', company_id: null, email: 'log@fsy.test', providers: ['email'] },
  { id: U(4), full_name: 'Jovem Google', role: 'jovem', company_id: 'cia-1', email: 'jovem@gmail.test', providers: ['google'] },
  { id: U(5), full_name: 'Jovem Autor', role: 'jovem', company_id: 'cia-1', email: 'autor@fsy.test', providers: ['email'] },
]);

function world({ actor = U(1), blocking = {} } = {}) {
  const list = people();
  const authUsers = list.map((p) => ({ id: p.id, email: p.email, app_metadata: { providers: p.providers }, identities: p.providers.map((provider) => ({ provider })), created_at: '2026-09-01T00:00:00Z', email_confirmed_at: '2026-09-01T00:00:00Z', last_sign_in_at: null, banned_until: null }));
  const adminCalls = [];
  const events = [];
  const filterRows = (rows, call) => call.filters.reduce((acc, [f, col, v]) => {
    if (f === 'eq') return acc.filter((r) => r[col] === v);
    if (f === 'in') return acc.filter((r) => v.includes(r[col]));
    if (f === 'is') return acc.filter((r) => (v === null ? r[col] == null : r[col] === v));
    return acc;
  }, rows);
  const db = createFakeDb({
    profiles: (call) => {
      const rows = filterRows(list, call);
      if (call.ops.includes('update')) { rows.forEach((r) => Object.assign(r, call.payload)); return { data: call.single ? rows[0] ?? null : rows, error: null }; }
      return { data: call.single ? rows[0] ?? null : rows, error: null, count: rows.length };
    },
    companies: { data: [{ id: 'cia-1', name: 'Companhia 1' }], error: null },
    admin_account_events: (call) => { if (call.ops.includes('insert')) events.push(call.payload); return { data: events, error: null }; },
    inclusion_history: (call) => ({ data: [], error: null, count: blocking.inclusion_history ?? 0 }),
    inclusion_cases: () => ({ data: [], error: null, count: blocking.inclusion_cases ?? 0 }),
    inclusion_interviews: () => ({ data: [], error: null, count: 0 }),
    media_photos: () => ({ data: [], error: null, count: 0 }),
    medical_appointments: () => ({ data: [], error: null, count: 0 }),
  });
  db.auth.admin = {
    listUsers: async ({ page }) => ({ data: { users: page === 1 ? authUsers : [] }, error: null }),
    getUserById: async (id) => ({ data: { user: authUsers.find((u) => u.id === id) ?? null }, error: null }),
    updateUserById: async (id, attrs) => { adminCalls.push({ fn: 'update', id, attrs }); return { data: { user: { id } }, error: null }; },
    deleteUser: async (id) => { adminCalls.push({ fn: 'delete', id }); return { data: {}, error: null }; },
  };
  const me = list.find((p) => p.id === actor);
  const identity = { user: { id: me.id, email: me.email }, role: me.role, fullName: me.full_name };
  const sentRecovery = [];
  const sentEmail = [];
  const extraModules = {
    '@/lib/auth/recovery': { sendRecoveryEmail: async (email, origin) => { sentRecovery.push({ email, origin }); return { ok: true }; } },
    '@/lib/email/send': { sendTransactionalEmail: async (msg) => { sentEmail.push(msg); return { status: 'accepted', id: 'msg-1' }; } },
  };
  const load = (file) => loadRoute(file, { identity, db, extraModules });
  return { list, db, adminCalls, events, sentRecovery, sentEmail, load };
}

const LIST = 'src/app/api/admin/accounts/route.ts';
const ONE = 'src/app/api/admin/accounts/[id]/route.ts';
const RECOVERY = 'src/app/api/admin/accounts/[id]/recovery/route.ts';
const PASSWORD = 'src/app/api/admin/accounts/[id]/password/route.ts';
const EMAIL = 'src/app/api/admin/accounts/[id]/email/route.ts';
const ctx = (id) => ({ params: { id } });

test('account list merges Auth data with profiles and reports providers', async () => {
  const w = world();
  const res = await w.load(LIST).GET(request('/api/admin/accounts'));
  assert.equal(res.status, 200);
  const google = res.body.data.find((a) => a.id === U(4));
  assert.deepEqual(plain(google.providers), ['google']);
  assert.equal(google.has_password, false);
  assert.equal(google.company_name, 'Companhia 1');
  assert.equal(google.status, 'ativo');
  assert.equal(res.body.total, 5);
  assert.ok(!JSON.stringify(res.body).includes('encrypted_password'));
});

test('account list is denied to participants and counselors', async () => {
  for (const actor of [U(4)]) {
    const w = world({ actor });
    assert.equal((await w.load(LIST).GET(request('/api/admin/accounts'))).status, 403);
  }
});

test('logistics cannot promote a participant to coordinator', async () => {
  const w = world({ actor: U(3) });
  const res = await w.load(ONE).PATCH(request(`/api/admin/accounts/${U(4)}`, { method: 'PATCH', body: { action: 'role', role: 'coordenador' } }), ctx(U(4)));
  assert.equal(res.status, 403);
  assert.equal(w.list.find((p) => p.id === U(4)).role, 'jovem');
});

test('coordinator cannot edit the director account', async () => {
  const w = world({ actor: U(2) });
  const res = await w.load(ONE).PATCH(request(`/api/admin/accounts/${U(1)}`, { method: 'PATCH', body: { action: 'edit', full_name: 'Xavier' } }), ctx(U(1)));
  assert.equal(res.status, 403);
});

test('role change is recorded with the server identity as author', async () => {
  const w = world({ actor: U(2) });
  const res = await w.load(ONE).PATCH(request(`/api/admin/accounts/${U(4)}`, { method: 'PATCH', body: { action: 'role', role: 'consultor' } }), ctx(U(4)));
  assert.equal(res.status, 200);
  assert.equal(w.list.find((p) => p.id === U(4)).role, 'consultor');
  assert.equal(w.events.length, 1);
  assert.equal(w.events[0].actor_id, U(2));
  assert.equal(w.events[0].action, 'role');
  assert.deepEqual(plain(w.events[0].details), { from: 'jovem', to: 'consultor' });
});

test('the last enabled administrator cannot be demoted, suspended or deleted', async () => {
  const w = world({ actor: U(1) });
  // A conta da diretora (operadora) não conta como habilitada; a coordenação é a única restante.
  w.list.find((p) => p.id === U(1)).suspended_at = '2026-10-01T00:00:00Z';
  const route = w.load(ONE);
  const demote = await route.PATCH(request(`/api/admin/accounts/${U(2)}`, { method: 'PATCH', body: { action: 'role', role: 'jovem' } }), ctx(U(2)));
  assert.equal(demote.status, 409);
  assert.match(demote.body.error, /última/);
  assert.equal((await route.PATCH(request(`/api/admin/accounts/${U(2)}`, { method: 'PATCH', body: { action: 'suspend' } }), ctx(U(2)))).status, 409);
  assert.equal((await route.DELETE(request(`/api/admin/accounts/${U(2)}`, { method: 'DELETE', body: { confirm: 'coord@fsy.test' } }), ctx(U(2)))).status, 409);
  assert.equal(w.list.find((p) => p.id === U(2)).role, 'coordenador');
  assert.equal(w.adminCalls.length, 0);
});

test('nobody suspends, deletes or changes the role of their own account', async () => {
  const w = world({ actor: U(1) });
  const route = w.load(ONE);
  assert.equal((await route.PATCH(request(`/api/admin/accounts/${U(1)}`, { method: 'PATCH', body: { action: 'suspend' } }), ctx(U(1)))).status, 409);
  assert.equal((await route.DELETE(request(`/api/admin/accounts/${U(1)}`, { method: 'DELETE', body: { confirm: 'dir@fsy.test' } }), ctx(U(1)))).status, 409);
  assert.equal(w.adminCalls.length, 0);
});

test('suspension bans in Auth, marks the profile and is reversible', async () => {
  const w = world({ actor: U(1) });
  const route = w.load(ONE);
  assert.equal((await route.PATCH(request(`/api/admin/accounts/${U(5)}`, { method: 'PATCH', body: { action: 'suspend' } }), ctx(U(5)))).status, 200);
  assert.equal(w.adminCalls[0].attrs.ban_duration, '876000h');
  assert.ok(w.list.find((p) => p.id === U(5)).suspended_at);
  assert.equal((await route.PATCH(request(`/api/admin/accounts/${U(5)}`, { method: 'PATCH', body: { action: 'reactivate' } }), ctx(U(5)))).status, 200);
  assert.equal(w.adminCalls[1].attrs.ban_duration, 'none');
  assert.equal(w.list.find((p) => p.id === U(5)).suspended_at, null);
});

test('logistics cannot suspend or delete accounts', async () => {
  const w = world({ actor: U(3) });
  const route = w.load(ONE);
  assert.equal((await route.PATCH(request(`/api/admin/accounts/${U(5)}`, { method: 'PATCH', body: { action: 'suspend' } }), ctx(U(5)))).status, 403);
  assert.equal((await route.DELETE(request(`/api/admin/accounts/${U(5)}`, { method: 'DELETE', body: { confirm: 'autor@fsy.test' } }), ctx(U(5)))).status, 403);
  assert.equal(w.adminCalls.length, 0);
});

test('deletion requires the exact target e-mail as confirmation', async () => {
  const w = world({ actor: U(1) });
  const res = await w.load(ONE).DELETE(request(`/api/admin/accounts/${U(5)}`, { method: 'DELETE', body: { confirm: 'outro@fsy.test' } }), ctx(U(5)));
  assert.equal(res.status, 400);
  assert.equal(w.adminCalls.length, 0);
});

test('deletion is refused when records that must be preserved reference the account', async () => {
  const w = world({ actor: U(1), blocking: { inclusion_history: 2 } });
  const res = await w.load(ONE).DELETE(request(`/api/admin/accounts/${U(5)}`, { method: 'DELETE', body: { confirm: 'autor@fsy.test' } }), ctx(U(5)));
  assert.equal(res.status, 409);
  assert.match(res.body.error, /Suspenda/);
  assert.equal(w.adminCalls.length, 0);
});

test('confirmed deletion removes the Auth user and audits without secrets', async () => {
  const w = world({ actor: U(1) });
  const res = await w.load(ONE).DELETE(request(`/api/admin/accounts/${U(5)}`, { method: 'DELETE', body: { confirm: 'AUTOR@fsy.test ' } }), ctx(U(5)));
  assert.equal(res.status, 200);
  assert.deepEqual(w.adminCalls[0], { fn: 'delete', id: U(5) });
  assert.equal(w.events[0].action, 'delete');
});

test('recovery e-mail goes to the account address, even for Google accounts, and is audited', async () => {
  const w = world({ actor: U(3) });
  const res = await w.load(RECOVERY).POST(request(`/api/admin/accounts/${U(4)}/recovery`, { method: 'POST', body: {} }), ctx(U(4)));
  assert.equal(res.status, 200);
  assert.deepEqual(w.sentRecovery.map((s) => s.email), ['jovem@gmail.test']);
  assert.match(res.body.message, /Google/);
  assert.equal(w.events[0].action, 'recovery_email');
});

test('administrative password reset is directors-only and never echoes or logs the password', async () => {
  const denied = world({ actor: U(3) });
  assert.equal((await denied.load(PASSWORD).POST(request(`/api/admin/accounts/${U(5)}/password`, { method: 'POST', body: { password: 'NovaSenha123' } }), ctx(U(5)))).status, 403);
  const w = world({ actor: U(2) });
  const res = await w.load(PASSWORD).POST(request(`/api/admin/accounts/${U(5)}/password`, { method: 'POST', body: { password: 'NovaSenha123' } }), ctx(U(5)));
  assert.equal(res.status, 200);
  assert.equal(w.adminCalls[0].attrs.password, 'NovaSenha123');
  assert.ok(!JSON.stringify(res.body).includes('NovaSenha123'));
  assert.ok(!JSON.stringify(w.events).includes('NovaSenha123'));
  const weak = await w.load(PASSWORD).POST(request(`/api/admin/accounts/${U(5)}/password`, { method: 'POST', body: { password: 'abcdefgh' } }), ctx(U(5)));
  assert.equal(weak.status, 400);
});

test('composed e-mail requires explicit confirmation and reports acceptance, not delivery', async () => {
  const w = world({ actor: U(2) });
  const route = w.load(EMAIL);
  const unconfirmed = await route.POST(request(`/api/admin/accounts/${U(5)}/email`, { method: 'POST', body: { subject: 'Aviso', body: 'Mensagem de teste longa.' } }), ctx(U(5)));
  assert.equal(unconfirmed.status, 400);
  assert.equal(w.sentEmail.length, 0);
  const res = await route.POST(request(`/api/admin/accounts/${U(5)}/email`, { method: 'POST', body: { subject: 'Aviso', body: 'Mensagem de teste longa.', confirm: true, to: 'outra@pessoa.test' } }), ctx(U(5)));
  assert.equal(res.status, 202);
  assert.equal(w.sentEmail[0].to, 'autor@fsy.test');
  assert.equal(res.body.status, 'accepted');
  assert.match(res.body.message, /aceit/i);
  assert.equal(w.events[0].action, 'email');
  assert.equal(w.events[0].details.subject, 'Aviso');
  assert.equal('body' in w.events[0].details, false);
});
