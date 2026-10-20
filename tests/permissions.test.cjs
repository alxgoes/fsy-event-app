const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadRoute } = require('./helpers/route-harness.cjs');

const p = loadRoute('src/lib/auth/permissions.ts');

test('logistics manages participants but not coordinators or directors', () => {
  assert.equal(p.canManageAccount('logistica', 'jovem'), true);
  assert.equal(p.canManageAccount('logistica', 'coordenador'), false);
  assert.equal(p.canManageAccount('logistica', 'logistica'), false);
  assert.equal(p.canAssignRole('logistica', 'jovem', 'coordenador'), false);
  assert.equal(p.canAssignRole('logistica', 'jovem', 'consultor'), true);
});

test('coordinators cannot promote anyone to their own level or above', () => {
  assert.equal(p.canAssignRole('coordenador', 'jovem', 'coordenador'), false);
  assert.equal(p.canAssignRole('coordenador', 'jovem', 'logistica'), true);
  assert.equal(p.canManageAccount('coordenador', 'casal_diretor'), false);
});

test('only directors suspend, delete or set passwords', () => {
  assert.equal(p.canPerformAccountAction('logistica', 'jovem', 'suspend'), false);
  assert.equal(p.canPerformAccountAction('logistica', 'jovem', 'recovery_email'), true);
  assert.equal(p.canPerformAccountAction('coordenador', 'jovem', 'delete'), true);
  assert.equal(p.canPerformAccountAction('casal_diretor', 'casal_diretor', 'set_password'), true);
});

test('non-managers never manage accounts', () => {
  for (const role of ['jovem', 'consultor', 'midia', 'medico', null]) assert.equal(p.canManageAccount(role, 'jovem'), false, role);
});

test('safeInternalPath rejects external and protocol-relative targets', () => {
  for (const bad of ['//evil.test', 'https://evil.test', '@evil.test', '/\\evil.test', '', null]) assert.equal(p.safeInternalPath(bad), '/dashboard', String(bad));
  assert.equal(p.safeInternalPath('/redefinir-senha'), '/redefinir-senha');
});

test('home path follows the current role contract', () => {
  assert.equal(p.homePathForRole('medico'), '/admin/medical');
  assert.equal(p.homePathForRole('logistica'), '/admin');
  assert.equal(p.homePathForRole('jovem'), '/dashboard');
  assert.equal(p.homePathForRole(null), '/dashboard');
});
