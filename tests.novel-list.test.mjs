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
import { readNovelListCache, writeNovelListCache, novelListParamsKey } from './lib/cache/novelListCache.ts';
import { readPostDraft, writePostDraft, clearPostDraft } from './lib/draftStorage.ts';
import { novelsToSummaries, LIST_NOVEL_COLUMNS, LIST_COMMENT_COLUMNS } from './features/novels/novelSummaries.ts';

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

test('novel list cache: keeps multiple parameter sets', () => {
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
  writeNovelListCache(paramsB, [{ ...item, id: '2', title: 'S' }], 2);
  const cachedA = readNovelListCache(paramsA);
  const cachedB = readNovelListCache(paramsB);

  assert.ok(cachedA);
  assert.equal(cachedA?.items[0].title, 'T');
  assert.equal(cachedB?.items[0].title, 'S');
  assert.equal(cachedB?.totalCount, 2);
});

test('novel list cache: migrates the previous single-entry format', () => {
  storage.clear();
  localStorage.setItem('ari_novel_list_cache_v1', JSON.stringify({
    schemaVersion: 1,
    fetchedAt: Date.now(),
    page: 1,
    search: '',
    isRyuseigai: false,
    items: [{
      id: 'legacy',
      title: '旧キャッシュ',
      author: '作者',
      date: '2025-01-01T00:00:00+09:00',
      viewCount: 0,
      commentCount: 0,
      voteSum: 0,
    }],
    totalCount: 1,
  }));

  const cached = readNovelListCache({ page: 1, search: '', isRyuseigai: false, pageSize: 20 });
  assert.equal(cached?.items[0].title, '旧キャッシュ');
});

test('novel list cache: bounds the number of stored parameter sets', () => {
  storage.clear();
  const item = {
    id: '1',
    title: 'T',
    author: 'A',
    date: '2025-01-01T00:00:00+09:00',
    viewCount: 0,
    commentCount: 0,
    voteSum: 0,
  };

  for (let page = 1; page <= 25; page += 1) {
    writeNovelListCache({ page, search: '', isRyuseigai: false }, [item], 25);
  }

  const stored = JSON.parse(localStorage.getItem('ari_novel_list_cache_v1'));
  assert.equal(Object.keys(stored.entries).length, 20);
});

test('novel list cache: invalid JSON is ignored', () => {
  storage.clear();
  localStorage.setItem('ari_novel_list_cache_v1', '{invalid');
  const cached = readNovelListCache({ page: 1, search: '', isRyuseigai: false });
  assert.equal(cached, null);
});

test('novelListParamsKey: isolates page, search, list type, and page size', () => {
  const page1 = novelListParamsKey({ page: 1, search: '', isRyuseigai: false });
  const page2 = novelListParamsKey({ page: 2, search: '', isRyuseigai: false });
  const search = novelListParamsKey({ page: 1, search: 'test', isRyuseigai: false });
  const ryuseigai = novelListParamsKey({ page: 1, search: '', isRyuseigai: true });
  const largerPage = novelListParamsKey({ page: 1, search: '', isRyuseigai: false, pageSize: 100 });
  assert.notEqual(page1, page2);
  assert.notEqual(page1, search);
  assert.notEqual(page1, ryuseigai);
  assert.notEqual(page1, largerPage);
});

test('post draft: save, read, clear', () => {
  storage.clear();
  writePostDraft({ title: 't', description: 'd', authorMessage: 'm', name: 'n', body: 'b', authorIndentMode: 'jisage' });
  const draft = readPostDraft();
  assert.deepEqual(draft, { title: 't', description: 'd', authorMessage: 'm', name: 'n', body: 'b', authorIndentMode: 'jisage' });
  clearPostDraft();
  assert.equal(readPostDraft(), null);
});

test('post draft: legacy draft without author message remains readable', () => {
  storage.clear();
  localStorage.setItem('ari_post_draft_v1', JSON.stringify({
    title: 'legacy',
    description: '旧副題',
    name: 'n',
    body: 'b',
    authorIndentMode: 'none',
  }));

  const draft = readPostDraft();
  assert.equal(draft?.description, '旧副題');
  assert.equal(draft?.authorMessage, '');
  clearPostDraft();
});
