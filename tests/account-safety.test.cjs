const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, createUser, as, attempt } = require('./helpers/pg-harness.cjs');
const { loadRoute, createFakeDb, request } = require('./helpers/route-harness.cjs');
const actor = '70000000-0000-4000-8000-000000000001';
const target = '70000000-0000-4000-8000-000000000002';
let db;
before(async () => {
  db = await createDatabase();
  await createUser(db, { id: actor, email: 'admin@fsy.test', role: 'casal_diretor' });
  await createUser(db, { id: target, email: 'jovem@fsy.test' });
});
after(async () => db?.close());
test('last enabled administrator is protected on role change, suspension and Auth cascade deletion', async () => {
  for (const sql of [
    `UPDATE profiles SET role = 'jovem' WHERE id = '${actor}'`,
    `UPDATE profiles SET suspended_at = now() WHERE id = '${actor}'`,
    `DELETE FROM auth.users WHERE id = '${actor}'`,
  ]) {
    await assert.rejects(() => db.exec(sql), /preservar uma conta administrativa/);
    assert.equal((await db.query('SELECT role FROM profiles WHERE id = $1', [actor])).rows[0].role, 'casal_diretor');
  }
});
test('the sole enabled logistics account is protected as an administrator', async () => {
  await db.query(`UPDATE profiles SET role = 'logistica' WHERE id = $1`, [actor]);
  try {
    for (const sql of [
      `UPDATE profiles SET role = 'jovem' WHERE id = '${actor}'`,
      `UPDATE profiles SET suspended_at = now() WHERE id = '${actor}'`,
      `DELETE FROM auth.users WHERE id = '${actor}'`,
    ]) await assert.rejects(() => db.exec(sql), /preservar uma conta administrativa/);
  } finally {
    await db.query(`UPDATE profiles SET role = 'casal_diretor' WHERE id = $1`, [actor]);
  }
});
test('administrator trigger serializes removals and allows one of two admins to step down', async () => {
  await db.query(`UPDATE profiles SET role = 'coordenador' WHERE id = $1`, [target]);
  await db.query(`UPDATE profiles SET role = 'jovem' WHERE id = $1`, [target]);
  const functionBody = (await db.query("SELECT pg_get_functiondef('public.keep_enabled_administrator()'::regprocedure) AS body")).rows[0].body;
  assert.match(functionBody, /pg_advisory_xact_lock/);
});
test('suspended JWT cannot directly read photos, notices, companies, schedule or own profile/preferences', async () => {
  await db.exec(`INSERT INTO media_photos (title, drive_url, visible) VALUES ('Visível','https://drive.google.com/x',true);
    INSERT INTO companies (id,name) VALUES ('cia-test','Companhia');
    INSERT INTO announcements (title,content) VALUES ('Geral','Aviso');`);
  await db.query(`UPDATE profiles SET suspended_at = now() WHERE id = $1`, [target]);
  for (const table of ['profiles','media_photos','announcements','companies','schedule_items','user_layout_preferences','announcement_likes']) {
    const result = await as(db, { sub: target }, tx => tx.query(`SELECT * FROM ${table}`));
    assert.equal(result.rows.length, 0, table);
  }
  const write = await attempt(db, { sub: target }, `INSERT INTO user_layout_preferences (user_id,page_key,card_order) VALUES ($1,'dashboard','[]'::jsonb)`, [target]);
  assert.equal(write.ok, false);
});
test('failed target profile lookup cannot redefine a higher account password or delete it', async () => {
  for (const action of ['password', 'delete']) {
    const calls = [];
    const fake = createFakeDb({ profiles: { data: null, error: { code: '08006' } } });
    fake.auth.admin.getUserById = async () => ({ data: { user: { id: target, email: 'diretor@fsy.test' } }, error: null });
    fake.auth.admin.updateUserById = async () => { calls.push('password'); return { error: null }; };
    fake.auth.admin.deleteUser = async () => { calls.push('delete'); return { error: null }; };
    const file = action === 'password' ? 'src/app/api/admin/accounts/[id]/password/route.ts' : 'src/app/api/admin/accounts/[id]/route.ts';
    const route = loadRoute(file, { db: fake, identity: { user: { id: actor }, role: 'coordenador' } });
    const result = await route[action === 'password' ? 'POST' : 'DELETE'](request('/api/admin/accounts/'+target, { method: action === 'password' ? 'POST' : 'DELETE', body: action === 'password' ? { password: 'TesteSeguro123!', confirm: true } : { confirm: 'diretor@fsy.test' } }), { params: Promise.resolve({ id: target }) });
    assert.equal(result.status, 500);
    assert.deepEqual(calls, []);
  }
});
test('suspension never calls Auth if the profile guard refuses the operation', async () => {
  let authCalls = 0;
  const fake = createFakeDb({ profiles: call => call.ops.includes('update')
    ? { data: null, error: { code: '23514' } }
    : { data: { id: target, full_name: 'Diretor', role: 'casal_diretor', suspended_at: null }, count: 2, error: null } });
  fake.auth.admin.getUserById = async () => ({ data: { user: { id: target } }, error: null });
  fake.auth.admin.updateUserById = async () => { authCalls++; return { error: null }; };
  const route = loadRoute('src/app/api/admin/accounts/[id]/route.ts', { db: fake, identity: { user: { id: actor }, role: 'casal_diretor' } });
  const result = await route.PATCH(request('/api/admin/accounts/'+target, { method: 'PATCH', body: { action: 'suspend' } }), { params: Promise.resolve({ id: target }) });
  assert.equal(result.status, 500);
  assert.equal(authCalls, 0);
});
