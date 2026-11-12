// Testes do Link do Grupo de WhatsApp da Companhia: migração/RLS, normalização e rota /api/companies/whatsapp.
const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const { createDatabase, as, attempt, createUser } = require('./helpers/pg-harness.cjs');
const { createFakeDb, loadRoute, request } = require('./helpers/route-harness.cjs');

const plain = (v) => JSON.parse(JSON.stringify(v));
const whatsappTypes = loadRoute('src/types/company-whatsapp.ts');

const VALID_CODE_1 = 'AbCdEfGhIjKlMnOpQrStUv';
const VALID_CODE_2 = '1234567890abcdefABCDEF';
const CANONICAL_1 = `https://chat.whatsapp.com/${VALID_CODE_1}`;
const CANONICAL_2 = `https://chat.whatsapp.com/${VALID_CODE_2}`;

const ID = {
  jovem1: '10000000-0000-4000-8000-000000000001',
  cons1: '10000000-0000-4000-8000-000000000003',
  coord: '10000000-0000-4000-8000-000000000004',
};

let pgDb;
before(async () => {
  pgDb = await createDatabase();
  await pgDb.exec(`INSERT INTO public.companies (id, name) VALUES ('cia-1','Companhia 1'), ('cia-2','Companhia 2') ON CONFLICT (id) DO NOTHING`);
  await createUser(pgDb, { id: ID.jovem1, email: 'jovem1@fsy.test', role: 'jovem', company: 'cia-1', name: 'Jovem 1' });
  await createUser(pgDb, { id: ID.cons1, email: 'cons1@fsy.test', role: 'consultor', company: 'cia-1', name: 'Consultor 1' });
  await createUser(pgDb, { id: ID.coord, email: 'coord@fsy.test', role: 'coordenador', company: null, name: 'Coordenação' });
});

test('normalizeWhatsappInvite accepts canonical/invite/query links and rejects non-WhatsApp or malformed URLs', () => {
  const { normalizeWhatsappInvite } = whatsappTypes;

  assert.equal(normalizeWhatsappInvite(CANONICAL_1), CANONICAL_1);
  assert.equal(normalizeWhatsappInvite(`  ${CANONICAL_1}/  `), CANONICAL_1);
  assert.equal(
    normalizeWhatsappInvite(`https://chat.whatsapp.com/invite/${VALID_CODE_1}?mode=gi_t#frag`),
    CANONICAL_1
  );
  assert.equal(
    normalizeWhatsappInvite(`https://CHAT.WHATSAPP.COM/${VALID_CODE_2}?utm_source=fsy`),
    CANONICAL_2
  );

  const invalidSamples = [
    '',
    '   ',
    `http://chat.whatsapp.com/${VALID_CODE_1}`,
    `https://wa.me/${VALID_CODE_1}`,
    `https://whatsapp.com/channel/${VALID_CODE_1}`,
    `https://chat.whatsapp.com.evil.test/${VALID_CODE_1}`,
    `https://bit.ly/${VALID_CODE_1}`,
    'https://chat.whatsapp.com/curto12345',
    'https://chat.whatsapp.com/ codigoComEspaco12345678',
    'https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
    `https://chat.whatsapp.com/grupo/${VALID_CODE_1}`,
    `https://user:pass@chat.whatsapp.com/${VALID_CODE_1}`,
    `https://chat.whatsapp.com:8443/${VALID_CODE_1}`,
    `https://chat.whatsapp.com/${VALID_CODE_1} texto`,
  ];

  for (const sample of invalidSamples) {
    assert.equal(
      normalizeWhatsappInvite(sample),
      null,
      `Expected normalizeWhatsappInvite(${JSON.stringify(sample)}) to return null`
    );
  }
});

