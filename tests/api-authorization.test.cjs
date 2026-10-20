const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadRoute, createFakeDb, request, mutations } = require('./helpers/route-harness.cjs');

const ANON = { user: null, role: null };
const jovem = (companyId = 'cia-1') => ({ user: { id: 'u-jovem', email: 'jovem@fsy.test' }, role: 'jovem', companyId, fullName: 'Jovem Teste' });
const consultor = (companyId = 'cia-1') => ({ user: { id: 'u-cons', email: 'c@fsy.test' }, role: 'consultor', companyId, fullName: 'Consultora Real' });
const midia = { user: { id: 'u-midia' }, role: 'midia', fullName: 'Equipe Mídia' };
const coord = { user: { id: 'u-coord' }, role: 'coordenador', fullName: 'Coordenação' };
const UUID = '123e4567-e89b-42d3-a456-426614174000';

async function call(file, method, identity, url, body, db = createFakeDb()) {
  const route = loadRoute(file, { identity, db });
  const res = await route[method](request(url, { method, body }));
  return { res, db };
}

const adminMutations = [
  ['src/app/api/media/route.ts', 'POST', '/api/media', { title: 'Foto', drive_url: 'https://drive.google.com/file/d/abc/view' }],
  ['src/app/api/media/route.ts', 'PUT', '/api/media', { id: UUID, visible: false }],
  ['src/app/api/media/route.ts', 'DELETE', `/api/media?id=${UUID}`],
  ['src/app/api/companies/route.ts', 'POST', '/api/companies', { name: 'Nova' }],
  ['src/app/api/companies/route.ts', 'DELETE', '/api/companies?id=cia-1'],
  ['src/app/api/schedule/route.ts', 'POST', '/api/schedule', { action: 'seed', overwrite: true }],
  ['src/app/api/schedule/route.ts', 'PUT', '/api/schedule', { id: UUID, title: 'X' }],
  ['src/app/api/schedule/route.ts', 'DELETE', `/api/schedule?id=${UUID}`],
  ['src/app/api/logistics/route.ts', 'POST', '/api/logistics', { bus_number: '1', stake_city: 'A', driver_name: 'B' }],
  ['src/app/api/logistics/route.ts', 'PUT', '/api/logistics', { id: UUID, status: 'chegou' }],
  ['src/app/api/logistics/route.ts', 'DELETE', `/api/logistics?id=${UUID}`],
  ['src/app/api/announcements/route.ts', 'PUT', '/api/announcements', { id: UUID, title: 'X' }],
];

test('administrative mutations reject anonymous callers with 401 before storage', async () => {
  for (const [file, method, url, body] of adminMutations) {
    const { res, db } = await call(file, method, ANON, url, body);
    assert.equal(res.status, 401, `${method} ${file}`);
    assert.equal(mutations(db).length, 0, `${method} ${file} touched storage`);
  }
});

test('administrative mutations reject participants with 403 before storage', async () => {
  for (const [file, method, url, body] of adminMutations) {
    const { res, db } = await call(file, method, jovem(), url, body);
    assert.equal(res.status, 403, `${method} ${file}`);
    assert.equal(mutations(db).length, 0, `${method} ${file} touched storage`);
  }
});

test('media GET requires a session and hidden photos require a media manager', async () => {
  assert.equal((await call('src/app/api/media/route.ts', 'GET', ANON, '/api/media')).res.status, 401);
  const { res } = await call('src/app/api/media/route.ts', 'GET', jovem(), '/api/media?all=true');
  assert.equal(res.status, 403);
  const visible = await call('src/app/api/media/route.ts', 'GET', jovem(), '/api/media');
  assert.equal(visible.res.status, 200);
  assert.ok(visible.db.calls[0].filters.some(([f, col, v]) => f === 'eq' && col === 'visible' && v === true));
});

test('media POST stores the authenticated author, never the body author', async () => {
  const { res, db } = await call('src/app/api/media/route.ts', 'POST', midia, '/api/media', { title: 'Foto', drive_url: 'https://drive.google.com/file/d/abc/view', author_id: 'forged' });
  assert.equal(res.status, 200);
  const insert = db.calls.find((c) => c.ops.includes('insert'));
  assert.equal(insert.payload.author_id, 'u-midia');
});

test('media PUT only forwards whitelisted columns', async () => {
  const { db } = await call('src/app/api/media/route.ts', 'PUT', midia, '/api/media', { id: UUID, visible: false, author_id: 'forged', created_at: '2000-01-01' });
  const update = db.calls.find((c) => c.ops.includes('update'));
  assert.deepEqual(Object.keys(update.payload).sort(), ['updated_at', 'visible']);
});

test('register requires a session and only touches the caller profile without role', async () => {
  assert.equal((await call('src/app/api/auth/register/route.ts', 'POST', ANON, '/api/auth/register', { id: 'victim', full_name: 'X' })).res.status, 401);
  const { res, db } = await call('src/app/api/auth/register/route.ts', 'POST', jovem(), '/api/auth/register', { id: 'victim', full_name: 'Nome Novo', role: 'coordenador', stake: 'Estaca' });
  assert.equal(res.status, 200);
  const write = mutations(db)[0];
  assert.equal(write.ops.includes('upsert'), false);
  assert.ok(write.filters.some(([f, col, v]) => f === 'eq' && col === 'id' && v === 'u-jovem'));
  assert.equal('role' in write.payload, false);
  assert.equal('id' in write.payload, false);
});

