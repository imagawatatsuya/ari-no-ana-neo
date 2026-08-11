import test from 'node:test';
import assert from 'node:assert/strict';

import {
  insertNovelWithAuthorIndentFallback,
  isMissingAuthorIndentColumnError,
} from './services/supabaseCompatibility.ts';

test('missing author indent column is detected from PostgREST schema-cache errors', () => {
  assert.equal(
    isMissingAuthorIndentColumnError({
      code: 'PGRST204',
      message: "Could not find the 'author_indent_mode' column of 'novels' in the schema cache",
    }),
    true,
  );
  assert.equal(
    isMissingAuthorIndentColumnError({
      message: 'column author_indent_mode does not exist',
    }),
    true,
  );
});

test('other Supabase errors are not retried as legacy inserts', () => {
  assert.equal(
    isMissingAuthorIndentColumnError({
      code: '23514',
      message: 'new row violates check constraint novels_author_indent_mode',
    }),
    false,
  );
  assert.equal(isMissingAuthorIndentColumnError(null), false);
});

test('legacy insert fallback removes only the metadata column and warns for jisage', async () => {
  const calls = [];
  const client = {
    insert(rows) {
      calls.push(rows[0]);
      return Promise.resolve(
        calls.length === 1
          ? {
              error: {
                code: 'PGRST204',
                message: "Could not find the 'author_indent_mode' column of 'novels' in the schema cache",
              },
            }
          : { error: null },
      );
    },
  };

  const result = await insertNovelWithAuthorIndentFallback(
    client,
    { id: '1', body: '本文', author_indent_mode: 'jisage' },
    'jisage',
  );

  assert.equal(result.error, null);
  assert.match(result.notice, /未対応/);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].author_indent_mode, 'jisage');
  assert.equal('author_indent_mode' in calls[1], false);
  assert.equal(calls[1].body, '本文');
});
