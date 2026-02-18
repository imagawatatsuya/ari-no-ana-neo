import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDate, generateTrip, calculateScore } from './utils.ts';

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