test('companies GET hides phones and the profile directory from non-managers', async () => {
  const db = createFakeDb({
    companies: { data: [{ id: 'cia-1', name: 'Companhia 1' }], error: null },
    profiles: { data: [{ id: 'p', full_name: 'Ana', role: 'consultor', company_id: 'cia-1', phone: '+55 16 9' }], error: null },
    medical_records: { data: [], error: null },
  });
  const { res } = await call('src/app/api/companies/route.ts', 'GET', jovem(), '/api/companies', undefined, db);
  assert.equal(res.status, 200);
  assert.equal(res.body.all_profiles, undefined);
  assert.ok(!JSON.stringify(res.body).includes('+55 16 9'));
  assert.equal(db.calls.some((c) => c.table === 'medical_records'), false, 'participant read medical table');
  assert.equal((await call('src/app/api/companies/route.ts', 'GET', ANON, '/api/companies')).res.status, 401);
});

test('counselor may update only the motto of their own company, with server-derived authorship', async () => {
  const other = await call('src/app/api/companies/route.ts', 'PUT', consultor('cia-1'), '/api/companies', { id: 'cia-2', motto: 'X' });
  assert.equal(other.res.status, 403);
  assert.equal(mutations(other.db).length, 0);
  const counselors = await call('src/app/api/companies/route.ts', 'PUT', consultor('cia-1'), '/api/companies', { id: 'cia-1', counselor_ids: ['u-cons'], name: 'Hack' });
  assert.equal(counselors.res.status, 403);
  const db = createFakeDb({ companies: (c) => ({ data: { id: 'cia-1', name: 'Companhia 1', motto: 'Antigo' }, error: null }) });
  const { res } = await call('src/app/api/companies/route.ts', 'PUT', consultor('cia-1'), '/api/companies', { id: 'cia-1', motto: 'Novo lema', author_name: 'Forjado', author_id: 'forged', author_role: 'casal_diretor' }, db);
  assert.equal(res.status, 200);
  const audit = db.calls.find((c) => c.table === 'counselor_audit_logs' && c.ops.includes('insert'));
  assert.equal(audit.payload.author_id, 'u-cons');
  assert.equal(audit.payload.author_name, 'Consultora Real');
  assert.equal(audit.payload.author_role, 'consultor');
});

test('announcements GET derives the participant company from identity', async () => {
  const { res, db } = await call('src/app/api/announcements/route.ts', 'GET', jovem('cia-1'), '/api/announcements?company_id=cia-9');
  assert.equal(res.status, 200);
  const or = db.calls[0].filters.find(([f]) => f === 'or');
  assert.ok(or, 'participant query must be scoped');
  assert.match(or[1], /target_company_id\.eq\.cia-1/);
  assert.doesNotMatch(or[1], /cia-9/);
  const none = await call('src/app/api/announcements/route.ts', 'GET', jovem(null), '/api/announcements');
  assert.ok(none.db.calls[0].filters.some(([f, col]) => f === 'is' && col === 'target_company_id'));
});

test('announcements POST rejects participants and binds counselors to their company', async () => {
  const body = { title: 'Aviso', content: 'Conteúdo', priority: 'normal', category: 'Geral', target_company_id: 'cia-2', author_id: 'forged' };
  assert.equal((await call('src/app/api/announcements/route.ts', 'POST', jovem(), '/api/announcements', body)).res.status, 403);
  const other = await call('src/app/api/announcements/route.ts', 'POST', consultor('cia-1'), '/api/announcements', body);
  assert.equal(other.res.status, 403);
  const db = createFakeDb({ announcements: { data: { id: UUID }, error: null }, companies: { data: { name: 'Companhia 1' }, error: null } });
  const ok = await call('src/app/api/announcements/route.ts', 'POST', consultor('cia-1'), '/api/announcements', { ...body, target_company_id: 'cia-1' }, db);
  assert.equal(ok.res.status, 200);
  const insert = db.calls.find((c) => c.table === 'announcements' && c.ops.includes('insert'));
  assert.equal(insert.payload.author_id, 'u-cons');
  assert.equal(insert.payload.target_company_id, 'cia-1');
});

test('announcement deletion is scoped and audited as the deleting identity', async () => {
  const existing = { id: UUID, title: 'T', content: 'C', target_company_id: 'cia-2', author_id: 'someone', profiles: { full_name: 'Outro', role: 'coordenador' } };
  const db = createFakeDb({ announcements: { data: existing, error: null } });
  const denied = await call('src/app/api/announcements/route.ts', 'DELETE', consultor('cia-1'), `/api/announcements?id=${UUID}`, undefined, db);
  assert.equal(denied.res.status, 403);
  assert.equal(mutations(db).length, 0);
  const db2 = createFakeDb({ announcements: { data: existing, error: null }, companies: { data: { name: 'C2' }, error: null } });
  const ok = await call('src/app/api/announcements/route.ts', 'DELETE', coord, `/api/announcements?id=${UUID}`, undefined, db2);
  assert.equal(ok.res.status, 200);
  const audit = db2.calls.find((c) => c.table === 'counselor_audit_logs' && c.ops.includes('insert'));
  assert.equal(audit.payload.author_id, 'u-coord');
});

