const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadRoute } = require('./helpers/route-harness.cjs');

const p = loadRoute('src/lib/auth/permissions.ts');

test('direction, coordination and logistics have equivalent authority over every role', () => {
  for (const actor of ['logistica', 'coordenador', 'casal_diretor']) {
    for (const target of p.USER_ROLES) {
      assert.equal(p.canManageAccount(actor, target), true, `${actor} → ${target}`);
      for (const next of p.USER_ROLES) assert.equal(p.canAssignRole(actor, target, next), true, `${actor}: ${target} → ${next}`);
      for (const action of ['edit','role','suspend','delete','set_password','recovery_email','email']) {
        assert.equal(p.canPerformAccountAction(actor, target, action), true, `${actor} ${action} ${target}`);
      }
    }
    assert.ok(p.ADMIN_ROLES.includes(actor));
  }
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
