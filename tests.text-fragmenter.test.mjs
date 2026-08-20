import test from 'node:test';
import assert from 'node:assert/strict';

import { fragmentText } from './lib/textFragmenter.ts';

const textFragments = (text, options) =>
  fragmentText(text, options).filter((fragment) => fragment.type === 'fragment');

test('text fragmenter prefers sentence endings in the 60 to 160 character range', () => {
  const source = `${'あ'.repeat(70)}。${'い'.repeat(70)}。${'う'.repeat(70)}。`;
  const fragments = textFragments(source);

  assert.deepEqual(fragments.map((fragment) => fragment.text), [
    `${'あ'.repeat(70)}。${'い'.repeat(70)}。`,
    `${'う'.repeat(70)}。`,
  ]);
  assert.ok(fragments[0].charCount >= 60);
  assert.ok(fragments[0].charCount <= 160);
});

test('text fragmenter never exceeds the hard limit for ordinary text', () => {
  const fragments = textFragments('あ'.repeat(700));

  assert.ok(fragments.length > 3);
  assert.ok(fragments.every((fragment) => fragment.charCount <= 220));
});

test('text fragmenter keeps paragraph boundaries as break records', () => {
  const fragments = fragmentText(`第一段落。${'あ'.repeat(70)}\n\n第二段落。${'い'.repeat(70)}`);

  assert.equal(fragments.filter((fragment) => fragment.type === 'break').length, 1);
  assert.equal(fragments.find((fragment) => fragment.type === 'break')?.breakCount, 2);
});

test('text fragmenter preserves reader-facing indentation and spaces', () => {
  const source = `　${'本文 '.repeat(80)}`;
  const fragments = textFragments(source);

  assert.ok(fragments[0].text.startsWith('　'));
  assert.equal(fragments.map((fragment) => fragment.text).join(''), source);
});

test('text fragmenter keeps a tied line break with the previous fragment', () => {
  const source = `${'あ'.repeat(159)}。\n${'い'.repeat(80)}`;
  const fragments = textFragments(source);

  assert.ok(fragments[0].text.endsWith('。\n'));
  assert.ok(!fragments[1].text.startsWith('\n'));
  assert.equal(fragments.map((fragment) => fragment.text).join(''), source);
});

test('text fragmenter moves leading punctuation to the previous fragment', () => {
  const fragments = textFragments(`${'あ'.repeat(160)}。続き`, {
    targetMin: 60,
    targetMax: 160,
    hardMax: 220,
  });

  assert.ok(fragments[0].text.endsWith('。'));
  assert.ok(!fragments[1].text.startsWith('。'));
});

test('text fragmenter keeps footnote references intact', () => {
  const source = `${'あ'.repeat(158)}[^note-1]${'い'.repeat(80)}。`;
  const fragments = textFragments(source);

  assert.equal(fragments.filter((fragment) => fragment.text.includes('[^note-1]')).length, 1);
  assert.equal(fragments.map((fragment) => fragment.text).join(''), source);
});

test('text fragmenter keeps a protected URL intact even when it exceeds the hard limit', () => {
  const url = `https://example.com/${'a'.repeat(230)}`;
  const fragments = textFragments(url);

  assert.equal(fragments.length, 1);
  assert.equal(fragments[0].text, url);
});

test('text fragmenter handles empty input and produces deterministic output', () => {
  assert.deepEqual(fragmentText(' \n\n '), []);
  const source = `${'本文です。'.repeat(80)}\n\n終わり。`;
  assert.deepEqual(fragmentText(source), fragmentText(source));
});
