const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { createFakeDb, loadRoute, request, mutations } = require('./helpers/route-harness.cjs');
const { createDatabase, applyMigration, createUser, attempt } = require('./helpers/pg-harness.cjs');

const OWNER = '71000000-0000-4000-8000-000000000001';
const ACTOR = '71000000-0000-4000-8000-000000000002';
const STAFF = ['consultor', 'midia', 'medico', 'logistica', 'coordenador', 'casal_diretor'];
const MIGRATION = fs.readdirSync('supabase/migrations').find((file) => file.endsWith('_profile_photo_youth_only_review.sql'))?.split('_')[0];
assert.ok(MIGRATION, 'Migração da aprovação exclusiva de jovens deve existir.');
const PHOTO_ROUTE = 'src/app/api/profile/photo/route.ts';
const REVIEW_ROUTE = 'src/app/api/profile/photo/reviews/route.ts';
const plain = (value) => JSON.parse(JSON.stringify(value));
function photo(role = 'jovem', extra = {}) {
  return { id: OWNER, role, full_name: 'Pessoa Fictícia', company_id: 'cia-1',
    avatar_status: 'pending', avatar_pending_path: `pending/${OWNER}/anterior.jpg`,
    avatar_url: `profile-photos/approved/${OWNER}/anterior.jpg`, avatar_submitted_at: '2026-11-03T00:00:00Z',
    avatar_reviewed_at: null, avatar_reviewed_by: null, avatar_review_note: null, ...extra };
}
function fixture(row, { conflict = false, list = false } = {}) {
  const storage = [];
  const db = createFakeDb({ profiles: (call) => {
    if (call.ops.includes('update')) return conflict ? { data: null, error: null } : { data: { ...row, ...call.payload }, error: null };
    return { data: list ? [row, photo('consultor', { id: ACTOR })] : row, error: null };
  }, companies: { data: [{ id: 'cia-1', name: 'Companhia Fictícia' }], error: null } });
  db.storage = { from: () => ({
    upload: async (path) => { storage.push({ op: 'upload', path }); return { error: null }; },
    remove: async (paths) => { storage.push({ op: 'remove', paths }); return { error: null }; },
    move: async (from, to) => { storage.push({ op: 'move', from, to }); return { error: null }; },
    createSignedUrl: async (path) => ({ data: { signedUrl: `https://example.invalid/private/${path}` }, error: null }),
  }) };
  return { db, storage };
}
function uploadRequest() {
  const req = request('/api/profile/photo', { method: 'POST', body: { role: 'coordenador', approved: true } });
  const file = new Blob([Uint8Array.from([137,80,78,71,13,10,26,10])], { type: 'image/png' });
  req.formData = async () => ({ get: (key) => key === 'file' ? file : 'coordenador' });
  return req;
}
const identity = (role = 'consultor', companyId = 'cia-1') => ({ user: { id: ACTOR }, role, companyId });

test('POST: só jovem aguarda aprovação; os outros seis cargos publicam imediatamente pelo cargo do banco', async () => {
  for (const role of ['jovem', ...STAFF]) {
    const row = photo(role);
    const { db, storage } = fixture(row);
    // A identidade/body simulam um cargo diferente: quem decide é a linha protegida lida do banco.
    const route = loadRoute(PHOTO_ROUTE, { identity: { user: { id: OWNER }, role: 'coordenador' }, db });
    const res = await route.POST(uploadRequest());
    assert.equal(res.status, 201, role);
    assert.equal(res.body.status, role === 'jovem' ? 'pending' : 'approved', role);
    const write = mutations(db).find((call) => call.ops?.includes('update'));
    assert.ok(write.filters.some(([op, key, value]) => op === 'eq' && key === 'role' && value === role));
    const uploaded = storage.find((call) => call.op === 'upload').path;
    if (role === 'jovem') {
      assert.equal(write.payload.avatar_url, undefined);
      assert.ok(res.body.pending_url.endsWith(uploaded));
      assert.ok(res.body.approved_url.endsWith(`approved/${OWNER}/anterior.jpg`));
      assert.ok(!storage.some((call) => call.op === 'remove' && call.paths.includes(`approved/${OWNER}/anterior.jpg`)));
    } else {
      assert.equal(res.body.pending_url, null);
      assert.equal(write.payload.avatar_pending_path, null);
      assert.ok(res.body.approved_url.endsWith(uploaded));
      assert.ok(storage.some((call) => call.op === 'remove' && call.paths.includes(`approved/${OWNER}/anterior.jpg`)));
    }
  }
});

