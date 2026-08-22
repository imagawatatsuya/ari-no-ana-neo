import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectBasePath,
  getLegacyHashPath,
  normalizeBasePath,
  parseRoute,
} from './router.ts';

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

test('detectBasePath: relative assets keep github pages project path', () => {
  assert.equal(
    detectBasePath('./', ['./assets/index.js'], '/ari-no-ana-neo/'),
    '/ari-no-ana-neo',
  );
});

test('parseRoute: root deployment routes', () => {
  assert.deepEqual(parseRoute('/', ''), {
    view: 'list',
    activeNovelId: null,
    page: 1,
  });
  assert.deepEqual(parseRoute('/read/novel-1', ''), {
    view: 'read',
    activeNovelId: 'novel-1',
    page: null,
  });
  assert.deepEqual(parseRoute('/ryuseigai', ''), {
    view: 'ryuseigai',
    activeNovelId: null,
    page: null,
  });
  assert.deepEqual(parseRoute('/ryuseigai/read/meteor-1', ''), {
    view: 'ryuseigai-read',
    activeNovelId: 'meteor-1',
    page: null,
  });
  assert.deepEqual(parseRoute('/post', ''), {
    view: 'post',
    activeNovelId: null,
    page: null,
  });
  assert.deepEqual(parseRoute('/admin', ''), {
    view: 'admin',
    activeNovelId: null,
    page: null,
  });
  assert.deepEqual(parseRoute('/page/3', ''), {
    view: 'list',
    activeNovelId: null,
    page: 3,
  });
});

test('parseRoute: github pages project path is removed before routing', () => {
  assert.deepEqual(parseRoute('/ari-no-ana-neo/read/novel-1', '/ari-no-ana-neo'), {
    view: 'read',
    activeNovelId: 'novel-1',
    page: null,
  });
  assert.deepEqual(parseRoute('/ari-no-ana-neo/ryuseigai/read/meteor-1', '/ari-no-ana-neo'), {
    view: 'ryuseigai-read',
    activeNovelId: 'meteor-1',
    page: null,
  });
  assert.deepEqual(parseRoute('/ari-no-ana-neo/page/2', '/ari-no-ana-neo'), {
    view: 'list',
    activeNovelId: null,
    page: 2,
  });
});

test('getLegacyHashPath: old hash routes map to history paths', () => {
  assert.equal(getLegacyHashPath('#read/novel-1', ''), '/read/novel-1');
  assert.equal(getLegacyHashPath('#post', '/ari-no-ana-neo'), '/ari-no-ana-neo/post');
  assert.equal(getLegacyHashPath('#admin', '/ari-no-ana-neo'), '/ari-no-ana-neo/admin');
  assert.equal(getLegacyHashPath('#main-content', ''), null);
  assert.equal(getLegacyHashPath('#', ''), null);
});
