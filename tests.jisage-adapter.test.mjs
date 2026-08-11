import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARI_NO_ANA_EXCLUDE_STARTS_WITH,
  formatReaderBody,
} from './services/jisageAdapter.ts';

test('reader mode none removes one-character manual indent markers', () => {
  const input = '　本文\n「会話」\n　既存の字下げ\n　　間を置く演出';
  const expected = '本文\n「会話」\n既存の字下げ\n　　間を置く演出';
  assert.equal(formatReaderBody(input, 'none'), expected);
});

test('single-indent cleanup preserves blank lines, BOM, line endings, and whitespace-only lines', () => {
  const input = '\uFEFF　本文\r\n\r\n　　間\r\n　';
  const expected = '\uFEFF本文\r\n\r\n　　間\r\n　';
  assert.equal(formatReaderBody(input, 'none'), expected);
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

test('jisage mode normalizes one-character markers before applying prose indentation', () => {
  const input = '　本文\n次の本文\n　「会話」\n　　間を置く演出';
  const expected = '　本文\n　次の本文\n「会話」\n　　間を置く演出';
  assert.equal(formatReaderBody(input, 'jisage'), expected);
});

test('two or more full-width spaces are preserved as author expression', () => {
  const input = '本文\n　　間を置く演出\n次の本文';
  const expected = '　本文\n　　間を置く演出\n　次の本文';
  assert.equal(formatReaderBody(input, 'jisage'), expected);
});

test('reader choice has final priority over the author preference', () => {
  const input = '本文\n次の本文';
  assert.equal(formatReaderBody(input, 'none', 'jisage'), input);
  assert.equal(formatReaderBody(input, 'author'), input);
  assert.equal(formatReaderBody(input, 'author', 'none'), input);
  assert.equal(formatReaderBody(input, 'author', 'raw'), input);
  assert.equal(formatReaderBody(input, 'author', 'jisage'), '　本文\n　次の本文');
});

test('author raw and none modes preserve manual source when reader follows author', () => {
  const input = '　本文';
  assert.equal(formatReaderBody(input, 'author', 'none'), input);
  assert.equal(formatReaderBody(input, 'author', 'raw'), input);
});

test('the application policy keeps the broad novel exclusions explicit', () => {
  assert.ok(ARI_NO_ANA_EXCLUDE_STARTS_WITH.includes('「'));
  assert.ok(ARI_NO_ANA_EXCLUDE_STARTS_WITH.includes('['));
  assert.ok(ARI_NO_ANA_EXCLUDE_STARTS_WITH.includes('《'));
});
