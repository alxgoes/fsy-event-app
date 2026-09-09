// Run with: node --test tests/offline-cache.test.cjs
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const test = require("node:test");
const ts = require("typescript");

test("private offline keys isolate accounts and companies and discard shared legacy data", async () => {
  let userId = "alice";
  const storage = new Map([
    ["fsy_offline_announcements", "legacy notices"],
    ["fsy_offline_company_company-a", "legacy company"],
    ["unrelated", "preserve"],
  ]);
  const exports = {};
  const source = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/services/offlineCache.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }
  ).outputText;
  vm.runInNewContext(source, {
    exports, window: {},
    localStorage: {
      get length() { return storage.size; },
      key: (index) => [...storage.keys()][index],
      removeItem: (key) => storage.delete(key),
    },
    require: () => ({ createClient: () => ({ auth: { getSession: async () => ({
      data: { session: userId ? { user: { id: userId } } : null }, error: null,
    }) } }) }),
  });
  const getKey = exports.getOfflineCacheKey;
  const aliceA = await getKey("announcements", "company-a");
  assert.notEqual(aliceA, await getKey("announcements", "company-b"));
  assert.notEqual(aliceA, await getKey("announcements", null));
  assert.notEqual(aliceA, await getKey("company", "company-a"));
  userId = "bob";
  assert.notEqual(aliceA, await getKey("announcements", "company-a"));
  userId = null;
  assert.equal(await getKey("announcements", "company-a"), null);
  assert.deepEqual([...storage.entries()], [["unrelated", "preserve"]]);
});
