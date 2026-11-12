// Auditoria e testes por rota do escopo de consultor vs. gestão (Tarefa 2).
const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const { createDatabase, as, createUser } = require('./helpers/pg-harness.cjs');
const { createFakeDb, loadRoute, request } = require('./helpers/route-harness.cjs');

const plain = (v) => JSON.parse(JSON.stringify(v));

const ID = {
  jovem1: '10000000-0000-4000-8000-000000000001',
  jovem2: '10000000-0000-4000-8000-000000000002',
  cons1: '10000000-0000-4000-8000-000000000003',
  consNone: '10000000-0000-4000-8000-000000000099',
};

let pgDb;
before(async () => {
  pgDb = await createDatabase();
  await pgDb.exec(`INSERT INTO public.companies (id, name) VALUES ('cia-1','Companhia 1'), ('cia-2','Companhia 2') ON CONFLICT (id) DO NOTHING`);
  await createUser(pgDb, { id: ID.jovem1, email: 'jovem1@fsy.test', role: 'jovem', company: 'cia-1', name: 'Jovem 1' });
  await createUser(pgDb, { id: ID.jovem2, email: 'jovem2@fsy.test', role: 'jovem', company: 'cia-2', name: 'Jovem 2' });
  await createUser(pgDb, { id: ID.cons1, email: 'cons1@fsy.test', role: 'consultor', company: 'cia-1', name: 'Consultor 1' });
  await createUser(pgDb, { id: ID.consNone, email: 'cons.semcia@fsy.test', role: 'consultor', company: null, name: 'Consultor Sem Cia' });
});

const COUNSELOR_CIA1 = {
  user: { id: 'u-cons-1' },
  role: 'consultor',
  profile: { id: 'u-cons-1', full_name: 'Consultor Cia 1', role: 'consultor', company_id: 'cia-1', suspended_at: null },
};

const COUNSELOR_UNASSIGNED = {
  user: { id: 'u-cons-none' },
  role: 'consultor',
  profile: { id: 'u-cons-none', full_name: 'Consultor Sem Cia', role: 'consultor', company_id: null, suspended_at: null },
};

const COORDINATOR = {
  user: { id: 'u-coord' },
  role: 'coordenador',
  profile: { id: 'u-coord', full_name: 'Coordenação', role: 'coordenador', company_id: null, suspended_at: null },
};

test('/api/announcements: counselor is strictly scoped to own company on GET, POST, and DELETE', async () => {
  const announcements = [
    { id: 'a-geral', title: 'Geral', content: 'Aviso geral', priority: 'normal', category: 'Geral', target_company_id: null, created_at: '2026-11-11T10:00:00Z', author_id: 'u-coord' },
    { id: 'a-cia1', title: 'Cia 1', content: 'Aviso cia 1', priority: 'normal', category: 'Companhia', target_company_id: 'cia-1', created_at: '2026-11-11T10:05:00Z', author_id: 'u-cons-1' },
    { id: 'a-cia2', title: 'Cia 2', content: 'Segredo cia 2', priority: 'urgent', category: 'Companhia', target_company_id: 'cia-2', created_at: '2026-11-11T10:10:00Z', author_id: 'u-cons-2' },
  ];

  const db = createFakeDb({
    announcements: (call) => {
      if (call.ops.includes('insert')) {
        return { data: { id: 'a-new', ...call.payload }, error: null };
      }
      if (call.ops.includes('delete')) {
        return { data: null, error: null };
      }
      const idFilter = call.filters.find(([op, col]) => op === 'eq' && col === 'id');
      if (idFilter) {
        const found = announcements.find((a) => a.id === idFilter[2]) || null;
        return { data: found, error: found ? null : { code: 'PGRST116' } };
      }
      if (call.filters.some(([op]) => op === 'gte')) {
        return { data: [], error: null };
      }
      return { data: announcements, error: null };
    },
    announcement_likes: { data: [], error: null },
    companies: { data: { id: 'cia-1', name: 'Companhia 1' }, error: null },
    counselor_audit_logs: { data: {}, error: null },
  });

  // 1. Counselor of cia-1 requesting ?company_id=cia-2 still never sees a-cia2
  const c1Route = loadRoute('src/app/api/announcements/route.ts', {
    identity: COUNSELOR_CIA1,
    db,
    extraModules: {
      '@/lib/notifications/fcm-dispatcher': { dispatchAnnouncementPush: async () => {} },
    },
  });
  const getC1 = await c1Route.GET(request('/api/announcements?company_id=cia-2'));
  assert.equal(getC1.status, 200);
  assert.deepEqual(
    plain(getC1.body).data.map((a) => a.id),
    ['a-geral', 'a-cia1']
  );

  // POST to own company succeeds; POST to cia-2 or null fails with 403
  const postOwn = await c1Route.POST(
    request('/api/announcements', {
      method: 'POST',
      body: { title: 'Recado Cia 1', content: 'Conteúdo válido', priority: 'normal', category: 'Companhia', target_company_id: 'cia-1' },
    })
  );
  assert.equal(postOwn.status, 200);

  for (const forbiddenTarget of ['cia-2', null]) {
    const postOther = await c1Route.POST(
      request('/api/announcements', {
        method: 'POST',
        body: { title: 'Recado', content: 'Conteúdo válido', priority: 'normal', category: 'Companhia', target_company_id: forbiddenTarget },
      })
    );
    assert.equal(postOther.status, 403);
  }

  // DELETE on cia-2 or general announcement fails with 403
  assert.equal((await c1Route.DELETE(request('/api/announcements?id=a-cia2', { method: 'DELETE' }))).status, 403);
  assert.equal((await c1Route.DELETE(request('/api/announcements?id=a-geral', { method: 'DELETE' }))).status, 403);
  assert.equal((await c1Route.DELETE(request('/api/announcements?id=a-cia1', { method: 'DELETE' }))).status, 200);

  // 2. Unassigned counselor only sees general announcements and cannot POST or DELETE anything
  const unassignedRoute = loadRoute('src/app/api/announcements/route.ts', {
    identity: COUNSELOR_UNASSIGNED,
    db,
  });
  const getUnassigned = await unassignedRoute.GET(request('/api/announcements?company_id=cia-1'));
  assert.deepEqual(
    plain(getUnassigned.body).data.map((a) => a.id),
    ['a-geral']
  );
  assert.equal(
    (
      await unassignedRoute.POST(
        request('/api/announcements', {
          method: 'POST',
          body: { title: 'Recado', content: 'Conteúdo', priority: 'normal', category: 'Companhia', target_company_id: 'cia-1' },
        })
      )
    ).status,
    403
  );
  assert.equal((await unassignedRoute.DELETE(request('/api/announcements?id=a-cia1', { method: 'DELETE' }))).status, 403);
});

