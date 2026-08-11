import test from 'node:test';
import assert from 'node:assert/strict';

import { detectBasePath, normalizeBasePath } from './router.ts';

test('normalizeBasePath: empty and root', () => {
  assert.equal(normalizeBasePath(''), '');
  assert.equal(normalizeBasePath('/'), '');
  assert.equal(normalizeBasePath('./'), '');
});

test('normalizeBasePath: github pages path', () => {
  assert.equal(normalizeBasePath('/ari-no-ana-neo/'), '/ari-no-ana-neo');
  assert.equal(normalizeBasePath('./ari-no-ana-neo/'), '/ari-no-ana-neo');
});

test('detectBasePath: vite base url', () => {
  assert.equal(
    detectBasePath('/ari-no-ana-neo/', [], '/'),
    '/ari-no-ana-neo',
  );
});

test('detectBasePath: relative script src does not yield empty on github pages pathname', () => {
  assert.equal(
    detectBasePath('./', ['./assets/index.js'], '/ari-no-ana-neo/read/1'),
    '/ari-no-ana-neo',
  );
});

test('detectBasePath: absolute script src', () => {
  assert.equal(
    detectBasePath('', ['/ari-no-ana-neo/assets/index.js'], '/'),
    '/ari-no-ana-neo',
  );
});

test('detectBasePath: root deployment has no base', () => {
  assert.equal(detectBasePath('./', ['./assets/index.js'], '/read/1'), '');
});
