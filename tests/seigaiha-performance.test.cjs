const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/components/ui/Seigaiha.tsx', 'utf8');
const compiled = ts.transpile(source.slice(source.indexOf('const DEFAULTS'), source.indexOf('export interface SeigaihaProps')) + '\nglobalThis.Scene = WaveScene; globalThis.defaults = DEFAULTS;', { target: ts.ScriptTarget.ES2020 });

function harness(width, height) {
  const calls = { arc: 0, drawImage: 0, bounds: 0, removed: 0 };
  const frames = new Map();
  let now = 0, frameId = 0;
  const ctx = { setTransform() {}, clearRect() {}, beginPath() {}, closePath() {}, fill() {}, stroke() {}, arc() { calls.arc++; }, drawImage() { calls.drawImage++; } };
  const scope = {
    performance: { now: () => now += 16.67 },
    window: { devicePixelRatio: 1.5, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} },
    document: { createElement: () => ({ style: {}, getContext: () => ctx }), addEventListener() {}, removeEventListener() {}, hidden: false },
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  };
  vm.createContext(scope);
  vm.runInContext(compiled, scope);
  const container = { appendChild(canvas) { canvas.parentNode = container; }, removeChild() { calls.removed++; }, getBoundingClientRect() { calls.bounds++; return { left: 0, top: 0 }; } };
  const scene = new scope.Scene(container, { ...scope.defaults, count: 14, rings: 14, thickness: 5, overlap: 20, colors: ['#9EDAE8', '#B5E8F3', '#89D0E2', '#A6DDEF'], speed: 6, strength: 3 });
  scene.setSize(width, height);
  return { scene, calls, frames, scope };
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test(`wave rendering work at ${width}x${height}`, () => {
    const { scene, calls } = harness(width, height);
    scene.step();
    assert.equal(calls.arc, 32, 'four palette sprites, eight rings each');
    calls.arc = calls.drawImage = 0;
    scene.step();
    const radius = 116 - 14 * 4.4;
    const rows = Math.ceil(height / (radius * (.24 + 20 * .019))) + 6;
    const cols = Math.ceil(width / radius) + 6;
    // The original renderer redrew eight filled arcs per motif each frame.
    const originalArcCalls = rows * cols * 8;
    assert.equal(calls.drawImage, rows * cols);
    assert.equal(calls.arc, 0);
    console.log(JSON.stringify({ viewport: `${width}x${height}`, originalArcCalls, cachedFrame: { arc: calls.arc, drawImage: calls.drawImage } }));
    calls.arc = calls.drawImage = 0;
    for (let i = 0; i < 20; i++) scene.onMove({ clientX: width / 2, clientY: height / 2 });
    assert.equal(calls.bounds, 0, 'pointer events do not synchronously measure layout');
    scene.step();
    assert.equal(calls.bounds, 1, 'one layout read per frame');
    assert.ok(calls.arc > 0, 'pointer glow is still drawn');
    assert.ok(calls.arc < originalArcCalls / 4, 'fresh paths are limited to pointer reach');
    assert.equal(calls.arc / 8 + calls.drawImage, rows * cols, 'all original motifs remain');
    console.log(JSON.stringify({ pointerFrame: { arc: calls.arc, drawImage: calls.drawImage } }));
    scene.dispose();
    assert.equal(calls.removed, 1);
  });
}

test('hidden tabs, reduced motion, resize and disposal', () => {
  const { scene, frames, scope, calls } = harness(390, 844);
  scene.start();
  assert.equal(frames.size, 1);
  scope.document.hidden = true;
  scene.onVisibilityChange();
  assert.equal(frames.size, 0);
  scope.document.hidden = false;
  scene.onVisibilityChange();
  assert.equal(frames.size, 1);
  scene.onMotionChange({ matches: true });
  assert.equal(frames.size, 0);
  calls.drawImage = 0;
  scene.setSize(844, 390);
  assert.ok(calls.drawImage > 0, 'reduced-motion canvas redraws after resize');
  scene.onMotionChange({ matches: false });
  assert.equal(frames.size, 1);
  scene.dispose();
  assert.equal(frames.size, 0);
  assert.equal(calls.removed, 1);
});
