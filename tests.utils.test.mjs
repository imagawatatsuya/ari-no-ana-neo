import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDate, generateTrip, calculateScore, countManuscriptPages, formatManuscriptPages } from './utils.ts';

test('generateTrip: empty input falls back to 名無し', () => {
  const result = generateTrip('');
  assert.equal(result.name, '名無し');
  assert.equal(result.trip, undefined);
});

test('generateTrip: creates deterministic trip with #password', () => {
  const a = generateTrip('太郎#secret');
  const b = generateTrip('太郎#secret');
  assert.equal(a.name, '太郎');
  assert.ok(a.trip?.startsWith('◆'));
  assert.equal(a.trip, b.trip);
});

test('calculateScore: sums and averages votes', () => {
  const result = calculateScore([{ vote: 2 }, { vote: -1 }, { vote: 1 }]);
  assert.deepEqual(result, { total: 2, count: 3, avg: 2 / 3 });
});

test('calculateScore: empty comments return zeros', () => {
  assert.deepEqual(calculateScore([]), { total: 0, count: 0, avg: 0 });
});

test('formatDate: renders Japanese-style date format', () => {
  const text = formatDate('2025-01-02T03:04:00+09:00');
  assert.match(text, /^\d{4}\/\d{2}\/\d{2}\([日月火水木金土]\) \d{2}:\d{2}$/);
});

test('countManuscriptPages: empty text returns 0', () => {
  assert.equal(countManuscriptPages(''), 0);
  assert.equal(countManuscriptPages('   '), 0);
});

test('countManuscriptPages: 400 chars single line = 1 page', () => {
  const text = 'あ'.repeat(400);
  assert.equal(countManuscriptPages(text), 1);
});

test('countManuscriptPages: 401 chars = 2 pages', () => {
  const text = 'あ'.repeat(401);
  assert.equal(countManuscriptPages(text), 2);
});

test('countManuscriptPages: line breaks consume remaining cells', () => {
  // 10 chars + newline + 10 chars = 2 lines × 20 cells = 40 cells → 1 page
  const text = 'あ'.repeat(10) + '\n' + 'あ'.repeat(10);
  assert.equal(countManuscriptPages(text), 1);
  // 20 lines of 10 chars each = 20 × 20 = 400 cells → 1 page
  const text2 = Array(20).fill('あ'.repeat(10)).join('\n');
  assert.equal(countManuscriptPages(text2), 1);
  // 21 lines of 10 chars each = 21 × 20 = 420 cells → 2 pages
  const text3 = Array(21).fill('あ'.repeat(10)).join('\n');
  assert.equal(countManuscriptPages(text3), 2);
});

test('countManuscriptPages: empty lines count as 1 line', () => {
  // 19 lines of 20 chars + 1 empty line = 19×20 + 20 = 400 → 1 page
  const text = Array(19).fill('あ'.repeat(20)).join('\n') + '\n';
  assert.equal(countManuscriptPages(text), 1);
});

test('formatManuscriptPages: empty text returns empty string', () => {
  assert.equal(formatManuscriptPages(''), '');
  assert.equal(formatManuscriptPages('   '), '');
});

test('formatManuscriptPages: short text shows 1枚未満', () => {
  // 10 chars = 20 cells < 400 → 1枚未満
  const text = 'あ'.repeat(10);
  assert.equal(formatManuscriptPages(text), '1枚未満');
});

test('formatManuscriptPages: exactly 400 cells shows 【1 枚】', () => {
  const text = 'あ'.repeat(400);
  assert.equal(formatManuscriptPages(text), '【1 枚】');
});

test('formatManuscriptPages: normal text shows 【N 枚】', () => {
  const text = 'あ'.repeat(800);
  assert.equal(formatManuscriptPages(text), '【2 枚】');
});
