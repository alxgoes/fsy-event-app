const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

function worker() {
  const handlers = {}, deleted = [], stored = [];
  const scope = {
    URL, Response, Promise,
    self: { location: { origin: 'https://fsy.test' }, addEventListener: (name, fn) => handlers[name] = fn, skipWaiting() {}, clients: { claim() {} } },
    caches: { keys: async () => ['fsy-pwa-v1', 'fsy-pwa-v2', 'other-app'], delete: async key => deleted.push(key), open: async () => ({ match: async () => undefined, put: async request => stored.push(request.url), add: async () => undefined }) },
    fetch: async () => new Response('asset'),
  };
  vm.createContext(scope);
  vm.runInContext(fs.readFileSync('public/sw.js', 'utf8'), scope);
  return { handlers, deleted, stored, scope };
}

test('private API and React payload requests bypass persistent cache', () => {
  const { handlers } = worker();
  for (const path of ['/api/medical', '/api/profiles', '/api/schedule', '/admin?_rsc=abc']) {
    let intercepted = false;
    handlers.fetch({ request: { method: 'GET', url: `https://fsy.test${path}`, mode: 'cors' }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, path);
  }
});

test('authenticated HTML is fetched without being persisted', async () => {
  const { handlers, stored } = worker();
  let response;
  handlers.fetch({ request: { method: 'GET', url: 'https://fsy.test/admin', mode: 'navigate' }, respondWith(promise) { response = promise; } });
  assert.equal((await response).status, 200);
  assert.deepEqual(stored, []);
});

test('activation removes old FSY cache but preserves unrelated caches', async () => {
  const { handlers, deleted } = worker();
  let activation;
  handlers.activate({ waitUntil(promise) { activation = promise; } });
  await activation;
  assert.deepEqual(deleted, ['fsy-pwa-v1']);
});

test('navigation without network has an honest offline fallback', async () => {
  const { handlers, scope } = worker();
  scope.fetch = async () => { throw new Error('offline'); };
  let response;
  handlers.fetch({ request: { method: 'GET', url: 'https://fsy.test/admin', mode: 'navigate' }, respondWith(promise) { response = promise; } });
  const fallback = await response;
  assert.equal(fallback.status, 503);
  assert.match(await fallback.text(), /Conecte-se/);
});
