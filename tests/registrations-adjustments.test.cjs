const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { createFakeDb, loadRoute, request, mutations } = require('./helpers/route-harness.cjs');
const { createDatabase, applyMigration, createUser, attempt } = require('./helpers/pg-harness.cjs');

const ID = '61000000-0000-4000-8000-000000000001';
const ACTOR = '61000000-0000-4000-8000-000000000002';
const COORD = { user: { id: ACTOR }, role: 'coordenador', fullName: 'Gestora Fictícia' };
const JOVEM = { user: { id: ID }, role: 'jovem' };
const routePath = 'src/app/api/admin/registrations/[id]/route.ts';
const context = { params: Promise.resolve({ id: ID }) };

test('PATCH valida CPF, datas, telefones e campos permitidos, sem escrever em caso de erro', async () => {
  for (const body of [
    { adjustments: { cpf: '111.111.111-11' } },
    { adjustments: { cpf: '52998224724' } },
    { adjustments: { birthDate: '31/02/2011' } },
    { adjustments: { birthDate: '01/01/2099' } },
    { adjustments: { phone: '123' } },
    { adjustments: { guardianPhone: 'telefone16999990000' } },
    { adjustments: { status: 'Aprovado' } },
    { adjustments: {} }, { resetAdjustments: false },
    { adjustments: { firstName: 'Ana' }, editedByUserId: ID },
  ]) {
    const db = createFakeDb();
    const route = loadRoute(routePath, { identity: COORD, db });
    const response = await route.PATCH(request(`/api/admin/registrations/${ID}`, { method: 'PATCH', body }), context);
    assert.equal(response.status, 400);
    assert.equal(mutations(db).length, 0);
  }
});

test('PATCH mescla ajustes e desfaz pelo servidor, mantendo os dados importados', async () => {
  let values = {};
  const db = createFakeDb({
    [`rpc:admin_patch_registration_authorization`]: (payload) => {
      assert.equal(payload.p_actor_id, ACTOR);
      assert.equal(payload.p_registration_id, ID);
      values = payload.p_reset ? {} : { ...values, ...payload.p_adjustments };
      return { data: null, error: null };
    },
    event_registrations: () => ({ data: {
      id: ID, first_name_raw: 'ANA', last_name_raw: 'SILVA', full_name_raw: 'ANA SILVA',
      cpf_raw: 'original inválido', raw_columns: { firstName: 'ANA', cpf: 'original inválido' },
      authorization_adjustments: { values_json: values, edited_by_user_id: ACTOR, edited_by_name: 'Gestora Fictícia', edited_at: '2026-11-02T12:00:00Z' },
    }, error: null }),
  });
  const route = loadRoute(routePath, { identity: COORD, db });
  for (const body of [{ adjustments: { cpf: '529.982.247-25', firstName: 'Ágata' } }, { adjustments: { phone: '+55 (16) 99999-0000' } }]) {
    const response = await route.PATCH(request(`/api/admin/registrations/${ID}`, { method: 'PATCH', body }), context);
    assert.equal(response.status, 200);
    assert.equal(response.body.firstNameRaw, 'ANA');
    assert.equal(response.body.cpfRaw, 'original inválido');
    assert.equal(response.body.rawColumns.cpf, 'original inválido');
    assert.equal(response.body.authorizationAdjustments.values.firstName, 'Ágata');
    assert.equal(response.body.authorizationAdjustments.editedByUserId, ACTOR);
    assert.equal(response.headers['Cache-Control'], 'private, no-store, max-age=0');
  }
  const reset = await route.PATCH(request(`/api/admin/registrations/${ID}`, { method: 'PATCH', body: { resetAdjustments: true } }), context);
  assert.equal(reset.body.authorizationAdjustments, null);
  assert.equal(reset.body.hasAuthorizationAdjustments, false);
});

test('jovem não descobre inscrições nem gera prévia/PDF/ZIP; origem externa não altera dados', async () => {
  const db = createFakeDb();
  const route = loadRoute(routePath, { identity: JOVEM, db });
  assert.equal((await route.GET(request(`/api/admin/registrations/${ID}`), context)).status, 403);
  assert.equal((await route.PATCH(request(`/api/admin/registrations/${ID}`, { method: 'PATCH', body: { resetAdjustments: true } }), context)).status, 403);
  const pdf = loadRoute('src/app/api/admin/registrations/[id]/authorization-pdf/route.ts', { identity: JOVEM, db });
  assert.equal((await pdf.GET(request(`/api/admin/registrations/${ID}/authorization-pdf`), context)).status, 403);
  assert.equal((await pdf.POST(request(`/api/admin/registrations/${ID}/authorization-pdf`, { method: 'POST', body: { adjustments: { firstName: 'Ana' } } }), context)).status, 403);
  const batch = loadRoute('src/app/api/admin/registrations/authorization-pdf-batch/route.ts', { identity: JOVEM, db });
  assert.equal((await batch.POST(request('/api/admin/registrations/authorization-pdf-batch', { method: 'POST', body: {} }))).status, 403);
  const coord = loadRoute(routePath, { identity: COORD, db });
  assert.equal((await coord.PATCH(request(`/api/admin/registrations/${ID}`, { method: 'PATCH', body: { resetAdjustments: true }, headers: { origin: 'https://outro.test' } }), context)).status, 403);
  assert.equal(db.calls.length, 0);
});

