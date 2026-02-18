import test from 'node:test';
import assert from 'node:assert/strict';

import { SEED_NOVELS, SEED_COMMENTS } from './seedData.ts';

test('seed novels: should contain 5 dummy novels for realistic manual test coverage', () => {
  assert.equal(SEED_NOVELS.length, 5);

  const ids = SEED_NOVELS.map((n) => n.id);
  assert.equal(new Set(ids).size, SEED_NOVELS.length, 'novel ids must be unique');

  for (const novel of SEED_NOVELS) {
    assert.ok(novel.title.trim().length > 0, 'title should not be empty');
    assert.ok(novel.author.trim().length > 0, 'author should not be empty');
    assert.ok(novel.body.trim().length > 0, 'body should not be empty');
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(novel.date), 'date should be ISO-like format');
    assert.ok(Number.isInteger(novel.viewCount) && novel.viewCount >= 0, 'viewCount should be non-negative integer');
  }
});

test('seed comments: every comment should reference an existing seed novel', () => {
  const novelIds = new Set(SEED_NOVELS.map((n) => n.id));
  assert.ok(SEED_COMMENTS.length >= 5, 'seed comments should be enough for score/comment test scenarios');

  for (const comment of SEED_COMMENTS) {
    assert.ok(novelIds.has(comment.novelId), `comment ${comment.id} references unknown novelId`);
    assert.ok(comment.text.trim().length > 0, 'comment text should not be empty');
    assert.ok(comment.vote >= -2 && comment.vote <= 2, 'vote should be between -2 and 2');
  }
});
