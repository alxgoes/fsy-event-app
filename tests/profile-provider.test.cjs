// Run with: node --test tests/profile-provider.test.cjs
// A lightweight effect harness exercises request/subscription behavior without a browser.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const test = require("node:test");
const ts = require("typescript");

const compiled = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, "../src/lib/supabase/useProfile.ts"), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }
).outputText;
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture() {
  const states = [], effects = [], cleanups = [], timers = new Map();
  let context, calls = 0, queries = 0, listener, resolveQuery, timerId = 0;
  const react = {
    createContext: () => ({ Provider: "provider" }),
    useContext: () => context,
    useState: (value) => {
      const index = states.length;
      states.push(value);
      return [value, (next) => {
        states[index] = typeof next === "function" ? next(states[index]) : next;
      }];
    },
    useEffect: (effect) => effects.push(effect),
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    createElement: (_, props) => props,
  };
  const client = {
    auth: {
      getUser: async () => {
        calls++;
        return { data: { user: { id: "alice", email: "alice@example.test" } } };
      },
      onAuthStateChange: (callback) => {
        listener = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from: () => ({
      select() { return this; },
      eq() { return this; },
      single() {
        queries++;
        return new Promise((resolve) => { resolveQuery = resolve; });
      },
    }),
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => name === "react" ? react : { createClient: () => client },
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  });
  return {
    exports, states,
    setContext: (value) => { context = value; },
    runEffects: () => {
      while (effects.length) {
        const cleanup = effects.shift()();
        if (cleanup) cleanups.push(cleanup);
      }
    },
    runTimers: () => {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
    },
    cleanup: () => cleanups.forEach((fn) => fn()),
    calls: () => calls,
    queries: () => queries,
    event: (...args) => listener(...args),
    resolve: () => resolveQuery({ data: { id: "alice", role: "jovem" } }),
  };
}

test("provider shares one request with three consumers and ignores repeated sign-in", async () => {
  const shared = fixture();
  const provider = shared.exports.ProfileProvider({ children: null });
  shared.setContext(provider.value);
  for (let count = 0; count < 3; count++) shared.exports.useProfile();
  shared.runEffects();
  await flush();
  assert.equal(shared.calls(), 1);
  assert.equal(shared.queries(), 1);
  shared.event("SIGNED_IN", { user: { id: "alice" } });
  shared.runTimers();
  await flush();
  assert.equal(shared.calls(), 1);
  shared.resolve();
  await flush();
  assert.equal(shared.states[0].id, "alice");
  shared.cleanup();
});

test("a late profile response cannot restore a signed-out user", async () => {
  const session = fixture();
  session.exports.ProfileProvider({ children: null });
  session.runEffects();
  await flush();
  session.event("SIGNED_OUT", null);
  session.resolve();
  await flush();
  assert.equal(session.states[0], null);
  assert.equal(session.states[1], false);
  session.cleanup();
});

test("standalone useProfile fetches; auth refresh is deferred and canceled on unmount", async () => {
  const session = fixture();
  session.exports.useProfile();
  session.runEffects();
  await flush();
  assert.equal(session.calls(), 1);
  session.resolve();
  await flush();
  session.event("USER_UPDATED", { user: { id: "alice" } });
  assert.equal(session.calls(), 1);
  session.cleanup();
  session.runTimers();
  await flush();
  assert.equal(session.calls(), 1);
});