test('POST: alteração concorrente de cargo impede publicação direta e remove só o objeto recém-enviado', async () => {
  const { db, storage } = fixture(photo('consultor'), { conflict: true });
  const route = loadRoute(PHOTO_ROUTE, { identity: { user: { id: OWNER }, role: 'consultor' }, db });
  const res = await route.POST(uploadRequest());
  assert.equal(res.status, 409);
  const uploaded = storage.find((call) => call.op === 'upload').path;
  assert.deepEqual(plain(storage.filter((call) => call.op === 'remove').map((call) => call.paths)), [[uploaded]]);
});

test('GET não devolve pending/rejected para equipe e DELETE limpa a foto publicada', async () => {
  for (const role of STAFF) {
    const row = photo(role);
    const { db } = fixture(row);
    const route = loadRoute(PHOTO_ROUTE, { identity: { user: { id: OWNER }, role }, db });
    const get = await route.GET();
    assert.equal(get.body.status, 'approved');
    assert.equal(get.body.pending_url, null);
    const del = await route.DELETE(request('/api/profile/photo?scope=approved', { method: 'DELETE' }));
    assert.equal(del.body.status, 'none');
    assert.equal(del.body.approved_url, null);
    const rejected = fixture(photo(role, { avatar_status: 'rejected', avatar_pending_path: null, avatar_url: null, avatar_review_note: 'Motivo antigo' }));
    const empty = await loadRoute(PHOTO_ROUTE, { identity: { user: { id: OWNER }, role }, db: rejected.db }).GET();
    assert.equal(empty.body.status, 'none');
    assert.equal(empty.body.review_note, null);
  }
});

test('cancelamento concorrente não apaga objeto que uma promoção acabou de publicar', async () => {
  for (const [role, scope, column] of [['jovem','pending','avatar_pending_path'],['consultor','approved','avatar_url']]) {
    const { db, storage } = fixture(photo(role), { conflict: true });
    const route = loadRoute(PHOTO_ROUTE, { identity: { user: { id: OWNER }, role }, db });
    const res = await route.DELETE(request(`/api/profile/photo?scope=${scope}`, { method: 'DELETE' }));
    assert.equal(res.status,409);
    assert.equal(storage.length,0);
    const write = mutations(db)[0];
    assert.ok(write.filters.some(([op,key,value])=>op==='eq'&&key==='role'&&value===role));
    assert.ok(write.filters.some(([op,key])=>op==='eq'&&key===column));
  }
});

test('fila é exclusivamente de jovens pendentes da própria companhia; equipe nunca vira alvo de moderação', async () => {
  const { db } = fixture(photo(), { list: true });
  const res = await loadRoute(REVIEW_ROUTE, { identity: identity(), db }).GET();
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].user_id, OWNER);
  assert.ok(db.calls[0].filters.some(([op, key, value]) => op === 'eq' && key === 'role' && value === 'jovem'));
  assert.ok(db.calls[0].filters.some(([op, key, value]) => op === 'eq' && key === 'company_id' && value === 'cia-1'));
  for (const role of STAFF) {
    const target = fixture(photo(role));
    const denied = await loadRoute(REVIEW_ROUTE, { identity: identity('coordenador'), db: target.db })
      .POST(request('/api/profile/photo/reviews', { method: 'POST', body: { user_id: OWNER, decision: 'approve' } }));
    assert.equal(denied.status, 404);
    assert.equal(mutations(target.db).length, 0);
    assert.equal(target.storage.length, 0);
  }
});

test('consultor sem companhia/outra companhia não decide; gestão mantém moderação de jovens', async () => {
  for (const company of [null, 'cia-2']) {
    const { db, storage } = fixture(photo());
    const res = await loadRoute(REVIEW_ROUTE, { identity: identity('consultor', company), db })
      .POST(request('/api/profile/photo/reviews', { method: 'POST', body: { user_id: OWNER, decision: 'approve' } }));
    assert.equal(res.status, company ? 404 : 403);
    assert.equal(mutations(db).length, 0);
    assert.equal(storage.length, 0);
  }
  for (const role of ['jovem', 'midia', 'medico']) {
    const { db } = fixture(photo());
    const res = await loadRoute(REVIEW_ROUTE, { identity: identity(role), db }).GET();
    assert.equal(res.status, 403);
    assert.equal(db.calls.length, 0);
  }
  for (const role of ['logistica', 'coordenador', 'casal_diretor']) {
    const { db } = fixture(photo());
    const res = await loadRoute(REVIEW_ROUTE, { identity: identity(role, 'cia-2'), db })
      .POST(request('/api/profile/photo/reviews', { method: 'POST', body: { user_id: OWNER, decision: 'approve' } }));
    assert.equal(res.status, 200, role);
  }
});

