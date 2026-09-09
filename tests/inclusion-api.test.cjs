const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const id = '123e4567-e89b-42d3-a456-426614174000';
const interviewId = '123e4567-e89b-42d3-a456-426614174001';
const createBody = { medical_record_id: id, needs: 'Acompanhamento', contacts: { parent: {}, bishop: {} } };
const interviewBody = { version: 3, scheduled_at: '2027-02-05T14:30:00-03:00', participants: 'Responsável e equipe', status: 'realizada', summary: 'Necessidades e apoio registrados.' };
const decisionBody = { version: 3, decision: 'participacao_confirmada', reason: 'A equipe responsável confirmou a participação.', support_plan: '', confirmed_by_human: true };
const routes = [
  ['route.ts', 'GET', undefined], ['route.ts', 'POST', createBody],
  ['[id]/route.ts', 'GET', undefined], ['[id]/route.ts', 'PATCH', { version: 3, needs: 'Apoio' }], ['[id]/route.ts', 'DELETE', undefined],
  ['[id]/interviews/route.ts', 'POST', interviewBody], ['[id]/interviews/[interviewId]/route.ts', 'PATCH', interviewBody],
  ['[id]/decision/route.ts', 'POST', decisionBody],
];
function fixture(identity = { user: { id: 'staff-identity' }, role: 'medico' }) {
  const rpcCalls = [], queryCalls = [], modules = {};
  let rpcResult = { data: { id, version: 4 }, error: null };
  const db = {
    rpc: async (name, payload) => { rpcCalls.push({ name, payload }); return rpcResult; },
    from: table => { const call = { table, filters: [] }; queryCalls.push(call); return {
      select() { return this; }, eq(column, value) { call.filters.push([column, value]); return this; },
      order: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: { id }, error: null }),
    }; },
  };
  Object.assign(modules, {
    zod: require('zod'),
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options.status, headers: options.headers }) } },
    '@/lib/supabase/server': { getCurrentUserAndRole: async () => identity },
    '@/lib/supabase/admin': { createAdminClient: () => db },
  });
  const load = file => {
    if (modules[file]) return modules[file];
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
      exports, require: name => modules[name] || load(`src/${name.slice(2)}.ts`), URL, console,
    });
    modules[file] = exports;
    return exports;
  };
  const invoke = (route, method, body, version = '3', params = { id, interviewId }) => load(`src/app/api/inclusion/${route}`)[method]({ url: `https://fsy.test/api/inclusion/${id}?version=${version}`, json: async () => body }, { params });
  return { invoke, rpcCalls, queryCalls, fail: code => { rpcResult = { data: null, error: { code, message: 'private database detail' } }; } };
}

test('all inclusion endpoints deny anonymous and unauthorized participants before database work', async () => {
  for (const [identity, status] of [[{ user: null, role: null }, 401], [{ user: { id: 'participant' }, role: 'jovem' }, 403]]) {
    const f = fixture(identity);
    for (const [route, method, body] of routes) assert.equal((await f.invoke(route, method, body)).status, status, `${method} ${route}`);
    assert.equal(f.rpcCalls.length + f.queryCalls.length, 0);
  }
});

test('create binds the medical UUID and staff actor to one transactional RPC', async () => {
  const f = fixture();
  const response = await f.invoke('route.ts', 'POST', createBody);
  assert.equal(response.status, 201);
  assert.match(response.headers['Cache-Control'], /private, no-store/);
  assert.equal(response.headers.Vary, 'Cookie');
  assert.equal(f.rpcCalls.length, 1);
  const { name, payload } = f.rpcCalls[0];
  assert.equal(name, 'mutate_inclusion');
  assert.equal(payload.p_actor_id, 'staff-identity');
  assert.equal(payload.p_payload.medical_record_id, id);
  assert.equal(payload.p_action, 'create');
  assert.equal((await f.invoke('route.ts', 'POST', { ...createBody, created_by: 'forged' })).status, 400);
  assert.equal(f.rpcCalls.length, 1);
});

test('interview updates preserve case, interview and expected version, never infer a decision', async () => {
  const f = fixture();
  assert.equal((await f.invoke('[id]/interviews/[interviewId]/route.ts', 'PATCH', interviewBody)).status, 200);
  const { payload } = f.rpcCalls[0];
  assert.equal(payload.p_case_id, id);
  assert.equal(payload.p_interview_id, interviewId);
  assert.equal(payload.p_action, 'interview_update');
  assert.equal(payload.p_payload.version, 3);
  assert.equal(payload.p_payload.decision, undefined);
  assert.equal((await f.invoke('[id]/decision/route.ts', 'POST', { ...decisionBody, confirmed_by_human: false })).status, 400);
  assert.equal(f.rpcCalls.length, 1);
});

test('detail queries restrict both interviews and history to the requested case', async () => {
  const f = fixture();
  assert.equal((await f.invoke('[id]/route.ts', 'GET')).status, 200);
  for (const call of f.queryCalls) assert.deepEqual(call.filters, [[call.table === 'inclusion_cases' ? 'id' : 'case_id', id]]);
  assert.equal(f.queryCalls.length, 3);
});

test('invalid identifiers and absent archive version never reach storage', async () => {
  const f = fixture();
  assert.equal((await f.invoke('[id]/route.ts', 'DELETE', undefined, '')).status, 400);
  assert.equal((await f.invoke('[id]/route.ts', 'PATCH', { version: 3 }, '3', { id: 'invalid' })).status, 400);
  assert.equal(f.rpcCalls.length, 0);
});

test('database conflicts, duplicate medical link and missing records are exposed as recoverable statuses', async () => {
  for (const [code, status] of [['40001', 409], ['23505', 409], ['P0002', 404], ['42501', 403], ['PGRST202', 503]]) {
    const f = fixture(); f.fail(code);
    const response = await f.invoke('[id]/route.ts', 'PATCH', { version: 3, needs: 'Apoio' });
    assert.equal(response.status, status, code);
    assert.equal(f.rpcCalls[0].payload.p_payload.version, 3);
    assert.ok(!JSON.stringify(response.body).includes('private database detail'));
  }
});
