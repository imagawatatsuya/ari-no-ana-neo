import test from 'node:test';
import assert from 'node:assert/strict';

import { parseReaderIndentMode } from './services/readerPreferences.ts';

test('reader preference defaults to no automatic indentation', () => {
  assert.equal(parseReaderIndentMode(null), 'none');
  assert.equal(parseReaderIndentMode('not-json'), 'none');
  assert.equal(parseReaderIndentMode('{"indentMode":"unknown"}'), 'none');
});

test('reader preference accepts only the supported jisage mode', () => {
  assert.equal(parseReaderIndentMode('{"indentMode":"jisage"}'), 'jisage');
  assert.equal(parseReaderIndentMode('{"indentMode":"none"}'), 'none');
});
