import test from 'node:test';
import assert from 'node:assert/strict';

// Node テスト環境用 localStorage モック
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

import { formatStarRatingFromAggregate } from './utils.ts';
import { readNovelListCache, writeNovelListCache } from './lib/cache/novelListCache.ts';
import { readPostDraft, writePostDraft, clearPostDraft } from './lib/draftStorage.ts';
import { novelsToSummaries } from './features/novels/novelSummaries.ts';
import { LIST_NOVEL_COLUMNS, LIST_COMMENT_COLUMNS } from './features/novels/novelSummaries.ts';

test('formatStarRatingFromAggregate: empty comments', () => {
  const result = formatStarRatingFromAggregate(0, 0);
  assert.equal(result.stars, '☆☆☆☆☆');
  assert.equal(result.score, '(0/0)');
});

test('formatStarRatingFromAggregate: positive average', () => {
  const result = formatStarRatingFromAggregate(3, 2);
  assert.match(result.score, /^\(3\/2\)$/);
  assert.ok(result.stars.includes('★'));
});

test('novel list query columns exclude body and comment text', () => {
  assert.ok(!LIST_NOVEL_COLUMNS.includes('body'));
  assert.ok(!LIST_NOVEL_COLUMNS.includes('description'));
  assert.equal(LIST_COMMENT_COLUMNS, 'novel_id, vote');
});

test('novelsToSummaries: aggregates comment votes per novel', () => {
  const summaries = novelsToSummaries(
    [
      {
        id: '1',
        title: 'A',
        author: '作者',
        body: '本文',
        date: '2025-01-01T00:00:00+09:00',
        viewCount: 1,
        commentCount: 0,
        voteSum: 0,
      },
    ],
    [
      { id: 'c1', novelId: '1', name: '', text: 't', date: '2025-01-01T00:00:00+09:00', vote: 2 },
      { id: 'c2', novelId: '1', name: '', text: 't', date: '2025-01-01T00:00:00+09:00', vote: -1 },
    ],
  );
  assert.equal(summaries[0].commentCount, 2);
  assert.equal(summaries[0].voteSum, 1);
});

test('novel list cache: round-trip and param isolation', () => {
  storage.clear();
  const paramsA = { page: 1, search: '', isRyuseigai: false };
  const paramsB = { page: 2, search: 'test', isRyuseigai: false };
  const item = {
    id: '1',
    title: 'T',
    author: 'A',
    date: '2025-01-01T00:00:00+09:00',
    viewCount: 0,
    commentCount: 0,
    voteSum: 0,
  };

  writeNovelListCache(paramsA, [item], 1);
  const cachedA = readNovelListCache(paramsA);
  const cachedB = readNovelListCache(paramsB);

  assert.ok(cachedA);
  assert.equal(cachedA?.items[0].title, 'T');
  assert.equal(cachedB, null);
});

test('novel list cache: invalid JSON is ignored', () => {
  storage.clear();
  localStorage.setItem('ari_novel_list_cache_v1', '{invalid');
  const cached = readNovelListCache({ page: 1, search: '', isRyuseigai: false });
  assert.equal(cached, null);
});

test('post draft: save, read, clear', () => {
  storage.clear();
  writePostDraft({ title: 't', description: 'd', name: 'n', body: 'b' });
  const draft = readPostDraft();
  assert.deepEqual(draft, { title: 't', description: 'd', name: 'n', body: 'b' });
  clearPostDraft();
  assert.equal(readPostDraft(), null);
});
