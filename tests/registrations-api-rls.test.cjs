const assert = require("node:assert/strict");
const { test, before, after } = require("node:test");
const { createDatabase, as, attempt, createUser } = require("./helpers/pg-harness.cjs");
const { createFakeDb, loadRoute, request } = require("./helpers/route-harness.cjs");

const ID = {
  jovem: "40000000-0000-4000-8000-000000000001",
  consultor: "40000000-0000-4000-8000-000000000002",
  midia: "40000000-0000-4000-8000-000000000003",
  medico: "40000000-0000-4000-8000-000000000004",
  coord: "40000000-0000-4000-8000-000000000005",
  logistica: "40000000-0000-4000-8000-000000000006",
  suspenso: "40000000-0000-4000-8000-000000000007",
};

let db;

before(async () => {
  db = await createDatabase();
  await createUser(db, { id: ID.jovem, email: "jovem@fsy.test", role: "jovem" });
  await createUser(db, { id: ID.consultor, email: "cons@fsy.test", role: "consultor" });
  await createUser(db, { id: ID.midia, email: "midia@fsy.test", role: "midia" });
  await createUser(db, { id: ID.medico, email: "med@fsy.test", role: "medico" });
  await createUser(db, { id: ID.coord, email: "coord@fsy.test", role: "coordenador", name: "Coordenador Um" });
  await createUser(db, { id: ID.logistica, email: "log@fsy.test", role: "logistica", name: "Logística Dois" });
  await createUser(db, { id: ID.suspenso, email: "susp@fsy.test", role: "coordenador" });
  await db.query(`UPDATE public.profiles SET suspended_at = now() WHERE id = $1`, [ID.suspenso]);
});

after(async () => {
  if (db && typeof db.close === "function") {
    await db.close();
  }
});

test("A3 + M1: Grants revogam leitura direta via PostgREST para authenticated e commit limpa rows_json/sampleRows", async () => {
  const previewId = "50000000-0000-4000-8000-000000000001";
  const expiredPreviewId = "50000000-0000-4000-8000-000000000099";
  const rowPayload = {
    id: "60000000-0000-4000-8000-000000000001",
    dedupKey: "cpf:02314509835",
    roleCategory: "Participante",
    status: "Confirmado",
    firstNameRaw: "LUCAS",
    lastNameRaw: "SILVA",
    fullNameRaw: "LUCAS SILVA",
    firstNameNormalized: "Lucas",
    lastNameNormalized: "Silva",
    fullNameNormalized: "Lucas Silva",
    rawColumns: { firstName: "LUCAS", lastName: "SILVA" },
  };

  await as(db, { role: "service_role" }, async (tx) => {
    // Insere um preview expirado e um ativo
    await tx.query(
      `INSERT INTO public.registration_import_previews
       (id, created_by_user_id, base_revision, filename, file_sha256, file_size_bytes, can_commit, summary_json, rows_json, expires_at)
       VALUES
       ($1, $3, 0, 'expirado.xlsx', 'sha-exp', 512, true, '{"warningCount":0}'::jsonb, $4::jsonb, now() - interval '5 minutes'),
       ($2, $3, 0, 'teste.xlsx', 'sha256', 1024, true, '{"warningCount":0,"sampleRows":[{"id":"1"}],"nameChanges":[{"id":"1"}]}'::jsonb, $4::jsonb, now() + interval '30 minutes')`,
      [expiredPreviewId, previewId, ID.coord, JSON.stringify([rowPayload])]
    );
    const res = await tx.query(
      `SELECT public.admin_commit_registration_preview($1, $2, 'Coord', 'upsert', 0, 'idem-key-0001', true) AS out`,
      [previewId, ID.coord]
    );
    assert.equal(res.rows[0].out.ok, true);
    assert.equal(res.rows[0].out.currentRevision, 1);

    // M1: Preview expirado foi removido e o preview confirmado teve rows_json e sampleRows zerados
    const expCheck = await tx.query(
      `SELECT id FROM public.registration_import_previews WHERE id = $1`,
      [expiredPreviewId]
    );
    assert.equal(expCheck.rows.length, 0, "preview expirado deve ser expurgado no commit");

    const committedPreview = (
      await tx.query(
        `SELECT rows_json, summary_json FROM public.registration_import_previews WHERE id = $1`,
        [previewId]
      )
    ).rows[0];
    assert.deepEqual(committedPreview.rows_json, []);
    assert.deepEqual(committedPreview.summary_json.sampleRows, []);
    assert.deepEqual(committedPreview.summary_json.nameChanges, []);
  });

  // A3: Nenhum papel autenticado (nem coordenador) ou anônimo pode ler diretamente as 4 tabelas pelo PostgREST
  for (const table of [
    "event_registrations",
    "registration_import_batches",
    "registration_import_previews",
    "registration_state_meta",
  ]) {
    const coordAttempt = await attempt(db, { sub: ID.coord }, `SELECT * FROM public.${table}`);
    assert.equal(coordAttempt.ok, false, `authenticated não deve ter GRANT SELECT direto em ${table}`);
    const anonAttempt = await attempt(db, { role: "anon" }, `SELECT * FROM public.${table}`);
    assert.equal(anonAttempt.ok, false, `anon não deve ter GRANT SELECT direto em ${table}`);
  }

  // Nenhum papel autenticado pode chamar as RPCs administrativas diretamente
  const rpcAttempt = await attempt(
    db,
    { sub: ID.coord },
    `SELECT public.admin_delete_registration_batch('50000000-0000-4000-8000-000000000001'::uuid, $1::uuid)`,
    [ID.coord]
  );
  assert.equal(rpcAttempt.ok, false);
});

