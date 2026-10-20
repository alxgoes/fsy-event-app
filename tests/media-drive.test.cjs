const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadRoute } = require('./helpers/route-harness.cjs');
const d = loadRoute('src/lib/media/drive.ts');

test('extracts Drive file ids from the common link shapes', () => {
  assert.equal(d.driveFileId('https://drive.google.com/file/d/1AbC_d-9/view?usp=sharing'), '1AbC_d-9');
  assert.equal(d.driveFileId('https://drive.google.com/open?id=XYZ123'), 'XYZ123');
  assert.equal(d.driveFileId('https://drive.google.com/uc?export=view&id=QWE'), 'QWE');
  assert.equal(d.driveFileId('https://drive.google.com/drive/folders/abc'), null);
  assert.equal(d.driveFileId('https://evil.test/file/d/abc/view'), null);
});

test('builds thumbnail and full-size sources only for safe https images', () => {
  const photo = { drive_url: 'https://drive.google.com/file/d/ID1/view', thumbnail_url: null };
  assert.equal(d.photoSources(photo).thumb, 'https://drive.google.com/thumbnail?id=ID1&sz=w640');
  assert.equal(d.photoSources(photo).full, 'https://lh3.googleusercontent.com/d/ID1=w2048');
  assert.equal(d.photoSources(photo).original, 'https://drive.google.com/file/d/ID1/view');
  const direct = { drive_url: 'https://cdn.example.org/a.webp', thumbnail_url: null };
  assert.equal(d.photoSources(direct).full, 'https://cdn.example.org/a.webp');
  for (const bad of ['javascript:alert(1)', 'http://drive.google.com/file/d/x/view', 'not a url', '']) {
    assert.equal(d.photoSources({ drive_url: bad, thumbnail_url: null }), null, bad);
  }
});

test('folder links are not treated as photos', () => {
  assert.equal(d.photoSources({ drive_url: 'https://drive.google.com/drive/folders/abc', thumbnail_url: null }), null);
});