test('likes use the authenticated identity and a dedicated table', async () => {
  assert.equal((await call('src/app/api/announcements/like/route.ts', 'POST', ANON, '/api/announcements/like', { announcement_id: UUID })).res.status, 401);
  const db = createFakeDb({ announcement_likes: (c) => (c.ops.includes('select') && !c.ops.includes('insert') && !c.ops.includes('delete') ? { data: c.single ? null : [], error: null, count: 1 } : { data: null, error: null }) });
  const { res } = await call('src/app/api/announcements/like/route.ts', 'POST', jovem(), '/api/announcements/like', { announcement_id: UUID, user_id: 'forged' }, db);
  assert.equal(res.status, 200);
  const write = mutations(db).find((c) => c.table === 'announcement_likes');
  assert.ok(write, 'like must be stored in announcement_likes');
  assert.equal(write.payload.user_id, 'u-jovem');
  assert.equal(db.calls.some((c) => c.table === 'announcements' && c.ops.includes('update')), false);
});

test('logistics GET is restricted to logistics managers', async () => {
  assert.equal((await call('src/app/api/logistics/route.ts', 'GET', jovem(), '/api/logistics')).res.status, 403);
  assert.equal((await call('src/app/api/logistics/route.ts', 'GET', coord, '/api/logistics')).res.status, 200);
});

test('counselor audit POST ignores author_name from the body', async () => {
  const db = createFakeDb({ counselor_audit_logs: { data: {}, error: null } });
  await call('src/app/api/admin/counselor-audit/route.ts', 'POST', consultor('cia-1'), '/api/admin/counselor-audit', { content: 'x', author_name: 'Forjado', company_id: 'cia-2' }, db);
  const insert = db.calls.find((c) => c.ops.includes('insert'));
  assert.equal(insert.payload.author_name, 'Consultora Real');
  assert.equal(insert.payload.company_id, 'cia-1');
});

test('schedule seed with overwrite never deletes before a successful insert', async () => {
  const db = createFakeDb({ 'rpc:admin_replace_schedule': { data: null, error: { code: 'XX000', message: 'boom' } } });
  const { res } = await call('src/app/api/schedule/route.ts', 'POST', coord, '/api/schedule', { action: 'seed', overwrite: true }, db);
  assert.equal(res.status, 500);
  assert.equal(db.calls.some((c) => c.ops?.includes('delete')), false, 'route deleted outside the transaction');
  assert.equal(db.calls.filter((c) => c.rpc === 'admin_replace_schedule').length, 1);
  assert.ok(!JSON.stringify(res.body).includes('boom'), 'database detail leaked');
});

test('identity resolution rejects suspended profiles', async () => {
  const profile = (extra) => ({ id: 'u1', full_name: 'Coord', role: 'coordenador', company_id: null, ...extra });
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'anon';
  const resolve = async (row) => {
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'c@fsy.test' } }, error: null }) },
      from: () => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: row, error: null }) }),
    };
    const server = loadRoute('src/lib/supabase/server.ts', { extraModules: {
      '@supabase/ssr': { createServerClient: () => client },
      '@/lib/supabase/admin': { createAdminClient: () => client },
      '@/lib/supabase/server': undefined,
    } });
    return server.getCurrentIdentity();
  };
  assert.equal((await resolve(profile({ suspended_at: null }))).role, 'coordenador');
  assert.equal(await resolve(profile({ suspended_at: '2026-10-20T00:00:00Z' })), null);
});

test('legacy users PUT applies the account matrix', async () => {
  const logistica = { user: { id: 'u-log' }, role: 'logistica', fullName: 'Logística' };
  const target = { id: '123e4567-e89b-42d3-a456-426614174999', role: 'jovem', full_name: 'Alvo' };
  const db = () => createFakeDb({ profiles: (c) => ({ data: c.single ? target : [target], error: null }) });
  const promote = await call('src/app/api/users/route.ts', 'PUT', logistica, '/api/users', { id: target.id, role: 'casal_diretor' }, db());
  assert.equal(promote.res.status, 403);
  assert.equal(promote.db.calls.some((c) => c.ops.includes('update')), false);
  const selfDb = createFakeDb({ profiles: (c) => ({ data: { id: 'u-log', role: 'logistica', full_name: 'Logística' }, error: null }) });
  const self = await call('src/app/api/users/route.ts', 'PUT', logistica, '/api/users', { id: 'u-log', role: 'jovem' }, selfDb);
  assert.equal(self.res.status, 409);
  const room = await call('src/app/api/users/route.ts', 'PUT', logistica, '/api/users', { id: target.id, room: '12', role: 'jovem' }, db());
  assert.equal(room.res.status, 200);
});