test('/api/companies PUT (motto): counselor can only update own company motto; unassigned counselor cannot update any', async () => {
  const db = createFakeDb({
    companies: { data: { id: 'cia-1', name: 'Companhia 1', motto: 'Antigo' }, error: null },
    counselor_audit_logs: { data: {}, error: null },
  });

  const c1Route = loadRoute('src/app/api/companies/route.ts', { identity: COUNSELOR_CIA1, db });
  assert.equal(
    (await c1Route.PUT(request('/api/companies', { method: 'PUT', body: { id: 'cia-1', motto: 'Novo lema' } }))).status,
    200
  );
  assert.equal(
    (await c1Route.PUT(request('/api/companies', { method: 'PUT', body: { id: 'cia-2', motto: 'Invasão' } }))).status,
    403
  );

  const unassignedRoute = loadRoute('src/app/api/companies/route.ts', { identity: COUNSELOR_UNASSIGNED, db });
  assert.equal(
    (await unassignedRoute.PUT(request('/api/companies', { method: 'PUT', body: { id: 'cia-1', motto: 'Invasão' } }))).status,
    403
  );
  assert.equal(
    (await unassignedRoute.PUT(request('/api/companies', { method: 'PUT', body: { id: null, motto: 'Invasão' } }))).status,
    403
  );
});