test("A1 + A2: isolamento completo, idempotência vinculada aos parâmetros (409 em divergência) e exclusão escopada ao lote", async () => {
  await db.query(`DELETE FROM public.event_registrations`);
  await db.query(`DELETE FROM public.registration_import_batches`);
  await db.query(`DELETE FROM public.registration_import_previews`);
  await db.query(`UPDATE public.registration_state_meta SET current_revision = 0, active_batch_id = NULL WHERE id = 1`);

  const profilesBefore = (await db.query(`SELECT count(*)::int AS n FROM public.profiles`)).rows[0].n;
  const medicalBefore = (await db.query(`SELECT count(*)::int AS n FROM public.medical_records`)).rows[0].n;
  const companiesBefore = (await db.query(`SELECT count(*)::int AS n FROM public.companies`)).rows[0].n;

  const preview1 = "50000000-0000-4000-8000-000000000011";
  const previewStale = "50000000-0000-4000-8000-000000000012";
  const preview2 = "50000000-0000-4000-8000-000000000013";

  const row1 = {
    id: "60000000-0000-4000-8000-000000000011",
    dedupKey: "cpf:02314509835",
    roleCategory: "Participante",
    status: "Confirmado",
    firstNameRaw: "ANA",
    lastNameRaw: "COSTA",
    fullNameRaw: "ANA COSTA",
    firstNameNormalized: "Ana",
    lastNameNormalized: "Costa",
    fullNameNormalized: "Ana Costa",
    rawColumns: { firstName: "ANA", lastName: "COSTA" },
  };

  const row2 = {
    id: "60000000-0000-4000-8000-000000000012",
    dedupKey: "cpf:52998224725",
    roleCategory: "Consultor",
    status: "Confirmado",
    firstNameRaw: "MARCOS",
    lastNameRaw: "LIMA",
    fullNameRaw: "MARCOS LIMA",
    firstNameNormalized: "Marcos",
    lastNameNormalized: "Lima",
    fullNameNormalized: "Marcos Lima",
    rawColumns: { firstName: "MARCOS", lastName: "LIMA" },
  };

  await db.query(
    `INSERT INTO public.registration_import_previews
     (id, created_by_user_id, base_revision, filename, file_sha256, file_size_bytes, can_commit, summary_json, rows_json)
     VALUES
     ($1, $3, 0, 'lote1.xlsx', 'h1', 100, true, '{"warningCount":0}'::jsonb, $4::jsonb),
     ($2, $3, 0, 'stale.xlsx', 'h2', 100, true, '{"warningCount":0}'::jsonb, $4::jsonb)`,
    [preview1, previewStale, ID.coord, JSON.stringify([row1])]
  );

  // 1. Outro administrador não pode confirmar o preview criado por ID.coord
  const wrongActor = await attempt(
    db,
    { role: "service_role" },
    `SELECT public.admin_commit_registration_preview($1, $2, 'Logística', 'upsert', 0, 'idem-wrong-actor', true)`,
    [preview1, ID.logistica]
  );
  assert.equal(wrongActor.ok, false);
  assert.equal(wrongActor.error.code, "42501");

  // 2. Commit válido do lote 1 (revisão 0 -> 1, 1 pessoa inserida)
  const commit1 = (
    await db.query(
      `SELECT public.admin_commit_registration_preview($1, $2, 'Coord', 'upsert', 0, 'idem-lote-1', true) AS out`,
      [preview1, ID.coord]
    )
  ).rows[0].out;
  assert.equal(commit1.currentRevision, 1);
  assert.equal(commit1.idempotentReplay, false);

  // 3. Replay com mesma idempotencyKey e mesmos parâmetros retorna o mesmo lote
  const replay1 = (
    await db.query(
      `SELECT public.admin_commit_registration_preview($1, $2, 'Coord', 'upsert', 0, 'idem-lote-1', true) AS out`,
      [preview1, ID.coord]
    )
  ).rows[0].out;
  assert.equal(replay1.idempotentReplay, true);
  assert.equal(replay1.batchId, commit1.batchId);
  assert.equal(replay1.currentRevision, 1);

  // 3b (A2): Reusar a mesma idempotencyKey com outro previewId ou outro mode falha com 40001
  const mismatchedKeyMode = await attempt(
    db,
    { role: "service_role" },
    `SELECT public.admin_commit_registration_preview($1, $2, 'Coord', 'replace_all', 0, 'idem-lote-1', true)`,
    [preview1, ID.coord]
  );
  assert.equal(mismatchedKeyMode.ok, false);
  assert.equal(mismatchedKeyMode.error.code, "40001");

  const mismatchedKeyPreview = await attempt(
    db,
    { role: "service_role" },
    `SELECT public.admin_commit_registration_preview($1, $2, 'Coord', 'upsert', 0, 'idem-lote-1', true)`,
    [previewStale, ID.coord]
  );
  assert.equal(mismatchedKeyPreview.ok, false);
  assert.equal(mismatchedKeyPreview.error.code, "40001");

  const mismatchedKeyRevision = await attempt(
    db,
    { role: "service_role" },
    `SELECT public.admin_commit_registration_preview($1, $2, 'Coord', 'upsert', 99, 'idem-lote-1', true)`,
    [preview1, ID.coord]
  );
  assert.equal(mismatchedKeyRevision.ok, false);
  assert.equal(mismatchedKeyRevision.error.code, "40001");

  // 4. Preview stale (base_revision = 0 quando current_revision = 1) falha com 40001
  const staleCommit = await attempt(
    db,
    { role: "service_role" },
    `SELECT public.admin_commit_registration_preview($1, $2, 'Coord', 'upsert', 1, 'idem-stale', true)`,
    [previewStale, ID.coord]
  );
  assert.equal(staleCommit.ok, false);
  assert.equal(staleCommit.error.code, "40001");

  // 5. Commit de um segundo lote em modo upsert trazendo apenas row2 (revisão 1 -> 2)
  await db.query(
    `INSERT INTO public.registration_import_previews
     (id, created_by_user_id, base_revision, filename, file_sha256, file_size_bytes, can_commit, summary_json, rows_json)
     VALUES ($1, $2, 1, 'lote2.xlsx', 'h3', 100, true, '{"warningCount":0}'::jsonb, $3::jsonb)`,
    [preview2, ID.coord, JSON.stringify([row2])]
  );
  const commit2 = (
    await db.query(
      `SELECT public.admin_commit_registration_preview($1, $2, 'Coord', 'upsert', 1, 'idem-lote-2', true) AS out`,
      [preview2, ID.coord]
    )
  ).rows[0].out;
  assert.equal(commit2.currentRevision, 2);

  // 6 (A1): Excluir o lote ativo (commit2.batchId) apaga APENAS row2 (1 registro que pertence a commit2)
  // e mantém row1 (do lote 1) intacta, definindo activeBatchId = null sem promover o lote 1!
  const delActive = (
    await db.query(`SELECT public.admin_delete_registration_batch($1::uuid, $2::uuid) AS out`, [
      commit2.batchId,
      ID.coord,
    ])
  ).rows[0].out;
  assert.equal(delActive.activeBatchId, null);
  assert.equal(delActive.deletedRecordsCount, 1);
  const remainingRegs = (await db.query(`SELECT full_name_normalized FROM public.event_registrations`)).rows;
  assert.equal(remainingRegs.length, 1);
  assert.equal(remainingRegs[0].full_name_normalized, "Ana Costa");

  // 7. Confirma isolamento total: profiles, medical_records e companies intocados
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.profiles`)).rows[0].n, profilesBefore);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.medical_records`)).rows[0].n, medicalBefore);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.companies`)).rows[0].n, companiesBefore);
});

test("M2 + B1: endpoints HTTP /api/admin/registrations validam RBAC, retornam 503 só em 42P01/PGRST205, propagam 500 em 42703 e servem detalhe [id]", async () => {
  const ANON = { user: null, role: null };
  const JOVEM = { user: { id: ID.jovem }, role: "jovem" };
  const MEDICO = { user: { id: ID.medico }, role: "medico" };
  const COORD = { user: { id: ID.coord }, role: "coordenador", fullName: "Coordenador" };

  const mainRoute = loadRoute("src/app/api/admin/registrations/route.ts", { identity: ANON });
  assert.equal((await mainRoute.GET(request("/api/admin/registrations"))).status, 401);

  const medicoRoute = loadRoute("src/app/api/admin/registrations/route.ts", { identity: MEDICO });
  assert.equal((await medicoRoute.GET(request("/api/admin/registrations"))).status, 403);

  const exportRouteJovem = loadRoute("src/app/api/admin/registrations/export-xlsx/route.ts", {
    identity: JOVEM,
  });
  assert.equal((await exportRouteJovem.GET(request("/api/admin/registrations/export-xlsx"))).status, 403);

  const deleteRouteCoord = loadRoute(
    "src/app/api/admin/registrations/batches/[batchId]/route.ts",
    { identity: COORD }
  );
  const delAllRes = await deleteRouteCoord.DELETE(
    request("/api/admin/registrations/batches/all", { method: "DELETE" }),
    { params: { batchId: "all" } }
  );
  assert.equal(delAllRes.status, 400);
  assert.equal(delAllRes.body.code, "INVALID_BATCH_ID");

  // M2: Tabela ainda não migrada (42P01) -> 503 REGISTRATIONS_NOT_MIGRATED
  const unmigratedDb = createFakeDb({
    registration_state_meta: {
      data: null,
      error: { code: "42P01", message: 'relation "public.registration_state_meta" does not exist' },
    },
  });
  const unmigratedRoute = loadRoute("src/app/api/admin/registrations/route.ts", {
    identity: COORD,
    db: unmigratedDb,
  });
  const res503 = await unmigratedRoute.GET(request("/api/admin/registrations"));
  assert.equal(res503.status, 503);
  assert.equal(res503.body.code, "REGISTRATIONS_NOT_MIGRATED");

  // M2: Erro de coluna inexistente (42703) -> propaga 500 (NUNCA devolve lista vazia 200!)
  const columnDriftDb = createFakeDb({
    registration_state_meta: {
      data: null,
      error: { code: "42703", message: 'column "broken_col" does not exist' },
    },
  });
  const driftRoute = loadRoute("src/app/api/admin/registrations/route.ts", {
    identity: COORD,
    db: columnDriftDb,
  });
  const res500 = await driftRoute.GET(request("/api/admin/registrations"));
  assert.equal(res500.status, 500);

  // B1: GET /api/admin/registrations/[id] entrega o registro completo para userManagers e 403 para outros
  const recId = "60000000-0000-4000-8000-000000000011";
  const detailDb = createFakeDb({
    event_registrations: {
      data: {
        id: recId,
        batch_id: null,
        dedup_key: "cpf:02314509835",
        role_category: "Participante",
        status: "Confirmado",
        first_name_raw: "ANA",
        last_name_raw: "COSTA",
        full_name_raw: "ANA COSTA",
        first_name_normalized: "Ana",
        last_name_normalized: "Costa",
        full_name_normalized: "Ana Costa",
        cpf_raw: "023.145.098-35",
        medical_info_raw: "Asma leve",
        raw_columns: { firstName: "ANA", lastName: "COSTA" },
        record_payload: {},
      },
      error: null,
    },
  });
  const detailCoord = loadRoute("src/app/api/admin/registrations/[id]/route.ts", {
    identity: COORD,
    db: detailDb,
  });
  const detailRes = await detailCoord.GET(request(`/api/admin/registrations/${recId}`), {
    params: { id: recId },
  });
  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.body.cpfRaw, "023.145.098-35");
  assert.equal(detailRes.body.medicalInfoRaw, "Asma leve");

  // N1: projectRegistrationListItem com projection="minimal" zera todos os telefones, e-mails, responsáveis, bispo, contatos, documentos e saúde
  const repo = loadRoute("src/lib/registrations/repository.ts");
  const fullRec = {
    ...detailRes.body,
    phoneRaw: "(16) 99999-0001",
    email: "ana@fsy.test",
    guardianNameRaw: "MARIA COSTA",
    guardianNameNormalized: "Maria Costa",
    guardianPhoneRaw: "(16) 98888-0002",
    bishopNameRaw: "JOÃO BISPO",
    bishopNameNormalized: "João Bispo",
    bishopEmail: "bispo@fsy.test",
    contact1NameRaw: "C1",
    contact1NameNormalized: "C1",
    contact1Email: "c1@fsy.test",
    contact1PhoneRaw: "(16) 97777-0003",
    contact2NameRaw: "C2",
    contact2NameNormalized: "C2",
    contact2Email: "c2@fsy.test",
    contact2PhoneRaw: "(16) 96666-0004",
    dietaryInfoRaw: "Sem lactose",
    healthConditionsSummaryRaw: "Asma",
    healthConditionsDetailsRaw: "Bombinha",
  };
  const minimalRec = repo.projectRegistrationListItem(fullRec, "minimal");
  for (const field of [
    "phoneRaw",
    "email",
    "guardianNameRaw",
    "guardianNameNormalized",
    "guardianPhoneRaw",
    "bishopNameRaw",
    "bishopNameNormalized",
    "bishopEmail",
    "documentRgOrPassportRaw",
    "issuingAgencyRaw",
    "cpfRaw",
    "cpfDigitsOnly",
    "contact1NameRaw",
    "contact1NameNormalized",
    "contact1Email",
    "contact1PhoneRaw",
    "contact2NameRaw",
    "contact2NameNormalized",
    "contact2Email",
    "contact2PhoneRaw",
    "medicalInfoRaw",
    "dietaryInfoRaw",
    "healthConditionsSummaryRaw",
    "healthConditionsDetailsRaw",
  ]) {
    assert.equal(minimalRec[field], null, `minimal projection must null ${field}`);
  }
  assert.equal(Object.keys(minimalRec.rawColumns).length, 0);

  const detailDenied = loadRoute("src/app/api/admin/registrations/[id]/route.ts", {
    identity: JOVEM,
    db: detailDb,
  });
  assert.equal(
    (
      await detailDenied.GET(request(`/api/admin/registrations/${recId}`), {
        params: { id: recId },
      })
    ).status,
    403
  );
});

test(
  "FCM Push DB (202610310002): REVOKE ALL bloqueia PostgREST direto, proíbe delete cross-account por deviceId e retorna 23505 em colisão de fcm_token",
  { timeout: 15_000 },
  async () => {
    // 1. anon e authenticated não conseguem ler nem chamar RPC diretamente (usa sub real no helper as/attempt)
    for (const roleSpec of [
      { role: "anon" },
      { role: "authenticated", sub: ID.jovem },
      { role: "authenticated", sub: ID.coord },
    ]) {
      const readRes = await attempt(db, roleSpec, `SELECT count(*) FROM public.push_device_tokens`);
      assert.equal(readRes.ok, false);
      const rpcRes = await attempt(
        db,
        roleSpec,
        `SELECT public.register_user_push_device($1, 'pixel-8-id', 'android', 'fcm_token_12345678901234567890')`,
        [ID.jovem]
      );
      assert.equal(rpcRes.ok, false);
    }

    // 2. Registro atômico para ID.jovem (P5: mesmo fcm_token preserva binding_generation = 1; rotação de fcm_token incrementa para 2)
    const r1 = (
      await db.query(
        `SELECT (public.register_user_push_device($1, 'pixel-8-shared', 'android', 'token_jovem_0000000000000001', '1.0.0')).binding_generation AS gen`,
        [ID.jovem]
      )
    ).rows[0];
    assert.equal(Number(r1.gen), 1);

    const r1Refresh = (
      await db.query(
        `SELECT (public.register_user_push_device($1, 'pixel-8-shared', 'android', 'token_jovem_0000000000000001', '1.0.1')).binding_generation AS gen`,
        [ID.jovem]
      )
    ).rows[0];
    assert.equal(Number(r1Refresh.gen), 1);

    const r2Rotated = (
      await db.query(
        `SELECT (public.register_user_push_device($1, 'pixel-8-shared', 'android', 'token_jovem_0000000000000002', '1.0.1')).binding_generation AS gen`,
        [ID.jovem]
      )
    ).rows[0];
    assert.equal(Number(r2Rotated.gen), 2);

    // 3. Outro usuário (ID.consultor) enviando o MESMO device_id livre ('pixel-8-shared') NÃO revoga nem apaga o registro de ID.jovem!
    await db.query(
      `SELECT public.register_user_push_device($1, 'pixel-8-shared', 'android', 'token_consultor_000000000002', '1.0.1')`,
      [ID.consultor]
    );
    const activeRows = (
      await db.query(
        `SELECT user_id, device_id, fcm_token FROM public.push_device_tokens WHERE device_id = 'pixel-8-shared' ORDER BY user_id`
      )
    ).rows;
    assert.equal(activeRows.length, 2);

    // 4. Colisão cross-account de fcm_token ('token_jovem_0000000000000002') falha com 23505 (TOKEN_BOUND_TO_OTHER_ACCOUNT)
    const tokenCollision = await attempt(
      db,
      { role: "service_role" },
      `SELECT public.register_user_push_device($1, 'outro-aparelho-99', 'android', 'token_jovem_0000000000000002')`,
      [ID.consultor]
    );
    assert.equal(tokenCollision.ok, false);
    assert.equal(tokenCollision.error.code, "23505");

    // 4b (P4): Revogação sem device_id e com p_revoke_all=false falha com 22023 (DEVICE_ID_OR_ALL_REQUIRED)
    const missingRevokeTarget = await attempt(
      db,
      { role: "service_role" },
      `SELECT public.revoke_user_push_devices($1, NULL, false)`,
      [ID.consultor]
    );
    assert.equal(missingRevokeTarget.ok, false);
    assert.equal(missingRevokeTarget.error.code, "22023");

    // 5. Revogação por ID.consultor com device_id = 'pixel-8-shared' remove APENAS o vínculo de ID.consultor
    const revokedConsultor = (
      await db.query(`SELECT public.revoke_user_push_devices($1, 'pixel-8-shared', false) AS n`, [
        ID.consultor,
      ])
    ).rows[0].n;
    assert.equal(revokedConsultor, 1);

    const remainingForJovem = (
      await db.query(
        `SELECT user_id, fcm_token, binding_generation FROM public.push_device_tokens WHERE user_id = $1`,
        [ID.jovem]
      )
    ).rows;
    assert.equal(remainingForJovem.length, 1);
    assert.equal(remainingForJovem[0].fcm_token, "token_jovem_0000000000000002");
  }
);

