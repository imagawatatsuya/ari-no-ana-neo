import test from 'node:test';
import assert from 'node:assert/strict';

import { clearNovelReadCache, evictNovelReadCache, peekNovelReadCache, writeNovelReadCache, NOVEL_READ_CACHE_TTL_MS, novelReadCacheRevision } from './lib/cache/novelReadCache.ts';
import { READ_COMMENT_COLUMNS, READ_NOVEL_COLUMNS } from './features/novels/novelSummaries.ts';

const novel = (id, title = 'T') => ({
  id,
  title,
  author: 'A',
  body: '本文',
  date: '2025-01-01T00:00:00+09:00',
  viewCount: 0,
  commentCount: 0,
  voteSum: 0,
});

test('novel read cache expires even when repeatedly visited', (t) => {
  clearNovelReadCache();
  let now = 100_000;
  t.mock.method(Date, 'now', () => now);
  writeNovelReadCache('n1', novel('n1'), []);
  now += NOVEL_READ_CACHE_TTL_MS - 1;
  assert.ok(peekNovelReadCache('n1'));
  now += 1;
  assert.equal(peekNovelReadCache('n1'), null);
});

test('invalidation changes the generation so older requests cannot refill the cache', () => {
  const before = novelReadCacheRevision('n1');
  const unrelated = novelReadCacheRevision('n2');
  evictNovelReadCache('n1');
  assert.notEqual(novelReadCacheRevision('n1'), before);
  assert.equal(novelReadCacheRevision('n2'), unrelated);
  const after = novelReadCacheRevision('n1');
  clearNovelReadCache();
  assert.notEqual(novelReadCacheRevision('n1'), after);
  assert.notEqual(novelReadCacheRevision('n2'), unrelated);
});

test('novel read query columns include body and indent, not select-all', () => {
  assert.ok(READ_NOVEL_COLUMNS.includes('body'));
  assert.ok(READ_NOVEL_COLUMNS.includes('author_indent_mode'));
  assert.ok(!READ_NOVEL_COLUMNS.includes('*'));
  assert.equal(READ_COMMENT_COLUMNS, 'id, novel_id, name, text, date, vote');
});

test('novel read cache: LRU keeps the most recent 8 entries', () => {
  clearNovelReadCache();
  for (let i = 1; i <= 9; i++) {
    writeNovelReadCache(String(i), novel(String(i)), []);
  }

  assert.equal(peekNovelReadCache('1'), null);
  assert.equal(peekNovelReadCache('2')?.novel.title, 'T');
  assert.equal(peekNovelReadCache('9')?.novel.id, '9');
});

test('novel read cache: peek refreshes recency', () => {
  clearNovelReadCache();
  for (let i = 1; i <= 8; i++) {
    writeNovelReadCache(String(i), novel(String(i)), []);
  }
  assert.ok(peekNovelReadCache('1'));
  writeNovelReadCache('9', novel('9'), []);

  assert.ok(peekNovelReadCache('1'));
  assert.equal(peekNovelReadCache('2'), null);
});

test('novel read cache: stores comments with the novel', () => {
  clearNovelReadCache();
  writeNovelReadCache('n1', novel('n1'), [
    { id: 'c1', novelId: 'n1', name: '', text: '感想', date: '2025-01-01T00:00:00+09:00', vote: 1 },
  ]);
  assert.equal(peekNovelReadCache('n1')?.comments[0].text, '感想');
});

test('novel read cache: evict removes a single entry', () => {
  clearNovelReadCache();
  writeNovelReadCache('n1', novel('n1'), []);
  writeNovelReadCache('n2', novel('n2'), []);

  evictNovelReadCache('n1');

  assert.equal(peekNovelReadCache('n1'), null);
  assert.equal(peekNovelReadCache('n2')?.novel.id, 'n2');
});