test('migration 202611110001_company_whatsapp_links: anon and authenticated cannot read or write; service_role can', async () => {
  await pgDb.query(
    `INSERT INTO public.company_whatsapp_links (company_id, invite_url, updated_by)
     VALUES ('cia-1', $1, $2)
     ON CONFLICT (company_id) DO UPDATE SET invite_url = EXCLUDED.invite_url`,
    [CANONICAL_1, ID.cons1]
  );

  // anon cannot read or write
  const anonSelect = await attempt(pgDb, { role: 'anon' }, 'SELECT * FROM public.company_whatsapp_links');
  assert.equal(anonSelect.ok, false);
  assert.match(String(anonSelect.error.message), /permission denied/i);

  const anonInsert = await attempt(
    pgDb,
    { role: 'anon' },
    `INSERT INTO public.company_whatsapp_links (company_id, invite_url) VALUES ('cia-2', $1)`,
    [CANONICAL_2]
  );
  assert.equal(anonInsert.ok, false);
  assert.match(String(anonInsert.error.message), /permission denied/i);

  // authenticated (youth, counselor, coordinator) cannot read or write directly via PostgREST/table
  for (const userId of [ID.jovem1, ID.cons1, ID.coord]) {
    const userSelect = await attempt(pgDb, { role: 'authenticated', sub: userId }, 'SELECT * FROM public.company_whatsapp_links');
    assert.equal(userSelect.ok, false);
    assert.match(String(userSelect.error.message), /permission denied/i);

    const userUpdate = await attempt(
      pgDb,
      { role: 'authenticated', sub: userId },
      `UPDATE public.company_whatsapp_links SET invite_url = $1 WHERE company_id = 'cia-1'`,
      [CANONICAL_2]
    );
    assert.equal(userUpdate.ok, false);
    assert.match(String(userUpdate.error.message), /permission denied/i);

    const userDelete = await attempt(
      pgDb,
      { role: 'authenticated', sub: userId },
      `DELETE FROM public.company_whatsapp_links WHERE company_id = 'cia-1'`
    );
    assert.equal(userDelete.ok, false);
    assert.match(String(userDelete.error.message), /permission denied/i);
  }

  // service_role can read and CHECK constraint enforces canonical format
  const serviceRows = await as(pgDb, { role: 'service_role' }, (tx) =>
    tx.query(`SELECT company_id, invite_url FROM public.company_whatsapp_links WHERE company_id = 'cia-1'`)
  );
  assert.equal(serviceRows.rows.length, 1);
  assert.equal(serviceRows.rows[0].invite_url, CANONICAL_1);

  const invalidCheck = await attempt(
    pgDb,
    { role: 'service_role' },
    `INSERT INTO public.company_whatsapp_links (company_id, invite_url) VALUES ('cia-2', 'https://wa.me/1234567890123456')`
  );
  assert.equal(invalidCheck.ok, false);
  assert.match(String(invalidCheck.error.message), /check|violates/i);
});

