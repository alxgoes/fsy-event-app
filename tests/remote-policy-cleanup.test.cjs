// Run with: node --test tests/remote-policy-cleanup.test.cjs
// Reproduz em Postgres embutido a deriva de RLS encontrada no Supabase remoto
// (políticas permissivas extras que as migrações anteriores não removiam por nome)
// e verifica que 202610200003 deixa só a allowlist mínima, sem apagar registros.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, applyMigration, as, attempt, createUser } = require('./helpers/pg-harness.cjs');

const ID = {
  jovem: '00000000-0000-4000-8000-000000000001',
  jovem2: '00000000-0000-4000-8000-000000000002',
  consultor: '00000000-0000-4000-8000-000000000003',
  medico: '00000000-0000-4000-8000-000000000004',
  logistica: '00000000-0000-4000-8000-000000000005',
  coord: '00000000-0000-4000-8000-000000000006',
  diretor: '00000000-0000-4000-8000-000000000007',
  suspenso: '00000000-0000-4000-8000-000000000008',
};
const TABLES = ['announcements', 'counselor_audit_logs', 'medical_records', 'transport_logistics'];

// Políticas confirmadas no remoto (nomes reais; o DELETE tem o nome truncado em 63 bytes).
const REMOTE_DRIFT = `
  GRANT ALL ON public.medical_records, public.transport_logistics, public.announcements, public.counselor_audit_logs TO anon, authenticated;
  CREATE POLICY "Allow authenticated manage medical_records" ON public.medical_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
  DROP POLICY IF EXISTS transport_private_appointments_backup ON public.transport_logistics;
  CREATE POLICY transport_private_appointments_backup ON public.transport_logistics FOR ALL TO anon, authenticated
    USING (COALESCE(stake_city, '') <> '__APPOINTMENTS_STORAGE__') WITH CHECK (COALESCE(stake_city, '') <> '__APPOINTMENTS_STORAGE__');
  CREATE POLICY "Auth users can read logistics" ON public.transport_logistics FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Users can view global or their company announcements" ON public.announcements;
  CREATE POLICY "Users can view global or their company announcements" ON public.announcements FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Auth users can read announcements" ON public.announcements FOR SELECT TO authenticated USING (true);
  CREATE POLICY announcements_company_read ON public.announcements FOR SELECT TO authenticated
    USING (target_company_id IS NULL OR target_company_id = public.get_auth_company());
  CREATE POLICY "Directors, Coordinators and Logistics can delete counselor audi" ON public.counselor_audit_logs FOR DELETE TO authenticated
    USING (public.get_auth_role()::text IN ('coordenador', 'casal_diretor', 'logistica'));
  CREATE POLICY "Authenticated can insert counselor logs" ON public.counselor_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "Legacy staff manage announcements" ON public.announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);
`;

let db;
const rows = async (identity, sql, params) => (await as(db, identity, (tx) => tx.query(sql, params))).rows;
const count = async (identity, table) => (await rows(identity, `SELECT count(*)::int AS n FROM public.${table}`))[0].n;
const service = { role: 'service_role' };
const anon = { role: 'anon' };
const user = (key) => ({ sub: ID[key] });

