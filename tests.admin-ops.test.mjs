import test from 'node:test';
import assert from 'node:assert/strict';

import { editNovelInList, deleteNovelAndComments, toggleHiddenNovelId } from './adminOps.ts';
import { SEED_NOVELS, SEED_COMMENTS } from './seedData.ts';

test('admin edit operation updates target novel only', () => {
  const targetId = '1';
  const updated = editNovelInList(SEED_NOVELS, targetId, {
    title: '編集後タイトル',
    author: '管理人',
    trip: '◆ADMIN',
    body: '編集後本文',
  });

  const target = updated.find((n) => n.id === targetId);
  assert.ok(target);
  assert.equal(target.title, '編集後タイトル');
  assert.equal(target.author, '管理人');
  assert.equal(target.trip, '◆ADMIN');
  assert.equal(target.body, '編集後本文');
  assert.equal(updated.length, SEED_NOVELS.length);
});

test('admin delete operation removes novel and related comments', () => {
  const targetId = '1';
  const result = deleteNovelAndComments(SEED_NOVELS, SEED_COMMENTS, targetId);

  assert.equal(result.novels.some((n) => n.id === targetId), false);
  assert.equal(result.comments.some((c) => c.novelId === targetId), false);
  assert.equal(result.novels.length, SEED_NOVELS.length - 1);
});

test('admin hide operation toggles hidden id set idempotently', () => {
  const id = '2';
  const hidden = toggleHiddenNovelId([], id, true);
  assert.deepEqual(hidden, [id]);

  const hiddenTwice = toggleHiddenNovelId(hidden, id, true);
  assert.deepEqual(hiddenTwice, [id]);

  const shown = toggleHiddenNovelId(hiddenTwice, id, false);
  assert.equal(shown.includes(id), false);
});