function buildStatefulWhatsappDb() {
  const companies = [
    { id: 'cia-2', name: 'Companhia 2 — Helamã', counselors: [] },
    { id: 'cia-1', name: 'Companhia 1 — Néfi', counselors: [] },
    { id: 'cia-3', name: 'Companhia 3 — Morôni', counselors: ['Conselheiro Suspenso'] },
  ];
  const links = new Map([
    [
      'cia-1',
      {
        company_id: 'cia-1',
        invite_url: CANONICAL_1,
        updated_by: 'u-cons-1',
        updated_at: '2026-11-11T12:00:00.000Z',
      },
    ],
    [
      'cia-2',
      {
        company_id: 'cia-2',
        invite_url: CANONICAL_2,
        updated_by: 'u-coord',
        updated_at: '2026-11-11T13:00:00.000Z',
      },
    ],
  ]);
  const profiles = [
    { id: 'u-cons-1', full_name: 'Conselheiro C1', role: 'consultor', company_id: 'cia-1', suspended_at: null },
    { id: 'u-cons-3', full_name: 'Conselheiro Suspenso', role: 'consultor', company_id: 'cia-3', suspended_at: '2026-11-10T00:00:00Z' },
    { id: 'u-coord', full_name: 'Coordenação Geral', role: 'coordenador', company_id: null, suspended_at: null },
  ];
  const auditLogs = [];

  const db = createFakeDb({
    companies: () => ({ data: companies, error: null }),
    profiles: () => ({ data: profiles, error: null }),
    company_whatsapp_links: (call) => {
      if (call.ops.includes('upsert')) {
        const row = call.payload;
        links.set(row.company_id, {
          company_id: row.company_id,
          invite_url: row.invite_url,
          updated_by: row.updated_by,
          updated_at: row.updated_at,
        });
        return { data: [row], error: null };
      }
      if (call.ops.includes('delete')) {
        const eqFilter = call.filters.find(([op, col]) => op === 'eq' && col === 'company_id');
        if (eqFilter) links.delete(eqFilter[2]);
        return { data: [], error: null };
      }
      return { data: Array.from(links.values()), error: null };
    },
    counselor_audit_logs: (call) => {
      if (call.ops.includes('insert')) {
        auditLogs.push(call.payload);
      }
      return { data: call.payload, error: null };
    },
  });

  return { db, links, auditLogs };
}

test('GET /api/companies/whatsapp enforces role and company isolation', async () => {
  const { db } = buildStatefulWhatsappDb();

  // Unauthenticated -> 401
  const unauthRoute = loadRoute('src/app/api/companies/whatsapp/route.ts', { db });
  assert.equal((await unauthRoute.GET()).status, 401);

  // Youth with company cia-1 -> gets ONLY cia-1, can_edit: false, updated_by_name: null, never sees cia-2
  const youthRoute = loadRoute('src/app/api/companies/whatsapp/route.ts', {
    identity: {
      user: { id: 'u-jovem-1' },
      role: 'jovem',
      profile: { id: 'u-jovem-1', full_name: 'Jovem 1', role: 'jovem', company_id: 'cia-1', suspended_at: null },
    },
    db,
  });
  const youthRes = await youthRoute.GET();
  assert.equal(youthRes.status, 200);
  const youthData = plain(youthRes.body).data;
  assert.equal(youthData.length, 1);
  assert.equal(youthData[0].company_id, 'cia-1');
  assert.equal(youthData[0].invite_url, CANONICAL_1);
  assert.equal(youthData[0].can_edit, false);
  assert.equal(youthData[0].updated_by_name, null);
  assert.equal(JSON.stringify(youthData).includes(VALID_CODE_2), false);

  // Youth without company -> []
  const unassignedYouthRoute = loadRoute('src/app/api/companies/whatsapp/route.ts', {
    identity: {
      user: { id: 'u-jovem-sem' },
      role: 'jovem',
      profile: { id: 'u-jovem-sem', full_name: 'Jovem Sem Cia', role: 'jovem', company_id: null, suspended_at: null },
    },
    db,
  });
  assert.deepEqual(plain((await unassignedYouthRoute.GET()).body).data, []);

  // Counselor of cia-1 -> gets ONLY cia-1, can_edit: true, never sees cia-2
  const counselorRoute = loadRoute('src/app/api/companies/whatsapp/route.ts', {
    identity: {
      user: { id: 'u-cons-1' },
      role: 'consultor',
      profile: { id: 'u-cons-1', full_name: 'Conselheiro C1', role: 'consultor', company_id: 'cia-1', suspended_at: null },
    },
    db,
  });
  const counselorData = plain((await counselorRoute.GET()).body).data;
  assert.equal(counselorData.length, 1);
  assert.equal(counselorData[0].company_id, 'cia-1');
  assert.equal(counselorData[0].invite_url, CANONICAL_1);
  assert.equal(counselorData[0].can_edit, true);
  assert.equal(counselorData[0].updated_by_name, 'Conselheiro C1');
  assert.equal(JSON.stringify(counselorData).includes(VALID_CODE_2), false);

  // Counselor without company -> []
  const unassignedCounselorRoute = loadRoute('src/app/api/companies/whatsapp/route.ts', {
    identity: {
      user: { id: 'u-cons-sem' },
      role: 'consultor',
      profile: { id: 'u-cons-sem', full_name: 'Conselheiro Sem Cia', role: 'consultor', company_id: null, suspended_at: null },
    },
    db,
  });
  assert.deepEqual(plain((await unassignedCounselorRoute.GET()).body).data, []);

  // Management roles -> get all companies sorted by name, can_edit: true, accurate has_counselor
  for (const role of ['casal_diretor', 'coordenador', 'logistica']) {
    const mgrRoute = loadRoute('src/app/api/companies/whatsapp/route.ts', {
      identity: {
        user: { id: 'u-coord' },
        role,
        profile: { id: 'u-coord', full_name: 'Gestor', role, company_id: null, suspended_at: null },
      },
      db,
    });
    const mgrData = plain((await mgrRoute.GET()).body).data;
    assert.deepEqual(
      mgrData.map((r) => r.company_id),
      ['cia-1', 'cia-2', 'cia-3']
    );
    assert.equal(mgrData[0].has_counselor, true);
    assert.equal(mgrData[1].has_counselor, false);
    assert.equal(mgrData[2].has_counselor, false);
    assert.equal(mgrData.every((r) => r.can_edit === true), true);
  }

  // midia and medico -> []
  for (const role of ['midia', 'medico']) {
    const otherRoute = loadRoute('src/app/api/companies/whatsapp/route.ts', {
      identity: {
        user: { id: `u-${role}` },
        role,
        profile: { id: `u-${role}`, full_name: role, role, company_id: null, suspended_at: null },
      },
      db,
    });
    assert.deepEqual(plain((await otherRoute.GET()).body).data, []);
  }
});

