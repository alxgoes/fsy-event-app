const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadRoute, request } = require('./helpers/route-harness.cjs');
const plain = (v) => JSON.parse(JSON.stringify(v));

const caption = loadRoute('src/lib/media/caption.ts');

test('caption tokens keep text, links, mentions and hashtags without HTML', () => {
  const tokens = plain(caption.tokenizeCaption('Oi @fsy_rp! Veja https://fsy.test/mapa. #FSY2027 <b>x</b>'));
  assert.deepEqual(tokens.filter((t) => t.type !== 'text').map((t) => [t.type, t.value, t.href]), [
    ['mention', '@fsy_rp', 'https://www.instagram.com/fsy_rp/'],
    ['link', 'https://fsy.test/mapa', 'https://fsy.test/mapa'],
    ['hashtag', '#FSY2027', 'https://www.instagram.com/explore/tags/FSY2027/'],
  ]);
  assert.equal(tokens.map((t) => t.value).join(''), 'Oi @fsy_rp! Veja https://fsy.test/mapa. #FSY2027 <b>x</b>');
});

test('only http(s) URLs become links', () => {
  const tokens = plain(caption.tokenizeCaption('javascript:alert(1) www.x.com'));
  assert.equal(tokens.some((t) => t.type === 'link'), false);
});

test('long captions are detected by length or line count', () => {
  assert.equal(caption.isLongCaption('curta'), false);
  assert.equal(caption.isLongCaption('a'.repeat(200)), true);
  assert.equal(caption.isLongCaption('1\n2\n3\n4'), true);
});

test('instagram API returns full captions, video thumbnails and no fake likes', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ username: 'fsy_ribeiraopreto', posts: [
    { id: '1', caption: 'Legenda completa\ncom várias linhas e final importante', prunedCaption: 'Legenda completa…', mediaType: 'IMAGE', mediaUrl: 'https://cdn.test/1.jpg', permalink: 'https://www.instagram.com/p/1/', timestamp: '2026-10-10T12:00:00Z' },
    { id: '2', caption: '', mediaType: 'VIDEO', mediaUrl: 'https://cdn.test/2.mp4', thumbnailUrl: 'https://cdn.test/2.jpg', permalink: 'https://www.instagram.com/p/2/' },
    { id: '3', mediaType: 'IMAGE' },
  ] }) });
  try {
    const route = loadRoute('src/app/api/instagram/route.ts');
    const res = await route.GET(request('/api/instagram'));
    const data = plain(res.body.data);
    assert.equal(data.length, 2);
    assert.equal(data[0].caption, 'Legenda completa\ncom várias linhas e final importante');
    assert.equal(data[1].imageUrl, 'https://cdn.test/2.jpg');
    assert.equal(data[1].caption, '');
    assert.equal('likesCount' in data[0], false);
    const bad = await route.GET(request('/api/instagram?feedId=../../etc'));
    assert.notEqual(bad.status, 500);
  } finally {
    globalThis.fetch = original;
  }
});