test('revisão concorrente não aprova/recusa outro envio nem remove foto que virou publicação automática', async () => {
  for (const decision of ['approve', 'reject']) {
    const { db, storage } = fixture(photo(), { conflict: true });
    const res = await loadRoute(REVIEW_ROUTE, { identity: identity(), db })
      .POST(request('/api/profile/photo/reviews', { method: 'POST', body: { user_id: OWNER, decision, note: 'Motivo fictício' } }));
    assert.equal(res.status, 409);
    const write = mutations(db)[0];
    for (const [key, value] of [['role','jovem'], ['company_id','cia-1'], ['avatar_status','pending'], ['avatar_pending_path',`pending/${OWNER}/anterior.jpg`]]) {
      assert.ok(write.filters.some(([op, field, sent]) => op === 'eq' && field === key && sent === value));
    }
    assert.equal(storage.filter((call) => call.op === 'remove').length, 0);
    if (decision === 'approve') {
      const moves = storage.filter((call) => call.op === 'move');
      assert.equal(moves.length, 2);
      assert.equal(moves[1].from, moves[0].to);
      assert.equal(moves[1].to, moves[0].from);
    }
  }
});

test('SQL real: seis cargos, backfill reaplicável, promoção/demissão e proteção contra escrita direta', async () => {
  const db = await createDatabase({ upTo: '202611020002' });
  try {
    const people = [];
    for (const [i, role] of ['jovem', ...STAFF].entries()) {
      const id = `72000000-0000-4000-8000-${String(i + 1).padStart(12,'0')}`;
      people.push({ id, role });
      await createUser(db, { id, role, email: `foto-sintetica-${i}@example.invalid` });
      await db.query(`UPDATE public.profiles SET avatar_status='pending',avatar_pending_path=$2,
        avatar_url=$3,avatar_review_note='Motivo antigo' WHERE id=$1`, [id, `pending/${id}/nova.jpg`, `profile-photos/approved/${id}/antiga.jpg`]);
    }
    await applyMigration(db, MIGRATION);
    for (const { id, role } of people) {
      const row = (await db.query('SELECT avatar_status,avatar_url,avatar_pending_path,avatar_review_note FROM public.profiles WHERE id=$1',[id])).rows[0];
      assert.equal(row.avatar_status, role === 'jovem' ? 'pending' : 'approved', role);
      assert.equal(row.avatar_url, `profile-photos/${role === 'jovem' ? 'approved' : 'pending'}/${id}/${role === 'jovem' ? 'antiga' : 'nova'}.jpg`);
      if (role !== 'jovem') { assert.equal(row.avatar_pending_path,null); assert.equal(row.avatar_review_note,null); }
      const denied = await attempt(db, { sub: id }, `UPDATE public.profiles SET avatar_url='https://example.invalid/forjada.jpg',avatar_status='approved' WHERE id=$1`,[id]);
      assert.equal(denied.ok,false,role);
    }
    await applyMigration(db, MIGRATION);
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.profiles WHERE role::text<>'jovem' AND (avatar_status IN ('pending','rejected') OR avatar_pending_path IS NOT NULL)`)).rows[0].n,0);
    const youth = people[0].id;
    await db.query(`UPDATE public.profiles SET role='consultor' WHERE id=$1`,[youth]);
    let current = (await db.query('SELECT avatar_status,avatar_url,avatar_pending_path FROM public.profiles WHERE id=$1',[youth])).rows[0];
    assert.equal(current.avatar_status,'approved');
    assert.equal(current.avatar_pending_path,null);
    assert.equal(current.avatar_url,`profile-photos/pending/${youth}/nova.jpg`);
    await db.query(`UPDATE public.profiles SET role='jovem',avatar_status='pending',avatar_pending_path=$2 WHERE id=$1`,[youth,`pending/${youth}/mais-recente.jpg`]);
    current = (await db.query('SELECT avatar_status,avatar_url,avatar_pending_path FROM public.profiles WHERE id=$1',[youth])).rows[0];
    assert.equal(current.avatar_status,'pending');
    assert.equal(current.avatar_url,`profile-photos/pending/${youth}/nova.jpg`);
    assert.equal(current.avatar_pending_path,`pending/${youth}/mais-recente.jpg`);
    for (const { id, role } of people.slice(1)) {
      // Compatibilidade com servidor antigo: um UPDATE pending de equipe já retorna approved.
      const allowed = await attempt(db,{ role:'service_role' },`UPDATE public.profiles SET avatar_status='pending',avatar_pending_path=$2 WHERE id=$1 RETURNING avatar_status,avatar_pending_path`,[id,`pending/${id}/outra.jpg`]);
      assert.equal(allowed.ok,true,role);
      assert.deepEqual(plain(allowed.result.rows[0]),{ avatar_status:'approved',avatar_pending_path:null });
    }
  } finally { await db.close(); }
});
