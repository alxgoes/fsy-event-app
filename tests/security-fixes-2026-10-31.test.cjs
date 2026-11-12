const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadRoute, createFakeDb, request, mutations } = require("./helpers/route-harness.cjs");

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const jovemCia1 = {
  user: { id: "u-jovem-1", email: "j1@fsy.test" },
  role: "jovem",
  companyId: "cia-1",
  fullName: "Jovem Companhia 1",
};
const coord = {
  user: { id: "u-coord", email: "coord@fsy.test" },
  role: "coordenador",
  companyId: null,
  fullName: "Coordenador",
};
const medico = {
  user: { id: "u-medico", email: "med@fsy.test" },
  role: "medico",
  companyId: null,
  fullName: "Médico",
};

test("S-1: POST /api/announcements/like bloqueia curtir comunicado de outra companhia com 403", async () => {
  const dbOtherCompany = createFakeDb({
    announcements: {
      data: { id: UUID, target_company_id: "cia-2" },
      error: null,
    },
  });
  const route = loadRoute("src/app/api/announcements/like/route.ts", {
    identity: jovemCia1,
    db: dbOtherCompany,
  });

  const res = await route.POST(
    request("/api/announcements/like", {
      method: "POST",
      body: { announcement_id: UUID },
    })
  );
  assert.equal(res.status, 403);
  assert.equal(mutations(dbOtherCompany).length, 0);

  // Coordenador (globalAnnouncements) pode curtir comunicado de qualquer companhia
  const dbCoord = createFakeDb({
    announcements: { data: { id: UUID, target_company_id: "cia-2" }, error: null },
    announcement_likes: (c) =>
      c.ops.includes("select")
        ? { data: null, error: null, count: 1 }
        : { data: null, error: null },
  });
  const coordRoute = loadRoute("src/app/api/announcements/like/route.ts", {
    identity: coord,
    db: dbCoord,
  });
  const okRes = await coordRoute.POST(
    request("/api/announcements/like", {
      method: "POST",
      body: { announcement_id: UUID },
    })
  );
  assert.equal(okRes.status, 200);
});

test("S-2: /api/medical, /api/users e /api/admin/counselor-audit não vazam error.message interno em 500", async () => {
  const secretSqlDetail = "DETAIL: Key (cpf)=(00011122233) in table private_schema_secret";
  const failingDb = createFakeDb({
    medical_records: { data: null, error: { code: "XX000", message: secretSqlDetail } },
    profiles: { data: null, error: { code: "XX000", message: secretSqlDetail } },
    companies: { data: [], error: null },
    counselor_audit_logs: { data: null, error: { code: "XX000", message: secretSqlDetail } },
  });

  const medRoute = loadRoute("src/app/api/medical/route.ts", {
    identity: medico,
    db: failingDb,
  });
  const medRes = await medRoute.GET(request("/api/medical"));
  assert.equal(medRes.status, 500);
  assert.equal(JSON.stringify(medRes.body).includes(secretSqlDetail), false);

  const usersRoute = loadRoute("src/app/api/users/route.ts", {
    identity: coord,
    db: failingDb,
  });
  const usersRes = await usersRoute.GET(request("/api/users"));
  assert.equal(usersRes.status, 500);
  assert.equal(JSON.stringify(usersRes.body).includes(secretSqlDetail), false);

  const auditRoute = loadRoute("src/app/api/admin/counselor-audit/route.ts", {
    identity: coord,
    db: failingDb,
  });
  const auditRes = await auditRoute.GET(request("/api/admin/counselor-audit"));
  assert.equal(auditRes.status, 500);
  assert.equal(JSON.stringify(auditRes.body).includes(secretSqlDetail), false);
});

test("S-3: isSameOriginRequest rejeita Sec-Fetch-Site cross-site e Referer externo quando Origin está ausente", () => {
  const { isSameOriginRequest } = loadRoute("src/lib/security/origin.ts");
  const makeReq = (headers) => ({
    headers: {
      get: (k) => headers[k.toLowerCase()] ?? null,
    },
  });

  // 1. Cross-site Sec-Fetch-Site sem Origin -> rejeitado
  assert.equal(
    isSameOriginRequest(
      makeReq({ host: "fsy.test", "sec-fetch-site": "cross-site" })
    ),
    false
  );

  // 2. Referer de outro domínio sem Origin -> rejeitado
  assert.equal(
    isSameOriginRequest(
      makeReq({ host: "fsy.test", referer: "https://evil.test/phishing" })
    ),
    false
  );

  // 3. Same-origin Sec-Fetch-Site e Referer do mesmo host sem Origin -> aceito
  assert.equal(
    isSameOriginRequest(
      makeReq({
        host: "fsy.test",
        "sec-fetch-site": "same-origin",
        referer: "https://fsy.test/login",
      })
    ),
    true
  );

  // 4. Requisição nativa com Authorization: Bearer sem Origin -> aceito
  assert.equal(
    isSameOriginRequest(
      makeReq({
        host: "fsy.test",
        authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.token",
      })
    ),
    true
  );
});

