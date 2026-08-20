import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadReaderBookmark,
  parseReaderBookmarks,
  saveReaderBookmark,
  updateReaderBookmarks,
} from './services/readerBookmarks.ts';

test('reader bookmarks ignore empty, malformed, and inconsistent records', () => {
  const bookmarks = parseReaderBookmarks(JSON.stringify({
    'novel-1': {
      novelId: 'novel-1',
      fragmentIndex: 3,
      savedAt: '2026-08-21T00:00:00.000Z',
    },
    'novel-2': {
      novelId: 'other-novel',
      fragmentIndex: 4,
      savedAt: '2026-08-21T00:00:00.000Z',
    },
    'novel-3': {
      novelId: 'novel-3',
      fragmentIndex: 0,
      savedAt: '2026-08-21T00:00:00.000Z',
    },
  }));

  assert.deepEqual(bookmarks, {
    'novel-1': {
      novelId: 'novel-1',
      fragmentIndex: 3,
      savedAt: '2026-08-21T00:00:00.000Z',
    },
  });
  assert.deepEqual(parseReaderBookmarks(null), {});
  assert.deepEqual(parseReaderBookmarks('not-json'), {});
});

test('reader bookmarks keep one record per novel and replace or remove it', () => {
  let bookmarks = {};
  bookmarks = updateReaderBookmarks(bookmarks, 'novel-1', 2, 'first');
  bookmarks = updateReaderBookmarks(bookmarks, 'novel-2', 7, 'other');
  bookmarks = updateReaderBookmarks(bookmarks, 'novel-1', 5, 'replacement');

  assert.deepEqual(bookmarks, {
    'novel-1': {
      novelId: 'novel-1',
      fragmentIndex: 5,
      savedAt: 'replacement',
    },
    'novel-2': {
      novelId: 'novel-2',
      fragmentIndex: 7,
      savedAt: 'other',
    },
  });

  bookmarks = updateReaderBookmarks(bookmarks, 'novel-1', null, 'removed');
  assert.deepEqual(bookmarks, {
    'novel-2': {
      novelId: 'novel-2',
      fragmentIndex: 7,
      savedAt: 'other',
    },
  });
});

test('reader bookmark storage persists and reloads the selected fragment', () => {
  const originalWindow = globalThis.window;
  const storage = new Map();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
    },
  });

  try {
    saveReaderBookmark('novel-1', 4);
    saveReaderBookmark('novel-1', 9);
    saveReaderBookmark('novel-2', 2);

    assert.equal(loadReaderBookmark('novel-1')?.fragmentIndex, 9);
    assert.equal(loadReaderBookmark('novel-2')?.fragmentIndex, 2);

    saveReaderBookmark('novel-1', null);
    assert.equal(loadReaderBookmark('novel-1'), null);
  } finally {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});
