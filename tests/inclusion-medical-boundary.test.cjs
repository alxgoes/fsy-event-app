const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, identity, db) {
  const exports = {};
  let dbCalls = 0;
  const modules = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/supabase/server': { getCurrentUserAndRole: async () => identity },
    '@/lib/supabase/admin': { createAdminClient: () => { dbCalls++; if (db) return db; throw Error('unauthorized database access'); } },
    zod: require('zod'),
  };
  const loadDependency = name => {
    if (name in modules) return modules[name];
    if (name.startsWith('@/types/')) {
      const result = {};
      vm.runInNewContext(ts.transpileModule(fs.readFileSync(`src/${name.slice(2)}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: result, require: loadDependency });
      return result;
    }
    throw Error(`Unmocked module: ${name}`);
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, require: loadDependency, URL, console,
  });
  return { exports, dbCalls: () => dbCalls };
}

for (const [file, methods] of [
  ['src/app/api/medical/route.ts', ['GET', 'POST', 'PUT', 'DELETE']],
  ['src/app/api/medical/appointments/route.ts', ['GET', 'POST', 'PUT', 'DELETE']],
]) {
  test(`${file}: anonymous requests are rejected before private database access`, async () => {
    for (const method of methods) {
      const f = load(file, { user: null, role: null });
      const request = { url: 'https://fsy.test/api/medical?id=123e4567-e89b-42d3-a456-426614174000', json: async () => ({ id: '123e4567-e89b-42d3-a456-426614174000', full_name: 'Pessoa', youth_name: 'Pessoa', professional_name: 'Equipe', scheduled_at: '2027-02-05T12:00:00Z' }) };
      const result = await f.exports[method](request);
      assert.equal(result.status, 401, method);
      assert.equal(f.dbCalls(), 0, method);
    }
  });
}

test('participants cannot modify or delete another medical record', async () => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const f = load('src/app/api/medical/route.ts', { user: { id: 'participant' }, role: 'jovem' });
    const result = await f.exports[method]({ url: 'https://fsy.test/api/medical?id=123e4567-e89b-42d3-a456-426614174000', json: async () => ({ id: '123e4567-e89b-42d3-a456-426614174000', full_name: 'Outra pessoa' }) });
    assert.equal(result.status, 403, method);
    assert.equal(f.dbCalls(), 0, method);
  }
});

function appointmentFixture(role = 'jovem', result = { data: { id: '123e4567-e89b-42d3-a456-426614174000', is_seen: true }, error: null }) {
  const calls = [];
  const db = { from(table) {
    const call = { table, filters: [], selections: [] }; calls.push(call);
    return {
      select(columns) { call.selections.push(columns); return this; },
      eq(key, value) { call.filters.push([key, value]); return this; },
      insert(payload) { call.insert = payload; return this; },
      update(payload) { call.update = payload; return this; },
      delete() { call.delete = true; return this; },
      order: async () => result, single: async () => result, maybeSingle: async () => result,
    };
  } };
  const f = load('src/app/api/medical/appointments/route.ts', { user: { id: 'current-participant' }, role }, db);
  return { ...f, calls };
}
const appointmentId = '123e4567-e89b-42d3-a456-426614174000';
const appointmentRequest = (body, query = '') => ({ url: `https://fsy.test/api/medical/appointments?${query}`, json: async () => body });

test('participant appointment reads filter the authenticated owner and exclude private notes', async () => {
  const f = appointmentFixture();
  assert.equal((await f.exports.GET(appointmentRequest(undefined, 'unread=true'))).status, 200);
  assert.deepEqual(f.calls[0].filters, [['user_id', 'current-participant'], ['is_seen', false]]);
  assert.ok(!f.calls[0].selections[0].includes('notes'));
  assert.ok(!f.calls[0].selections[0].includes('*'));
  assert.equal((await f.exports.GET(appointmentRequest(undefined, 'user_id=someone-else'))).status, 403);
  assert.equal(f.calls.length, 1);
});

test('participant can acknowledge only their own appointment without changing clinical fields', async () => {
  const f = appointmentFixture();
  assert.equal((await f.exports.PUT(appointmentRequest({ id: appointmentId, is_seen: true }))).status, 200);
  assert.deepEqual(f.calls[0].filters, [['id', appointmentId], ['user_id', 'current-participant']]);
  assert.equal(f.calls[0].update.is_seen, true);
  assert.deepEqual(f.calls[0].selections, ['id,is_seen,seen_at']);
  for (const extra of [{ notes: 'Alterado' }, { status: 'cancelado' }, { reason: 'Outro motivo' }, { is_seen: false }]) {
    assert.equal((await f.exports.PUT(appointmentRequest({ id: appointmentId, is_seen: true, ...extra }))).status, 403);
  }
  assert.equal(f.calls.length, 1);
  const missing = appointmentFixture('jovem', { data: null, error: null });
  assert.equal((await missing.exports.PUT(appointmentRequest({ id: appointmentId, is_seen: true }))).status, 404);
});

test('staff persistence errors never report success or fall back to shared logistics storage', async () => {
  const body = { youth_name: 'Participante', professional_name: 'Equipe', scheduled_at: '2027-02-05T12:00:00Z' };
  for (const [method, payload] of [['POST', body], ['PUT', { id: appointmentId, notes: 'Registro' }], ['DELETE', undefined]]) {
    const f = appointmentFixture('medico', { data: null, error: { code: '42P01' } });
    assert.equal((await f.exports[method](appointmentRequest(payload, `id=${appointmentId}`))).status, 500);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].table, 'medical_appointments');
  }
});