test("Proxy e /api/app-release: /instalar e GET /api/app-release são públicos; rotas privadas continuam bloqueadas e manifesto M5 é honesto", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_test";

  const ssr = {
    createServerClient: () => ({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    }),
  };
  const nextServer = {
    NextResponse: {
      next: () => ({ kind: "next", status: 200, cookies: { set() {} } }),
      json: (body, options = {}) => ({ kind: "json", body, status: options.status ?? 200 }),
      redirect: (url) => ({ kind: "redirect", status: 307, url: String(url.pathname ?? url) }),
    },
  };
  const { proxy } = loadRoute("src/proxy.ts", {
    extraModules: { "@supabase/ssr": ssr, "next/server": nextServer },
  });
  const callProxy = (pathname, method = "GET") =>
    proxy({
      method,
      headers: { get: (k) => (k === "host" ? "fsy.test" : k === "origin" ? "https://fsy.test" : null) },
      cookies: { getAll: () => [], set() {} },
      nextUrl: { pathname, clone: () => ({ pathname, searchParams: new URLSearchParams() }) },
    });

  // Visitante anônimo acessa /instalar e GET /api/app-release
  assert.equal((await callProxy("/instalar", "GET")).kind, "next");
  assert.equal((await callProxy("/api/app-release", "GET")).kind, "next");

  // Visitante anônimo NÃO acessa POST /api/app-release nem GET /api/admin/registrations
  assert.equal((await callProxy("/api/app-release", "POST")).status, 401);
  assert.equal((await callProxy("/api/admin/registrations", "GET")).status, 401);

  // M5: classificação por hostname exato (não aceita URL falsa com query play.google.com)
  const prevUrl = process.env.NEXT_PUBLIC_ANDROID_APK_URL;
  try {
    process.env.NEXT_PUBLIC_ANDROID_APK_URL = "https://cdn.fsyrp2.test/app.apk?ref=play.google.com";
    const {
      getAppDistributionManifest,
      GITHUB_ANDROID_RELEASE_REPO,
    } = loadRoute("src/lib/app-distribution/android-release.ts");
    const manifest = getAppDistributionManifest();
    assert.equal(manifest.android.availability, "ready_direct_download");
    assert.equal(
      manifest.android.downloadUrl,
      "https://cdn.fsyrp2.test/app.apk?ref=play.google.com"
    );

    // Sem NEXT_PUBLIC_ANDROID_APK_URL: deriva URL do GitHub Releases se metadado tiver sha256 e sizeBytes
    delete process.env.NEXT_PUBLIC_ANDROID_APK_URL;
    const derivedManifest = getAppDistributionManifest({
      metadataOverride: {
        versionName: "1.3.0",
        versionCode: 6,
        apkFileName: "fsy-rp2-2027-v1.3.0-release.apk",
        sizeBytes: 10500000,
        sha256: "a".repeat(64),
        signingSchemes: ["v2", "v3"],
        minSupportedVersionCode: 5,
        releaseNotesPtBr: [
          "Atualização automática integrada.",
          "Melhorias nas inscrições e no grupo da companhia.",
        ],
      },
    });
    assert.equal(derivedManifest.android.availability, "ready_direct_download");
    assert.equal(
      derivedManifest.android.downloadUrl,
      `https://github.com/${GITHUB_ANDROID_RELEASE_REPO}/releases/download/android-v1.3.0/fsy-rp2-2027-v1.3.0-release.apk`
    );
    assert.equal(
      derivedManifest.android.androidMetadata.minSupportedVersionCode,
      5
    );
    assert.deepEqual(
      derivedManifest.android.androidMetadata.releaseNotesPtBr,
      [
        "Atualização automática integrada.",
        "Melhorias nas inscrições e no grupo da companhia.",
      ]
    );

    // Variável de ambiente tem precedência sobre URL derivada
    process.env.NEXT_PUBLIC_ANDROID_APK_URL = "https://custom.fsyrp2.test/custom.apk";
    const envPrecedenceManifest = getAppDistributionManifest({
      metadataOverride: {
        versionName: "1.3.0",
        versionCode: 6,
        apkFileName: "fsy-rp2-2027-v1.3.0-release.apk",
        sizeBytes: 10500000,
        sha256: "a".repeat(64),
      },
    });
    assert.equal(
      envPrecedenceManifest.android.downloadUrl,
      "https://custom.fsyrp2.test/custom.apk"
    );

    // Metadado incompleto (sem sha256 ou sizeBytes) e sem variável de ambiente -> sem link (null)
    delete process.env.NEXT_PUBLIC_ANDROID_APK_URL;
    const incompleteManifest = getAppDistributionManifest({
      metadataOverride: {
        versionName: "1.3.0",
        versionCode: 6,
        apkFileName: "fsy-rp2-2027-v1.3.0-release.apk",
        sizeBytes: null,
        sha256: null,
      },
    });
    assert.equal(incompleteManifest.android.downloadUrl, null);
    assert.equal(incompleteManifest.android.availability, "pwa_fallback");
  } finally {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_ANDROID_APK_URL;
    else process.env.NEXT_PUBLIC_ANDROID_APK_URL = prevUrl;
  }
});

