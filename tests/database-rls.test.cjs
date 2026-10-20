const assert = require('node:assert/strict');
const { test, before } = require('node:test');
const { createDatabase, applyMigration, as, attempt, createUser } = require('./helpers/pg-harness.cjs');

const ID = {
  jovem: '10000000-0000-4000-8000-000000000001',
  jovem2: '10000000-0000-4000-8000-000000000002',
  consultor: '10000000-0000-4000-8000-000000000003',
  coord: '10000000-0000-4000-8000-000000000004',
  midia: '10000000-0000-4000-8000-000000000005',
};
const ann = { global: '20000000-0000-4000-8000-000000000001', cia1: '20000000-0000-4000-8000-000000000002', cia2: '20000000-0000-4000-8000-000000000003' };
let db;

before(async () => {
  // Dados legados entram antes da migração de 20/10, como no banco real.
  db = await createDatabase({ upTo: '202609090002' });
  await db.exec(`INSERT INTO companies (id, name) VALUES ('cia-1','Companhia 1'), ('cia-2','Companhia 2')`);
  await createUser(db, { id: ID.jovem, email: 'jovem@fsy.test', company: 'cia-1', name: 'Jovem Um' });
  await createUser(db, { id: ID.jovem2, email: 'jovem2@fsy.test', company: 'cia-2', name: 'Jovem Dois' });
  await createUser(db, { id: ID.consultor, email: 'consultor@fsy.test', role: 'consultor', company: 'cia-1' });
  await createUser(db, { id: ID.coord, email: 'coord@fsy.test', role: 'coordenador' });
  await createUser(db, { id: ID.midia, email: 'midia@fsy.test', role: 'midia' });
  await db.query(`INSERT INTO announcements (id, title, content, target_company_id, category, author_id) VALUES
    ($1,'Geral','x',NULL,'Geral__LIKES__["${ID.jovem}","${ID.jovem2}"]',$4), ($2,'Cia1','x','cia-1','Geral',$4), ($3,'Cia2','x','cia-2','Geral',$4)`, [ann.global, ann.cia1, ann.cia2, ID.coord]);
  await applyMigration(db, '202610200001');
});

const denied = (res, label) => {
  assert.equal(res.ok, false, label);
  assert.match(String(res.error.message), /permission denied|row-level security|exigem|não permit/i, `${label}: ${res.error.message}`);
};

const rows = async (identity, sql, params) => (await as(db, identity, (tx) => tx.query(sql, params))).rows;

