const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { createDatabase, applyMigration, attempt, createUser } = require('./helpers/pg-harness.cjs');
const { createFakeDb, loadRoute, request, mutations } = require('./helpers/route-harness.cjs');

const USER = '10000000-0000-4000-8000-000000000091';
const REVIEWER = '10000000-0000-4000-8000-000000000092';
const PHOTO = '20000000-0000-4000-8000-000000000091';
const ownRow = {
  id: PHOTO, full_name: 'Jovem da companhia', role: 'jovem', company_id: 'cia-1',
  avatar_url: null, avatar_status: 'pending', avatar_pending_path: `pending/${PHOTO}/foto.jpg`,
  avatar_submitted_at: '2026-11-02T12:00:00Z', avatar_reviewed_at: null, avatar_review_note: null,
};
const consultor = { user: { id: REVIEWER }, role: 'consultor', companyId: 'cia-1' };
const jovem = { user: { id: USER }, role: 'jovem', companyId: 'cia-1' };

let pg;
before(async () => {
  pg = await createDatabase({ upTo: '202611020001' });
  await createUser(pg, { id: USER, email: 'foto-jovem@fsy.test', company: null });
});
after(async () => { await pg?.close(); });

test('cadastro não publica foto recebida na metadata e preserva os demais dados do perfil', async () => {
  const id = '10000000-0000-4000-8000-000000000093';
  await pg.query('INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES ($1,$2,$3)', [id, 'cadastro-foto@fsy.test', JSON.stringify({
    full_name: 'Cadastro Fictício', stake: 'Estaca Fictícia', phone: '(16) 99999-0000',
    avatar_url: 'https://example.invalid/foto-forjada.jpg', picture: 'https://example.invalid/outra-forjada.jpg',
    avatar_status: 'approved', role: 'coordenador',
  })]);
  const row = (await pg.query(`SELECT full_name,stake,phone,role,avatar_url,avatar_status,avatar_pending_path,
    avatar_submitted_at,avatar_reviewed_at,avatar_reviewed_by,avatar_review_note FROM public.profiles WHERE id=$1`, [id])).rows[0];
  assert.deepEqual(row, {
    full_name: 'Cadastro Fictício', stake: 'Estaca Fictícia', phone: '(16) 99999-0000', role: 'jovem',
    avatar_url: null, avatar_status: 'none', avatar_pending_path: null,
    avatar_submitted_at: null, avatar_reviewed_at: null, avatar_reviewed_by: null, avatar_review_note: null,
  });
});

test('migração e reaplicação preservam fotos anteriores e não duplicam o trigger de cadastro', async () => {
  const db = await createDatabase({ upTo: '202610310002' });
  try {
    await createUser(db, { id: USER, email: 'foto-anterior@fsy.test', meta: { picture: 'https://example.invalid/foto-anterior.jpg' } });
    for (let replay = 0; replay < 2; replay++) {
      await applyMigration(db, '202611020001');
      const row = (await db.query('SELECT avatar_url,avatar_status FROM public.profiles WHERE id=$1', [USER])).rows[0];
      assert.deepEqual(row, { avatar_url: 'https://example.invalid/foto-anterior.jpg', avatar_status: 'approved' });
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgrelid='public.profiles'::regclass AND tgname='initialize_profile_photo_review' AND NOT tgisinternal`)).rows[0].n, 1);
    }
  } finally { await db.close(); }
});

test('trigger da foto impede o jovem de alterar avatar_url e avatar_status, mas aceita service_role', async () => {
  for (const sql of [
    `UPDATE profiles SET avatar_url = 'https://example.test/forjada.jpg' WHERE id = $1`,
    `UPDATE profiles SET avatar_status = 'approved' WHERE id = $1`,
  ]) {
    const denied = await attempt(pg, { sub: USER }, sql, [USER]);
    assert.equal(denied.ok, false, sql);
    assert.match(String(denied.error.message), /foto|servidor|permission denied/i);
  }
  const allowed = await attempt(pg, { role: 'service_role' },
    `UPDATE profiles SET avatar_url = 'https://example.test/aprovada.jpg', avatar_status = 'approved' WHERE id = $1 RETURNING avatar_status`, [USER]);
  assert.equal(allowed.ok, true);
  assert.equal(allowed.result.rows[0].avatar_status, 'approved');
});

function reviewDb(row = ownRow) {
  const db = createFakeDb({ profiles: { data: row, error: null } });
  db.storage = { from: () => ({ remove: async () => ({ error: null }) }) };
  return db;
}

const reviewRoute = 'src/app/api/profile/photo/reviews/route.ts';

test('jovem recebe 403 nas duas rotas de análise sem consultar o banco', async () => {
  const db = reviewDb();
  const route = loadRoute(reviewRoute, { identity: jovem, db });
  assert.equal((await route.GET()).status, 403);
  assert.equal((await route.POST(request('/api/profile/photo/reviews', { method: 'POST', body: { user_id: PHOTO, decision: 'approve' } }))).status, 403);
  assert.equal(db.calls.length, 0);
});

test('consultor só lista fotos da própria companhia', async () => {
  const db = createFakeDb({ profiles: { data: [], error: null } });
  const route = loadRoute(reviewRoute, { identity: consultor, db });
  assert.equal((await route.GET()).status, 200);
  assert.ok(db.calls[0].filters.some(([op, column, value]) => op === 'eq' && column === 'company_id' && value === 'cia-1'));
});

test('consultor recebe 404 ao tentar moderar foto de outra companhia, sem escrita', async () => {
  const db = reviewDb({ ...ownRow, company_id: 'cia-2' });
  const route = loadRoute(reviewRoute, { identity: consultor, db });
  const response = await route.POST(request('/api/profile/photo/reviews', { method: 'POST', body: { user_id: PHOTO, decision: 'approve' } }));
  assert.equal(response.status, 404);
  assert.equal(mutations(db).length, 0);
});

test('recusa exige motivo e grava identidade do consultor quando o motivo é válido', async () => {
  const db = reviewDb();
  const route = loadRoute(reviewRoute, { identity: consultor, db });
  const invalid = await route.POST(request('/api/profile/photo/reviews', { method: 'POST', body: { user_id: PHOTO, decision: 'reject', note: '  ' } }));
  assert.equal(invalid.status, 400);
  assert.equal(db.calls.length, 0);
  const valid = await route.POST(request('/api/profile/photo/reviews', { method: 'POST', body: { user_id: PHOTO, decision: 'reject', note: 'Imagem inadequada' } }));
  assert.equal(valid.status, 200);
  const write = mutations(db)[0];
  assert.equal(write.payload.avatar_status, 'rejected');
  assert.equal(write.payload.avatar_reviewed_by, REVIEWER);
  assert.equal(write.payload.avatar_review_note, 'Imagem inadequada');
});

test('upload recusa arquivo que não é imagem com 415 antes de acessar o banco', async () => {
  const db = reviewDb();
  const route = loadRoute('src/app/api/profile/photo/route.ts', { identity: jovem, db });
  const file = new Blob(['texto puro'], { type: 'image/png' });
  const upload = request('/api/profile/photo', { method: 'POST' });
  upload.formData = async () => ({ get: () => file });
  const response = await route.POST(upload);
  assert.equal(response.status, 415);
  assert.equal(db.calls.length, 0);
});
