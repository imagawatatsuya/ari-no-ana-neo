import test from 'node:test';
import assert from 'node:assert/strict';

import { parseReaderIndentMode } from './services/readerPreferences.ts';

test('reader preference defaults to following the author', () => {
  assert.equal(parseReaderIndentMode(null), 'author');
  assert.equal(parseReaderIndentMode('not-json'), 'author');
  assert.equal(parseReaderIndentMode('{"indentMode":"unknown"}'), 'author');
});

test('reader preference accepts all three display modes', () => {
  assert.equal(parseReaderIndentMode('{"indentMode":"jisage"}'), 'jisage');
  assert.equal(parseReaderIndentMode('{"indentMode":"none"}'), 'none');
  assert.equal(parseReaderIndentMode('{"indentMode":"author"}'), 'author');
});