test('/api/profile/photo/reviews and /api/profile/photo/company: counselor is isolated to own company', async () => {
  const Y1 = '00000000-0000-4000-8000-000000000011';
  const Y2 = '00000000-0000-4000-8000-000000000022';

  const profiles = [
    {
      id: Y1,
      full_name: 'Jovem Cia 1',
      role: 'jovem',
      company_id: 'cia-1',
      avatar_url: `profile-photos/approved/${Y1}/y1.jpg`,
      avatar_status: 'pending',
      avatar_pending_path: `pending/${Y1}/p1.jpg`,
      avatar_submitted_at: '2026-11-11T10:00:00Z',
    },
    {
      id: Y2,
      full_name: 'Jovem Cia 2',
      role: 'jovem',
      company_id: 'cia-2',
      avatar_url: `profile-photos/approved/${Y2}/y2.jpg`,
      avatar_status: 'pending',
      avatar_pending_path: `pending/${Y2}/p2.jpg`,
      avatar_submitted_at: '2026-11-11T10:05:00Z',
    },
  ];

  const db = createFakeDb({
    profiles: (call) => {
      const idEq = call.filters.find(([op, col]) => op === 'eq' && col === 'id');
      if (idEq) {
        const match = profiles.find((p) => p.id === idEq[2]) || null;
        return { data: call.single ? match : match ? [match] : [], error: null };
      }
      return { data: profiles, error: null };
    },
    companies: {
      data: [
        { id: 'cia-1', name: 'Companhia 1' },
        { id: 'cia-2', name: 'Companhia 2' },
      ],
      error: null,
    },
  });
  db.storage = {
    from: () => ({
      createSignedUrl: async (p) => ({ data: { signedUrl: `https://signed.test/${p}` }, error: null }),
    }),
  };

  // Reviews GET & POST for counselor of cia-1
  const reviewsC1 = loadRoute('src/app/api/profile/photo/reviews/route.ts', { identity: COUNSELOR_CIA1, db });
  const listC1 = plain((await reviewsC1.GET()).body).data;
  assert.deepEqual(
    listC1.map((r) => r.user_id),
    [Y1]
  );
  const crossDecision = await reviewsC1.POST(
    request('/api/profile/photo/reviews', {
      method: 'POST',
      body: { user_id: Y2, decision: 'approve' },
    })
  );
  assert.equal(crossDecision.status, 404);

  // Reviews GET & POST for unassigned counselor
  const reviewsUnassigned = loadRoute('src/app/api/profile/photo/reviews/route.ts', {
    identity: COUNSELOR_UNASSIGNED,
    db,
  });
  assert.deepEqual(plain((await reviewsUnassigned.GET()).body).data, []);
  const unassignedDecision = await reviewsUnassigned.POST(
    request('/api/profile/photo/reviews', {
      method: 'POST',
      body: { user_id: Y1, decision: 'approve' },
    })
  );
  assert.equal(unassignedDecision.status, 403);

  // Company photos GET: counselor of cia-1 requesting ?company_id=cia-2 only gets cia-1
  const companyPhotoC1 = loadRoute('src/app/api/profile/photo/company/route.ts', {
    identity: COUNSELOR_CIA1,
    db,
  });
  const mapC1 = plain((await companyPhotoC1.GET(request('/api/profile/photo/company?company_id=cia-2'))).body).data;
  assert.deepEqual(Object.keys(mapC1), [Y1]);

  // Company photos GET: unassigned counselor gets {}
  const companyPhotoUnassigned = loadRoute('src/app/api/profile/photo/company/route.ts', {
    identity: COUNSELOR_UNASSIGNED,
    db,
  });
  assert.deepEqual(
    plain((await companyPhotoUnassigned.GET(request('/api/profile/photo/company?company_id=cia-1'))).body).data,
    {}
  );

  // Management can request ?company_id=cia-2
  const companyPhotoCoord = loadRoute('src/app/api/profile/photo/company/route.ts', {
    identity: COORDINATOR,
    db,
  });
  const mapCoord = plain((await companyPhotoCoord.GET(request('/api/profile/photo/company?company_id=cia-2'))).body).data;
  assert.deepEqual(Object.keys(mapCoord), [Y2]);
});

test('/api/admin/counselor-audit POST: unassigned counselor is rejected with 403; assigned counselor overrides company_id with own company', async () => {
  const db = createFakeDb({
    counselor_audit_logs: (call) => ({ data: { id: 'log-1', ...call.payload }, error: null }),
  });

  const unassignedRoute = loadRoute('src/app/api/admin/counselor-audit/route.ts', {
    identity: COUNSELOR_UNASSIGNED,
    db,
  });
  const unassignedRes = await unassignedRoute.POST(
    request('/api/admin/counselor-audit', {
      method: 'POST',
      body: { content: 'Tentativa sem companhia' },
    })
  );
  assert.equal(unassignedRes.status, 403);

  const c1Route = loadRoute('src/app/api/admin/counselor-audit/route.ts', {
    identity: COUNSELOR_CIA1,
    db,
  });
  const ownRes = await c1Route.POST(
    request('/api/admin/counselor-audit', {
      method: 'POST',
      body: { company_id: 'cia-2', content: 'Ação na própria companhia' },
    })
  );
  assert.equal(ownRes.status, 200);
  assert.equal(plain(ownRes.body).data.company_id, 'cia-1');
});

test('RLS on public.profiles: counselor only reads own company youth; unassigned counselor reads only self', async () => {
  // Counselor of cia-1 sees self + jovem1, never jovem2
  const c1Profiles = await as(pgDb, { sub: ID.cons1 }, (tx) =>
    tx.query('SELECT id, company_id FROM public.profiles ORDER BY id')
  );
  const c1Ids = c1Profiles.rows.map((r) => r.id);
  assert.equal(c1Ids.includes(ID.jovem1), true);
  assert.equal(c1Ids.includes(ID.jovem2), false);

  // Unassigned counselor sees only self
  const unassignedProfiles = await as(pgDb, { sub: ID.consNone }, (tx) =>
    tx.query('SELECT id FROM public.profiles')
  );
  assert.deepEqual(
    unassignedProfiles.rows.map((r) => r.id),
    [ID.consNone]
  );
});
