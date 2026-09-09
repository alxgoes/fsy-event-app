const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
function load(file, modules) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { if (!(name in modules)) throw Error(name); return modules[name]; }, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' } } });
  return exports;
}
function fixture(role, profileError = null, user = { id: 'alice', user_metadata: { role: 'coordenador' }, app_metadata: { role: 'coordenador' } }) {
  let reads = 0;
  const client = { auth: { getUser: async () => ({ data: { user } }) }, from: () => ({ select() { return this; }, eq(column, value) { assert.equal(column, 'id'); assert.equal(value, 'alice'); return this; }, single: async () => { reads++; return { data: role ? { role } : null, error: profileError }; } }) };
  const common = { '@supabase/ssr': { createServerClient: () => client }, '@/lib/supabase/admin': { createAdminClient: () => client }, 'next/headers': { cookies: () => ({ getAll: () => [] }) } };
  return { client, common, reads: () => reads };
}

test('server ignores forged user metadata and stale administrator JWT role', async () => {
  const f = fixture('jovem');
  const result = await load('src/lib/supabase/server.ts', f.common).getCurrentUserAndRole();
  assert.equal(result.role, 'jovem');
  assert.equal(f.reads(), 1);
});
test('server accepts a current staff profile and fails closed on missing/error profile', async () => {
  for (const [role, error, expected] of [['medico', null, 'medico'], [null, null, null], ['coordenador', { message: 'unavailable' }, null]]) {
    const f = fixture(role, error);
    assert.equal((await load('src/lib/supabase/server.ts', f.common).getCurrentUserAndRole()).role, expected);
  }
});
test('anonymous server calls never query profiles', async () => {
  const f = fixture('coordenador', null, null);
  const result = await load('src/lib/supabase/server.ts', f.common).getCurrentUserAndRole();
  assert.equal(result.user, null);
  assert.equal(f.reads(), 0);
});
test('admin middleware ignores forged role cookie and metadata', async () => {
  const f = fixture('jovem');
  const modules = { ...f.common, 'next/server': { NextResponse: { next: () => ({ cookies: { set() {} }, type: 'next' }), redirect: url => ({ pathname: url.pathname }), json: () => ({}) } } };
  const { middleware } = load('src/middleware.ts', modules);
  const request = { cookies: { getAll: () => [], get: () => ({ value: 'coordenador' }) }, nextUrl: { pathname: '/admin/medical', clone: () => ({ pathname: '', searchParams: new URLSearchParams() }) } };
  assert.equal((await middleware(request)).pathname, '/acesso-negado');
  assert.equal(f.reads(), 1);
});