test("FCM Push Backend: redige payload sem título arbitrário, valida geração/conta contra late-arrival após logout, retorna 409 em colisão de token e classifica erros FCM v1", async () => {
  const fcm = loadRoute("src/lib/notifications/fcm-dispatcher.ts");

  const payload = fcm.buildSafeAnnouncementPushPayload({
    announcementId: UUID,
    priority: "normal",
    category: "Geral",
    targetCompanyId: "cia-1",
    targetUserId: "u-cia-1",
    deviceId: "pixel-8-pro",
    bindingGeneration: 3,
  });
  assert.equal(payload.lockscreenTitle, "FSY RP2: novo aviso");
  assert.equal(payload.genericBody, "Abra o aplicativo e autentique-se para visualizar o comunicado.");
  assert.equal(payload.requiresAuthFetch, "true");
  assert.equal("title" in payload, false);
  assert.equal(payload.deepLink, `fsyrp2://portal/announcements/${UUID}`);
  assert.equal(payload.scope, "company");
  assert.equal(payload.targetUserId, "u-cia-1");
  assert.equal(payload.deviceId, "pixel-8-pro");
  assert.equal(payload.bindingGeneration, "3");

  // Validação cliente contra late-arrival após logout, troca de conta ou geração antiga
  assert.equal(
    fcm.shouldDisplayPushOnClient({
      payload,
      currentUserId: "u-cia-1",
      currentDeviceId: "pixel-8-pro",
      currentBindingGeneration: 3,
    }).display,
    true
  );
  assert.equal(
    fcm.shouldDisplayPushOnClient({
      payload,
      currentUserId: null,
      currentDeviceId: "pixel-8-pro",
    }).display,
    false
  );
  assert.equal(
    fcm.shouldDisplayPushOnClient({
      payload,
      currentUserId: "u-outra-conta",
      currentDeviceId: "pixel-8-pro",
      currentBindingGeneration: 3,
    }).reason,
    "ACCOUNT_MISMATCH_OR_LOGGED_OUT"
  );
  assert.equal(
    fcm.shouldDisplayPushOnClient({
      payload,
      currentUserId: "u-cia-1",
      currentDeviceId: "pixel-8-pro",
      currentBindingGeneration: 4,
    }).reason,
    "STALE_BINDING_GENERATION"
  );
  assert.equal(
    fcm.shouldDisplayPushOnClient({
      payload,
      currentUserId: "u-cia-1",
      currentDeviceId: "pixel-8-pro",
      currentBindingGeneration: 3,
      isDeviceRevoked: true,
    }).reason,
    "DEVICE_REVOKED_ON_LOGOUT"
  );

  // Classificação de erros FCM HTTP v1 conforme documentação oficial
  assert.equal(
    fcm.classifyFcmV1Error(404, {
      error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] },
    }).action,
    "revoke_token"
  );
  const quotaErr = fcm.classifyFcmV1Error(
    429,
    { error: { status: "RESOURCE_EXHAUSTED", details: [{ errorCode: "QUOTA_EXCEEDED" }] } },
    "120"
  );
  assert.equal(quotaErr.action, "retry_backoff");
  assert.equal(quotaErr.fcmErrorCode, "QUOTA_EXCEEDED");
  assert.equal(quotaErr.retryAfterMs, 120_000);
  assert.equal(
    fcm.classifyFcmV1Error(503, { error: { status: "UNAVAILABLE" } }).action,
    "retry_backoff"
  );
  assert.equal(
    fcm.classifyFcmV1Error(500, { error: { status: "INTERNAL" } }).action,
    "retry_backoff"
  );

  // POST /api/notifications/devices retorna 409 TOKEN_BOUND_TO_OTHER_ACCOUNT em colisão 23505
  const collisionDb = createFakeDb({
    "rpc:register_user_push_device": () => ({
      data: null,
      error: { code: "23505", message: "TOKEN_BOUND_TO_OTHER_ACCOUNT" },
    }),
  });
  const devicesRoute = loadRoute("src/app/api/notifications/devices/route.ts", {
    identity: jovemCia1,
    db: collisionDb,
  });
  const collisionRes = await devicesRoute.POST(
    request("/api/notifications/devices", {
      method: "POST",
      body: {
        deviceId: "pixel-8-pro",
        platform: "android",
        fcmToken: "token_colisao_12345678901234567890",
      },
    })
  );
  assert.equal(collisionRes.status, 409);
  assert.equal(collisionRes.body.code, "TOKEN_BOUND_TO_OTHER_ACCOUNT");
  assert.equal(collisionRes.body.requiresTokenRotation, true);

  // P4: DELETE /api/notifications/devices sem deviceId e sem all=true retorna 400 DEVICE_ID_OR_ALL_REQUIRED
  const delNoTargetRes = await devicesRoute.DELETE(
    request("/api/notifications/devices", { method: "DELETE" })
  );
  assert.equal(delNoTargetRes.status, 400);
  assert.equal(delNoTargetRes.body.code, "DEVICE_ID_OR_ALL_REQUIRED");

  // Suporte a FIREBASE_SERVICE_ACCOUNT_JSON (JSON único secreto bruto ou base64)
  const prevSaJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  try {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: "fsy-ribeirao-preto-2-2027",
      client_email: "fcm-test@fsy-ribeirao-preto-2-2027.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\nTEST\\n-----END PRIVATE KEY-----\\n",
    });
    const resolvedRaw = fcm.resolveFirebaseServiceAccountFromEnv();
    assert.equal(resolvedRaw.projectId, "fsy-ribeirao-preto-2-2027");
    assert.equal(resolvedRaw.privateKey.includes("\nTEST\n"), true);

    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      "utf8"
    ).toString("base64");
    const resolvedB64 = fcm.resolveFirebaseServiceAccountFromEnv();
    assert.equal(resolvedB64.projectId, "fsy-ribeirao-preto-2-2027");
  } finally {
    if (prevSaJson === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    else process.env.FIREBASE_SERVICE_ACCOUNT_JSON = prevSaJson;
  }

  // Horário silencioso 22:00..06:00 em America/Sao_Paulo (02:00 UTC = 23:00 BRT)
  const nightUtc = new Date("2027-02-07T02:00:00Z");
  assert.equal(fcm.isWithinQuietHoursSaoPaulo("22:00", "06:00", nightUtc), true);
  // 15:00 UTC = 12:00 BRT
  const noonUtc = new Date("2027-02-07T15:00:00Z");
  assert.equal(fcm.isWithinQuietHoursSaoPaulo("22:00", "06:00", noonUtc), false);

  // Disparo para companhia cia-1 ignora cia-2, suspensos e dispositivos em horário silencioso (exceto urgente)
  const fakePushDb = createFakeDb({
    push_device_tokens: {
      data: [
        {
          id: "t-1",
          user_id: "u-cia-1",
          device_id: "dev-cia-1",
          binding_generation: 1,
          fcm_token: "token_cia1_valido_1234567890",
          announcements_enabled: true,
          urgent_only: false,
          quiet_hours_start: null,
          quiet_hours_end: null,
          profiles: { role: "jovem", company_id: "cia-1", suspended_at: null },
        },
        {
          id: "t-2",
          user_id: "u-cia-2",
          device_id: "dev-cia-2",
          binding_generation: 1,
          fcm_token: "token_cia2_valido_1234567890",
          announcements_enabled: true,
          urgent_only: false,
          quiet_hours_start: null,
          quiet_hours_end: null,
          profiles: { role: "jovem", company_id: "cia-2", suspended_at: null },
        },
        {
          id: "t-2-cons",
          user_id: "u-cons-cia-2",
          device_id: "dev-cons-cia-2",
          binding_generation: 1,
          fcm_token: "token_cons_cia2_valido_12345",
          announcements_enabled: true,
          urgent_only: false,
          quiet_hours_start: null,
          quiet_hours_end: null,
          profiles: { role: "consultor", company_id: "cia-2", suspended_at: null },
        },
        {
          id: "t-susp",
          user_id: "u-coord-susp",
          device_id: "dev-coord-susp",
          binding_generation: 1,
          fcm_token: "token_coord_susp_1234567890",
          announcements_enabled: true,
          urgent_only: false,
          quiet_hours_start: null,
          quiet_hours_end: null,
          profiles: { role: "coordenador", company_id: null, suspended_at: "2027-01-01T00:00:00Z" },
        },
        {
          id: "t-3",
          user_id: "u-coord",
          device_id: "dev-coord",
          binding_generation: 1,
          fcm_token: "token_coord_valido_1234567890",
          announcements_enabled: true,
          urgent_only: true,
          quiet_hours_start: null,
          quiet_hours_end: null,
          profiles: { role: "coordenador", company_id: null, suspended_at: null },
        },
      ],
      error: null,
    },
  });

  const fcmWithDb = loadRoute("src/lib/notifications/fcm-dispatcher.ts", { db: fakePushDb });
  const dispatchNormal = await fcmWithDb.dispatchAnnouncementPush({
    announcementId: UUID,
    priority: "normal",
    category: "Geral",
    targetCompanyId: "cia-1",
    now: noonUtc,
  });
  // Apenas t-1 é elegível (t-2 é de outra companhia; t-3 tem urgent_only=true)
  assert.equal(dispatchNormal.eligibleDevices, 1);
  assert.equal(dispatchNormal.skippedQuietHoursOrPrefs, 1);

  // POST /api/announcements não duplica avisos em retry e não falha se FCM falhar
  let insertCount = 0;
  const savedAnnouncement = {
    id: UUID,
    title: "Aviso Geral FSY",
    content: "Concentração no auditório às 19h.",
    priority: "normal",
    category: "Geral",
    target_company_id: null,
    author_id: coord.user.id,
  };
  const annDb = createFakeDb({
    announcements: (call) => {
      if (call.ops.includes("insert")) {
        insertCount += 1;
        return { data: savedAnnouncement, error: null };
      }
      // Na segunda chamada sem Idempotency-Key, simula que o registro recém-inserido existe na janela de 60s
      return { data: insertCount > 0 ? [savedAnnouncement] : [], error: null };
    },
    counselor_audit_logs: { data: null, error: null },
    push_device_tokens: {
      data: null,
      error: { code: "XX000", message: "Simulated FCM DB failure" },
    },
  });
  const annRoute = loadRoute("src/app/api/announcements/route.ts", {
    identity: coord,
    db: annDb,
  });

  const firstPost = await annRoute.POST(
    request("/api/announcements", {
      method: "POST",
      headers: { "idempotency-key": "ann-idem-001" },
      body: {
        title: "Aviso Geral FSY",
        content: "Concentração no auditório às 19h.",
        priority: "normal",
        category: "Geral",
      },
    })
  );
  assert.equal(firstPost.status, 200);
  assert.equal(firstPost.body.success, true);
  assert.equal(insertCount, 1);

  // Retry com mesma Idempotency-Key -> deduplicado, sem novo INSERT
  const retrySameKey = await annRoute.POST(
    request("/api/announcements", {
      method: "POST",
      headers: { "idempotency-key": "ann-idem-001" },
      body: {
        title: "Aviso Geral FSY",
        content: "Concentração no auditório às 19h.",
        priority: "normal",
        category: "Geral",
      },
    })
  );
  assert.equal(retrySameKey.status, 200);
  assert.equal(retrySameKey.body.deduplicated, true);
  assert.equal(insertCount, 1);

  // Reuso da mesma Idempotency-Key com payload diferente -> 409 IDEMPOTENCY_KEY_REUSED
  const conflictKey = await annRoute.POST(
    request("/api/announcements", {
      method: "POST",
      headers: { "idempotency-key": "ann-idem-001" },
      body: {
        title: "Outro Aviso Diferente",
        content: "Conteúdo alterado.",
        priority: "urgent",
        category: "Emergencia",
      },
    })
  );
  assert.equal(conflictKey.status, 409);
  assert.equal(conflictKey.body.code, "IDEMPOTENCY_KEY_REUSED");

  // Retry sem Idempotency-Key dentro da janela de 60s -> deduplicado pela consulta recente
  const retryWindow = await annRoute.POST(
    request("/api/announcements", {
      method: "POST",
      body: {
        title: "Aviso Geral FSY",
        content: "Concentração no auditório às 19h.",
        priority: "normal",
        category: "Geral",
      },
    })
  );
  assert.equal(retryWindow.status, 200);
  assert.equal(retryWindow.body.deduplicated, true);
  assert.equal(insertCount, 1);
});