async function seed() {
  for (const [key, role, company] of [
    ['jovem', 'jovem', 'cia-1'], ['jovem2', 'jovem', 'cia-2'], ['consultor', 'consultor', 'cia-1'], ['medico', 'medico', null],
    ['logistica', 'logistica', null], ['coord', 'coordenador', null], ['diretor', 'casal_diretor', null], ['suspenso', 'coordenador', null],
  ]) await createUser(db, { id: ID[key], email: `${key}@fsy.test`, role, company });
  await db.query(`UPDATE profiles SET suspended_at = now() WHERE id = $1`, [ID.suspenso]);
  await db.query(`INSERT INTO companies (id, name) VALUES ('cia-1', 'Um'), ('cia-2', 'Dois') ON CONFLICT (id) DO NOTHING`);
  await db.query(`INSERT INTO medical_records (user_id, full_name, company_id, emergency_contact_name, emergency_contact_phone, emergency_contact_rel)
    VALUES ($1, 'Jovem Um', 'cia-1', 'Mãe', '1600000000', 'mãe'), ($2, 'Jovem Dois', 'cia-2', 'Pai', '1600000001', 'pai')`, [ID.jovem, ID.jovem2]);
  await db.query(`INSERT INTO transport_logistics (bus_number, stake_city, driver_name, driver_phone, departure_city_time, arrival_fsy_time, departure_fsy_time)
    VALUES ('01', 'Estaca Franca', 'Motorista', '1690000000', '06:00', '09:00', '17:00'),
           ('__', '__APPOINTMENTS_STORAGE__', '-', '-', '-', '-', '-')`);
  await db.query(`INSERT INTO announcements (title, content, target_company_id) VALUES ('Global', 'g', NULL), ('Cia 1', 'a', 'cia-1'), ('Cia 2', 'b', 'cia-2')`);
  await db.query(`INSERT INTO counselor_audit_logs (author_name, action_type, action_label, content) VALUES ('Consultor', 'publicou_comunicado', 'Novo', 'x')`);
}

async function policies() {
  return (await db.query(`SELECT tablename, policyname, permissive, roles::text[] AS roles, cmd FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY($1) ORDER BY tablename, policyname`, [TABLES])).rows
    .map((p) => `${p.tablename}|${p.policyname}|${p.permissive}|${[...p.roles].sort().join(',')}|${p.cmd}`);
}

test.before(async () => {
  db = await createDatabase({ upTo: '202610200002' });
  await seed();
  await db.exec(REMOTE_DRIFT);
});

test('a deriva remota reproduzida realmente vaza dados (pré-condição do teste)', async () => {
  assert.equal(await count(user('jovem'), 'medical_records'), 2, 'jovem lê todos os prontuários');
  assert.equal(await count(anon, 'transport_logistics'), 1, 'anônimo lê transporte');
  assert.equal(await count(user('jovem'), 'announcements'), 3, 'jovem lê avisos de outra companhia');
  assert.equal((await attempt(db, user('jovem'), `INSERT INTO counselor_audit_logs (author_name, action_type, action_label, content) VALUES ('x','y','z','w')`)).ok, true);
});