test('projeção mínima não vaza ajustes e contagens excluem cancelados', () => {
  const repo = loadRoute('src/lib/registrations/repository.ts');
  const rec = { status: 'Aprovado', roleCategory: 'Participante', authorizationAdjustments: { values: { cpf: 'segredo' } }, hasAuthorizationAdjustments: true };
  assert.equal(repo.projectRegistrationListItem(rec, 'minimal').authorizationAdjustments, null);
  const metrics = repo.computeRegistrationMetrics([rec, { ...rec, status: 'Cancelado' }, { ...rec, status: 'Aguardando aprovação' }]);
  assert.equal(metrics.participantCount, 2);
  assert.equal(metrics.confirmedCount, 1);
  assert.equal(metrics.totalCount, 3);
});

test('prévia PDF incorpora rascunho e ajustes salvos, sem persistir; cancelados não geram autorização', async () => {
  let rendered;
  const db = createFakeDb({ event_registrations: { data: { id: ID, status: 'Aprovado', authorization_adjustments: { values_json: { guardianName: 'Responsável Fictícia' } } }, error: null } });
  const pdf = loadRoute('src/app/api/admin/registrations/[id]/authorization-pdf/route.ts', {
    identity: COORD, db, extraModules: { '@/lib/pdf/authorization-pdf': { renderAuthorizationPdfBuffer(record) {
      rendered = record;
      return { pdfBuffer: Buffer.from('%PDF-ficticio'), payload: { suggestedFilename: 'autorizacao-agata.pdf', overflowFields: [], hasOverflowWarning: false } };
    } } },
  });
  const response = await pdf.POST(request(`/api/admin/registrations/${ID}/authorization-pdf?download=0`, { method: 'POST', body: { adjustments: { firstName: 'Ágata' } } }), context);
  assert.equal(response.status, 200);
  assert.equal(rendered.authorizationAdjustments.values.firstName, 'Ágata');
  assert.equal(rendered.authorizationAdjustments.values.guardianName, 'Responsável Fictícia');
  assert.equal(mutations(db).length, 0);
  const cancelledDb = createFakeDb({ event_registrations: { data: { id: ID, status: 'Cancelado' }, error: null } });
  const cancelled = loadRoute('src/app/api/admin/registrations/[id]/authorization-pdf/route.ts', { identity: COORD, db: cancelledDb });
  assert.equal((await cancelled.GET(request(`/api/admin/registrations/${ID}/authorization-pdf`), context)).status, 409);
});

test('ZIP por filtro usa aprovados; seleção explícita aceita pendentes e exclui cancelados', async () => {
  const records = ['Aprovado', 'Aguardando aprovação', 'Em lista de espera', 'Cancelado'].map((status, i) => ({ id: `61000000-0000-4000-8000-00000000001${i}`, status, role_category: 'Participante' }));
  let selected;
  const batch = loadRoute('src/app/api/admin/registrations/authorization-pdf-batch/route.ts', {
    identity: COORD, db: createFakeDb({ event_registrations: { data: records, error: null } }),
    extraModules: { '@/lib/pdf/authorization-pdf': { generateAuthorizationPdfBatchZip({ records }) {
      selected = records;
      return { zipBuffer: Buffer.from('PK'), progress: { totalParts: 1, partIndex: 1, totalEligibleCount: records.length, partSize: 50, overflowWarningCount: 0 } };
    } } },
  });
  assert.equal((await batch.POST(request('/api/admin/registrations/authorization-pdf-batch', { method: 'POST', body: {} }))).status, 200);
  assert.equal(selected.length, 1);
  assert.equal((await batch.POST(request('/api/admin/registrations/authorization-pdf-batch', { method: 'POST', body: { registrationIds: records.map((r) => r.id) } }))).status, 200);
  assert.equal(selected.length, 3);
});

