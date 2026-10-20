const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadRoute } = require('./helpers/route-harness.cjs');

const order = loadRoute('src/lib/layout/order.ts');
const plain = (v) => JSON.parse(JSON.stringify(v));
const DEFAULT = ['hero', 'theme', 'now', 'company', 'photos'];

test('without a saved preference the default order is used', () => {
  assert.deepEqual(plain(order.resolveOrder(DEFAULT, null)), DEFAULT);
});

test('saved order is honored and unknown ids are discarded', () => {
  assert.deepEqual(plain(order.resolveOrder(DEFAULT, ['photos', 'ghost', 'hero', 'theme', 'now', 'company'])), ['photos', 'hero', 'theme', 'now', 'company']);
});

test('new cards are inserted after their default predecessor', () => {
  const next = ['hero', 'alerts', 'theme', 'now', 'company', 'photos', 'instagram'];
  assert.deepEqual(plain(order.resolveOrder(next, ['photos', 'hero', 'company', 'now', 'theme'])), ['photos', 'hero', 'alerts', 'company', 'now', 'theme', 'instagram']);
});

test('a new first card stays first', () => {
  assert.deepEqual(plain(order.resolveOrder(['intro', ...DEFAULT], ['photos', 'hero', 'theme', 'now', 'company'])), ['intro', 'photos', 'hero', 'theme', 'now', 'company']);
});

test('duplicates in a saved order are ignored', () => {
  assert.deepEqual(plain(order.resolveOrder(DEFAULT, ['now', 'now', 'hero'])), ['now', 'hero', 'theme', 'company', 'photos']);
});

test('malformed saved data falls back to the default', () => {
  for (const bad of [42, 'hero', { a: 1 }, [1, 2], undefined]) assert.deepEqual(plain(order.resolveOrder(DEFAULT, bad)), DEFAULT);
});

test('moveBy clamps at the edges and keeps every id', () => {
  assert.deepEqual(plain(order.moveBy(DEFAULT, 'theme', -1)), ['theme', 'hero', 'now', 'company', 'photos']);
  assert.deepEqual(plain(order.moveBy(DEFAULT, 'hero', -1)), DEFAULT);
  assert.deepEqual(plain(order.moveBy(DEFAULT, 'photos', 5)), DEFAULT);
  assert.deepEqual(plain(order.moveTo(DEFAULT, 'hero', 3)), ['theme', 'now', 'company', 'hero', 'photos']);
});

test('isDefaultOrder detects restorations', () => {
  assert.equal(order.isDefaultOrder(DEFAULT, [...DEFAULT]), true);
  assert.equal(order.isDefaultOrder(DEFAULT, order.moveBy(DEFAULT, 'now', 1)), false);
});

test('local cache keys are isolated per account and page', () => {
  assert.notEqual(order.cacheKey('user-a', 'dashboard'), order.cacheKey('user-b', 'dashboard'));
  assert.notEqual(order.cacheKey('user-a', 'dashboard'), order.cacheKey('user-a', 'consultor'));
  assert.equal(order.isForeignLayoutKey(order.cacheKey('user-b', 'dashboard'), 'user-a'), true);
  assert.equal(order.isForeignLayoutKey(order.cacheKey('user-a', 'dashboard'), 'user-a'), false);
  assert.equal(order.isForeignLayoutKey('fsy:schedule:x', 'user-a'), false);
});

test('target index for a pointer uses card centers', () => {
  const rects = [{ top: 0, left: 0, width: 100, height: 100 }, { top: 0, left: 120, width: 100, height: 100 }, { top: 120, left: 0, width: 220, height: 100 }];
  assert.equal(order.indexAtPoint(rects, { x: 170, y: 50 }), 1);
  assert.equal(order.indexAtPoint(rects, { x: 10, y: 200 }), 2);
  assert.equal(order.indexAtPoint(rects, { x: 10, y: -500 }), 0);
});