test('202610200003 deixa só a allowlist mínima e é idempotente', async () => {
  const before = {};
  for (const t of TABLES) before[t] = (await db.query(`SELECT count(*)::int AS n FROM public.${t}`)).rows[0].n;

  await applyMigration(db, '202610200003');
  const expected = [
    'announcements|active_profile_required|RESTRICTIVE|authenticated|ALL',
    'announcements|announcements_scoped_read|PERMISSIVE|authenticated|SELECT',
    'counselor_audit_logs|active_profile_required|RESTRICTIVE|authenticated|ALL',
    'counselor_audit_logs|counselor_audit_staff_read|PERMISSIVE|authenticated|SELECT',
    'medical_records|active_profile_required|RESTRICTIVE|authenticated|ALL',
    'medical_records|medical_records_staff_read|PERMISSIVE|authenticated|SELECT',
    'transport_logistics|active_profile_required|RESTRICTIVE|authenticated|ALL',
    'transport_logistics|transport_private_appointments_backup|RESTRICTIVE|authenticated|ALL',
    'transport_logistics|transport_staff_read|PERMISSIVE|authenticated|SELECT',
  ];
  assert.deepEqual(await policies(), expected);

  await applyMigration(db, '202610200003');
  assert.deepEqual(await policies(), expected, 'reaplicar não muda nada');

  for (const t of TABLES) {
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.${t}`)).rows[0].n, before[t], `${t} sem perda de registros`);
  }
});

test('anônimo não lê nem grava nenhuma tabela sensível', async () => {
  for (const t of TABLES) {
    assert.equal((await attempt(db, anon, `SELECT 1 FROM public.${t} LIMIT 1`)).ok, false, `anon SELECT ${t}`);
  }
  const insert = await attempt(db, anon, `INSERT INTO transport_logistics (bus_number, stake_city, driver_name, driver_phone, departure_city_time, arrival_fsy_time, departure_fsy_time) VALUES ('9','x','x','x','x','x','x')`);
  assert.equal(insert.ok, false);
});

test('prontuários: só médico, coordenação e direção leem; ninguém grava pelo navegador', async () => {
  assert.equal(await count(user('medico'), 'medical_records'), 2);
  assert.equal(await count(user('coord'), 'medical_records'), 2);
  assert.equal(await count(user('diretor'), 'medical_records'), 2);
  for (const key of ['jovem', 'consultor', 'logistica', 'suspenso']) {
    assert.equal(await count(user(key), 'medical_records'), 0, `${key} não lê prontuários pelo navegador`);
  }
  for (const key of ['jovem', 'medico', 'diretor']) {
    const r = await attempt(db, user(key), `UPDATE medical_records SET allergies = 'x'`);
    assert.equal(r.ok, false, `${key} não altera prontuário direto`);
  }
});

test('transporte: equipe de logística lê, sem ver o armazenamento de atendimentos', async () => {
  for (const key of ['logistica', 'coord', 'diretor']) {
    const list = await rows(user(key), `SELECT stake_city FROM transport_logistics`);
    assert.deepEqual(list.map((r) => r.stake_city), ['Estaca Franca'], key);
  }
  for (const key of ['jovem', 'consultor', 'medico', 'suspenso']) assert.equal(await count(user(key), 'transport_logistics'), 0, key);
  assert.equal((await attempt(db, user('logistica'), `DELETE FROM transport_logistics`)).ok, false);
});

test('avisos seguem o escopo da API: globais + própria companhia; gestão vê todos', async () => {
  const titles = async (key) => (await rows(user(key), `SELECT title FROM announcements ORDER BY title`)).map((r) => r.title);
  assert.deepEqual(await titles('jovem'), ['Cia 1', 'Global']);
  assert.deepEqual(await titles('jovem2'), ['Cia 2', 'Global']);
  assert.deepEqual(await titles('consultor'), ['Cia 1', 'Global']);
  assert.deepEqual(await titles('logistica'), ['Cia 1', 'Cia 2', 'Global']);
  assert.deepEqual(await titles('suspenso'), []);
  assert.equal((await attempt(db, user('coord'), `INSERT INTO announcements (title, content) VALUES ('x','y')`)).ok, false);
});

test('auditoria de consultores: leitura só da gestão; inserir e apagar só pelo servidor', async () => {
  assert.equal(await count(user('coord'), 'counselor_audit_logs'), 1);
  assert.equal(await count(user('logistica'), 'counselor_audit_logs'), 1);
  assert.equal(await count(user('consultor'), 'counselor_audit_logs'), 0);
  assert.equal(await count(user('jovem'), 'counselor_audit_logs'), 0);
  const insert = `INSERT INTO counselor_audit_logs (author_name, action_type, action_label, content) VALUES ('x','y','z','w')`;
  assert.equal((await attempt(db, user('jovem'), insert)).ok, false);
  assert.equal((await attempt(db, user('coord'), `DELETE FROM counselor_audit_logs`)).ok, false);
});

test('service_role (APIs do servidor) mantém acesso completo', async () => {
  assert.equal(await count(service, 'medical_records'), 2);
  assert.equal(await count(service, 'transport_logistics'), 2, 'inclui o armazenamento de atendimentos');
  assert.equal(await count(service, 'announcements'), 3);
  const r = await attempt(db, service, `INSERT INTO counselor_audit_logs (author_name, action_type, action_label, content) VALUES ('Servidor','a','b','c') RETURNING id`);
  assert.equal(r.ok, true);
});

test('cadeia completa de migrações aplica 003 sem erro', async () => {
  const fresh = await createDatabase();
  const names = (await fresh.query(`SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'medical_records' ORDER BY 1`)).rows.map((r) => r.policyname);
  assert.deepEqual(names, ['active_profile_required', 'medical_records_staff_read']);
});