test('PUT /api/companies/whatsapp validates scope, normalizes links, removes with null, and audits without leaking URL', async () => {
  const { db, links, auditLogs } = buildStatefulWhatsappDb();

  // Youth, midia, medico -> 403
  for (const role of ['jovem', 'midia', 'medico']) {
    const route = loadRoute('src/app/api/companies/whatsapp/route.ts', {
      identity: {
        user: { id: `u-${role}` },
        role,
        profile: { id: `u-${role}`, full_name: role, role, company_id: 'cia-1', suspended_at: null },
      },
      db,
    });
    const res = await route.PUT(
      request('/api/companies/whatsapp', {
        method: 'PUT',
        body: { company_id: 'cia-1', invite_url: CANONICAL_1 },
      })
    );
    assert.equal(res.status, 403, role);
  }

  // Counselor of cia-1 attempting to update cia-2 -> 404 (not 403), no DB changes
  const counselorC1 = loadRoute('src/app/api/companies/whatsapp/route.ts', {
    identity: {
      user: { id: 'u-cons-1' },
      role: 'consultor',
      profile: { id: 'u-cons-1', full_name: 'Conselheiro C1', role: 'consultor', company_id: 'cia-1', suspended_at: null },
    },
    db,
  });
  const crossRes = await counselorC1.PUT(
    request('/api/companies/whatsapp', {
      method: 'PUT',
      body: { company_id: 'cia-2', invite_url: CANONICAL_1 },
    })
  );
  assert.equal(crossRes.status, 404);
  assert.equal(links.get('cia-2').invite_url, CANONICAL_2);
  assert.equal(auditLogs.length, 0);

  // Unassigned counselor attempting to update cia-1 -> 404
  const unassignedCounselor = loadRoute('src/app/api/companies/whatsapp/route.ts', {
    identity: {
      user: { id: 'u-cons-sem' },
      role: 'consultor',
      profile: { id: 'u-cons-sem', full_name: 'Sem Cia', role: 'consultor', company_id: null, suspended_at: null },
    },
    db,
  });
  const unassignedRes = await unassignedCounselor.PUT(
    request('/api/companies/whatsapp', {
      method: 'PUT',
      body: { company_id: 'cia-1', invite_url: CANONICAL_1 },
    })
  );
  assert.equal(unassignedRes.status, 404);

  // Invalid link -> 400 with exact pt-BR message
  const invalidRes = await counselorC1.PUT(
    request('/api/companies/whatsapp', {
      method: 'PUT',
      body: { company_id: 'cia-1', invite_url: 'https://wa.me/5516999999999' },
    })
  );
  assert.equal(invalidRes.status, 400);
  assert.match(plain(invalidRes.body).error, /https:\/\/chat\.whatsapp\.com/i);

  // Counselor of cia-1 updates own company link with query/invite path -> normalizes and logs "alterou"
  const updateRes = await counselorC1.PUT(
    request('/api/companies/whatsapp', {
      method: 'PUT',
      body: {
        company_id: 'cia-1',
        invite_url: `  https://chat.whatsapp.com/invite/${VALID_CODE_2}?mode=gi_t  `,
      },
    })
  );
  assert.equal(updateRes.status, 200);
  assert.equal(plain(updateRes.body).data.invite_url, CANONICAL_2);
  assert.equal(links.get('cia-1').invite_url, CANONICAL_2);
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].details.operation, 'alterou');
  assert.equal(JSON.stringify(auditLogs[0]).includes(VALID_CODE_2), false);
  assert.equal(JSON.stringify(auditLogs[0]).includes('chat.whatsapp.com'), false);

  // Counselor of cia-1 removes link with null -> deletes and logs "removeu"
  const removeRes = await counselorC1.PUT(
    request('/api/companies/whatsapp', {
      method: 'PUT',
      body: { company_id: 'cia-1', invite_url: null },
    })
  );
  assert.equal(removeRes.status, 200);
  assert.equal(plain(removeRes.body).data.invite_url, null);
  assert.equal(links.has('cia-1'), false);
  assert.equal(auditLogs.length, 2);
  assert.equal(auditLogs[1].details.operation, 'removeu');

  // Coordinator adds link to cia-3 (which has no active counselor) -> logs "adicionou" without URL
  const coordinator = loadRoute('src/app/api/companies/whatsapp/route.ts', {
    identity: {
      user: { id: 'u-coord' },
      role: 'coordenador',
      profile: { id: 'u-coord', full_name: 'Coordenação Geral', role: 'coordenador', company_id: null, suspended_at: null },
    },
    db,
  });
  const addRes = await coordinator.PUT(
    request('/api/companies/whatsapp', {
      method: 'PUT',
      body: { company_id: 'cia-3', invite_url: CANONICAL_1 },
    })
  );
  assert.equal(addRes.status, 200);
  assert.equal(plain(addRes.body).data.invite_url, CANONICAL_1);
  assert.equal(plain(addRes.body).data.has_counselor, false);
  assert.equal(links.get('cia-3').invite_url, CANONICAL_1);
  assert.equal(auditLogs.length, 3);
  assert.equal(auditLogs[2].details.operation, 'adicionou');
  assert.equal(JSON.stringify(auditLogs[2]).includes(VALID_CODE_1), false);
  assert.equal(JSON.stringify(auditLogs[2]).includes('chat.whatsapp.com'), false);

  // Coordinator updates cia-1 (whose active counselor comes from profiles, not company.counselors) -> has_counselor: true
  const coordCia1Res = await coordinator.PUT(
    request('/api/companies/whatsapp', {
      method: 'PUT',
      body: { company_id: 'cia-1', invite_url: CANONICAL_1 },
    })
  );
  assert.equal(coordCia1Res.status, 200);
  assert.equal(plain(coordCia1Res.body).data.has_counselor, true);
});