test('signup trigger never derives a privileged role from the e-mail or metadata', async () => {
  const id = '30000000-0000-4000-8000-000000000001';
  await db.query(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, 'admin.coordenador.medico@fsy.test', $2)`,
    [id, JSON.stringify({ full_name: 'Novo', role: 'casal_diretor', stake: 'Estaca Leste', phone: '16 9999' })]);
  const [profile] = (await db.query(`SELECT role, stake, phone FROM profiles WHERE id = $1`, [id])).rows;
  assert.equal(profile.role, 'jovem');
  assert.equal(profile.stake, 'Estaca Leste');
  assert.equal(profile.phone, '16 9999');
});

test('participants read only their own profile', async () => {
  const visible = await rows({ sub: ID.jovem }, `SELECT id FROM profiles`);
  assert.deepEqual(visible.map((r) => r.id), [ID.jovem]);
});

test('counselors read profiles of their own company only', async () => {
  const visible = (await rows({ sub: ID.consultor }, `SELECT id FROM profiles ORDER BY id`)).map((r) => r.id);
  assert.ok(visible.includes(ID.jovem));
  assert.ok(visible.includes(ID.consultor));
  assert.ok(!visible.includes(ID.jovem2));
  assert.ok(!visible.includes(ID.coord));
});

test('coordinators read every profile', async () => {
  assert.equal((await rows({ sub: ID.coord }, `SELECT id FROM profiles`)).length >= 5, true);
});

test('participants cannot move themselves to another company or room', async () => {
  for (const sql of [`UPDATE profiles SET company_id = 'cia-2' WHERE id = $1`, `UPDATE profiles SET room = '999' WHERE id = $1`, `UPDATE profiles SET role = 'coordenador' WHERE id = $1`]) {
    denied(await attempt(db, { sub: ID.jovem }, sql, [ID.jovem]), sql);
  }
  const ok = await attempt(db, { sub: ID.jovem }, `UPDATE profiles SET phone = '16 1234' WHERE id = $1`, [ID.jovem]);
  assert.equal(ok.ok, true);
});

test('browser roles cannot write audit logs directly', async () => {
  denied(await attempt(db, { sub: ID.consultor }, `INSERT INTO counselor_audit_logs (author_name, action_type, action_label, content) VALUES ('Forjado','x','y','z')`), 'audit insert');
});

test('participants see global announcements and their own company only', async () => {
  const ids = (await rows({ sub: ID.jovem }, `SELECT id FROM announcements`)).map((r) => r.id).sort();
  assert.deepEqual(ids, [ann.global, ann.cia1].sort());
});

test('hidden photos are invisible to participants and visible to the media team', async () => {
  await db.query(`INSERT INTO media_photos (title, drive_url, visible) VALUES ('oculta','https://drive.google.com/x', false)`);
  assert.equal((await rows({ sub: ID.jovem }, `SELECT id FROM media_photos WHERE visible = false`)).length, 0);
  assert.equal((await rows({ sub: ID.midia }, `SELECT id FROM media_photos WHERE visible = false`)).length, 1);
});

test('legacy likes stored in the category move to announcement_likes', async () => {
  const likes = (await db.query(`SELECT user_id FROM announcement_likes WHERE announcement_id = $1 ORDER BY user_id`, [ann.global])).rows.map((r) => r.user_id);
  assert.deepEqual(likes, [ID.jovem, ID.jovem2]);
  const [{ category }] = (await db.query(`SELECT category FROM announcements WHERE id = $1`, [ann.global])).rows;
  assert.equal(category, 'Geral');
});

test('likes cannot be forged for another person from the browser', async () => {
  denied(await attempt(db, { sub: ID.jovem }, `INSERT INTO announcement_likes (announcement_id, user_id) VALUES ($1, $2)`, [ann.cia1, ID.jovem2]), 'forged like');
});

test('layout preferences are isolated per account', async () => {
  const save = `INSERT INTO user_layout_preferences (user_id, page_key, breakpoint, layout_version, card_order) VALUES ($1, 'dashboard', 'all', 1, '["a","b"]'::jsonb)`;
  assert.equal((await attempt(db, { sub: ID.jovem }, save, [ID.jovem])).ok, true);
  denied(await attempt(db, { sub: ID.jovem }, save, [ID.jovem2]), 'wrote preferences for another user');
  await db.query(save, [ID.jovem2]);
  assert.equal((await rows({ sub: ID.jovem }, `SELECT user_id FROM user_layout_preferences`)).length, 0);
  assert.equal((await rows({ sub: ID.jovem2 }, `SELECT user_id FROM user_layout_preferences`)).length, 1);
  const tamper = await as(db, { sub: ID.jovem }, (tx) => tx.query(`UPDATE user_layout_preferences SET card_order = '[]' WHERE user_id = $1`, [ID.jovem2]));
  assert.equal(tamper.affectedRows, 0);
});

test('administrative RPCs are not executable by browser roles', async () => {
  for (const fn of [`admin_save_company('x', true, 'X', NULL, false, NULL, NULL, $1)`, `admin_replace_schedule('[]'::jsonb)`, `admin_delete_company('cia-1', $1)`]) {
    denied(await attempt(db, { sub: ID.coord }, `SELECT public.${fn}`, fn.includes('$1') ? [ID.coord] : []), fn);
  }
});

test('company save assigns counselors atomically and rolls back on unknown counselor', async () => {
  const good = await as(db, { role: 'service_role' }, async (tx) => {
    await tx.query(`SELECT public.admin_save_company('cia-9', true, 'Nova', 'Lema', true, '#112233', ARRAY[$1]::uuid[], $2)`, [ID.consultor, ID.coord]);
    return (await tx.query(`SELECT company_id FROM profiles WHERE id = $1`, [ID.consultor])).rows[0];
  });
  assert.equal(good.company_id, 'cia-9');
  const bad = await attempt(db, { role: 'service_role' }, `SELECT public.admin_save_company('cia-8', true, 'Outra', NULL, false, NULL, ARRAY['99999999-9999-4999-8999-999999999999']::uuid[], $1)`, [ID.coord]);
  assert.equal(bad.ok, false);
  assert.equal((await db.query(`SELECT id FROM companies WHERE id = 'cia-8'`)).rows.length, 0);
});

test('schedule replacement keeps existing rows when the new batch is invalid', async () => {
  await db.query(`INSERT INTO schedule_items (day, date, start_time, end_time, title, location) VALUES ('dia1','2027-02-06','08:00','09:00','Original','Capela')`);
  const res = await attempt(db, { role: 'service_role' }, `SELECT public.admin_replace_schedule('[{"day":"dia1","date":"2027-02-06","start_time":"08:00","end_time":"09:00","title":null,"location":"X"}]'::jsonb)`);
  assert.equal(res.ok, false);
  assert.match(String(res.error.message), /null value|not-null/i);
  assert.equal((await db.query(`SELECT id FROM schedule_items WHERE title = 'Original'`)).rows.length, 1);
});

test('security migration can be applied twice without errors', async () => {
  await applyMigration(db, '202610200001');
});