test('SQL real: ajustes privados, reaplicação segura, auditoria e reimportação preservando original', async () => {
  const db = await createDatabase();
  try {
    await createUser(db, { id: ACTOR, email: 'gestora-ajustes@fsy.test', role: 'coordenador', name: 'Gestora Fictícia' });
    const raw = { id: ID, dedupKey: 'cpf:52998224725', roleCategory: 'Participante', status: 'Aprovado', firstNameRaw: 'ANA', lastNameRaw: '', fullNameRaw: 'ANA', firstNameNormalized: 'Ana', lastNameNormalized: '', fullNameNormalized: 'Ana', rawColumns: { firstName: 'ANA' } };
    async function previewCommit(num, rows, mode = 'upsert', acknowledge = false) {
      const previewId = `62000000-0000-4000-8000-${String(num).padStart(12, '0')}`;
      const revision = (await db.query('SELECT current_revision FROM public.registration_state_meta WHERE id = 1')).rows[0].current_revision;
      await db.query(`INSERT INTO public.registration_import_previews (id,created_by_user_id,base_revision,filename,file_sha256,file_size_bytes,can_commit,summary_json,rows_json) VALUES ($1,$2,$3,'sintetica.xlsx','sintetica',1,true,'{}',$4)`, [previewId, ACTOR, revision, JSON.stringify(rows)]);
      return db.query(`SELECT public.admin_commit_registration_preview_with_adjustments($1,$2,'Gestora Fictícia',$3,$4,$5,true,$6) AS result`, [previewId, ACTOR, mode, revision, `ajustes-${num}`, acknowledge]);
    }
    await previewCommit(1, [raw]);
    await db.query(`SELECT public.admin_patch_registration_authorization($1,$2,$3,false)`, [ID, ACTOR, JSON.stringify({ firstName: 'Ágata', guardianName: 'Conceição Fictícia' })]);
    await previewCommit(2, [{ ...raw, firstNameRaw: 'ANA REIMPORTADA' }], 'replace_all');
    const persisted = (await db.query('SELECT r.first_name_raw, a.* FROM public.event_registrations r JOIN public.registration_authorization_adjustments a ON a.registration_id=r.id WHERE r.id=$1', [ID])).rows[0];
    assert.equal(persisted.first_name_raw, 'ANA REIMPORTADA');
    assert.equal(persisted.values_json.firstName, 'Ágata');
    assert.equal(persisted.edited_by_user_id, ACTOR);
    assert.ok(persisted.edited_at);
    // Reaplicar após uso real preserva o original, os ajustes e a autoria, sem duplicar o trigger.
    await applyMigration(db, '202611020002');
    const replayed = (await db.query('SELECT r.first_name_raw, a.* FROM public.event_registrations r JOIN public.registration_authorization_adjustments a ON a.registration_id=r.id WHERE r.id=$1', [ID])).rows[0];
    assert.deepEqual(replayed, persisted);
    const protection = (await db.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid='public.registration_authorization_adjustments'::regclass`)).rows[0];
    assert.deepEqual(protection, { relrowsecurity: true, relforcerowsecurity: true });
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgrelid='public.registration_import_batches'::regclass AND tgname='registration_batch_counts_without_cancelled' AND NOT tgisinternal`)).rows[0].n, 1);
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await attempt(db, { role }, 'SELECT * FROM public.registration_authorization_adjustments')).ok, false);
      assert.equal((await attempt(db, { role }, `SELECT public.admin_patch_registration_authorization($1,$2,'{}',true)`, [ID, ACTOR])).ok, false);
    }
    const replacement = { ...raw, id: '61000000-0000-4000-8000-000000000099', dedupKey: 'cpf:11144477735' };
    await assert.rejects(previewCommit(3, [replacement], 'replace_all'), /ajustes/);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.event_registrations WHERE id=$1', [ID])).rows[0].n, 1);
    await db.query(`SELECT public.admin_patch_registration_authorization($1,$2,'{}',true)`, [ID, ACTOR]);
    assert.deepEqual((await db.query('SELECT values_json FROM public.registration_authorization_adjustments WHERE registration_id=$1', [ID])).rows[0].values_json, {});
    await db.query(`SELECT public.admin_patch_registration_authorization($1,$2,'{"firstName":"Ágata"}',false)`, [ID, ACTOR]);
    await previewCommit(4, [replacement], 'replace_all', true);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.registration_authorization_adjustments')).rows[0].n, 0);
  } finally { await db.close(); }
});

test('tela de inscrições continua protegida na página e navegação administrativa', () => {
  const page = fs.readFileSync('src/app/admin/inscricoes/page.tsx', 'utf8');
  assert.match(page, /userManagers|coordenador/);
});
