import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARI_NO_ANA_EXCLUDE_STARTS_WITH,
  formatReaderBody,
} from './services/jisageAdapter.ts';

test('reader mode none returns the submitted text unchanged', () => {
  const input = '本文\n「会話」\n　既存の字下げ';
  assert.equal(formatReaderBody(input, 'none'), input);
});

test('jisage mode indents eligible lines and leaves dialogue lines unchanged', () => {
  const input = '本文\n「会話」\n次の本文';
  const expected = '　本文\n「会話」\n　次の本文';
  assert.equal(formatReaderBody(input, 'jisage'), expected);
});

test('jisage mode preserves blank lines, existing indentation, and line endings', () => {
  const input = '本文\r\n\r\n　既存\r\n「会話」\r\n次';
  const expected = '　本文\r\n\r\n　既存\r\n「会話」\r\n　次';
  assert.equal(formatReaderBody(input, 'jisage'), expected);
});

test('the application policy keeps the broad novel exclusions explicit', () => {
  assert.ok(ARI_NO_ANA_EXCLUDE_STARTS_WITH.includes('「'));
  assert.ok(ARI_NO_ANA_EXCLUDE_STARTS_WITH.includes('['));
  assert.ok(ARI_NO_ANA_EXCLUDE_STARTS_WITH.includes('《'));
});
