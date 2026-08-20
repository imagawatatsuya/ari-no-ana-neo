export interface TextFragmenterOptions {
  targetMin?: number;
  targetMax?: number;
  hardMax?: number;
}

export type TextFragment =
  | { type: 'fragment'; text: string; charCount: number }
  | { type: 'break'; breakCount: number };

type Unit = {
  text: string;
  length: number;
  protected: boolean;
};

type Candidate = {
  index: number;
  length: number;
  score: number;
};

const DEFAULT_TARGET_MIN = 60;
const DEFAULT_TARGET_MAX = 160;
const DEFAULT_HARD_MAX = 220;
const PROTECTED_TOKEN_PATTERN = /(\[\^[^\]\r\n]+\]|https:\/\/[^\s<>"']+)/gu;
const LEADING_PUNCTUATION_PATTERN = /^[、。，．・：；？！!?）」』】〕〉》]/u;

const splitGraphemes = (text: string): string[] =>
  text.match(/\P{Mark}\p{Mark}*|\p{Mark}+/gu) ?? [];

const normalizeOptions = (options: TextFragmenterOptions = {}) => {
  const targetMin = Math.max(1, Math.floor(options.targetMin ?? DEFAULT_TARGET_MIN));
  const targetMax = Math.max(targetMin, Math.floor(options.targetMax ?? DEFAULT_TARGET_MAX));
  const hardMax = Math.max(targetMax, Math.floor(options.hardMax ?? DEFAULT_HARD_MAX));
  return { targetMin, targetMax, hardMax };
};

const tokenize = (text: string): Unit[] => {
  const units: Unit[] = [];
  let lastIndex = 0;

  const pushPlainText = (value: string) => {
    for (const grapheme of splitGraphemes(value)) {
      units.push({
        text: grapheme,
        length: /\s/u.test(grapheme) ? 0 : 1,
        protected: false,
      });
    }
  };

  for (const match of text.matchAll(PROTECTED_TOKEN_PATTERN)) {
    const matchIndex = match.index ?? 0;
    pushPlainText(text.slice(lastIndex, matchIndex));
    const token = match[0];
    units.push({
      text: token,
      length: token.startsWith('[^') ? 1 : splitGraphemes(token).length,
      protected: true,
    });
    lastIndex = matchIndex + token.length;
  }
  pushPlainText(text.slice(lastIndex));
  return units;
};

const breakpointScore = (unit: Unit): number => {
  if (unit.text.includes('\n')) return 5;
  if (/[。！？!?]$/u.test(unit.text)) return 4;
  if (/[」』）)\]】〕〉》]$/u.test(unit.text)) return 3;
  if (/[、，,]$/u.test(unit.text)) return 2;
  return 1;
};

const collectCandidates = (units: Unit[], hardMax: number): Candidate[] => {
  const candidates: Candidate[] = [];
  let length = 0;

  for (let index = 0; index < units.length; index += 1) {
    length += units[index].length;
    if (length > hardMax) break;
    candidates.push({ index, length, score: breakpointScore(units[index]) });
  }

  return candidates;
};

const bestCandidate = (
  candidates: Candidate[],
  targetMax: number,
  minimumScore: number,
): Candidate | null => {
  const eligible = candidates.filter((candidate) => candidate.score >= minimumScore);
  if (eligible.length === 0) return null;

  return eligible.reduce((best, current) => {
    const bestDistance = Math.abs(targetMax - best.length);
    const currentDistance = Math.abs(targetMax - current.length);
    if (currentDistance !== bestDistance) {
      return currentDistance < bestDistance ? current : best;
    }
    return current.length > best.length ? current : best;
  });
};

const pickBreakpoint = (
  units: Unit[],
  targetMin: number,
  targetMax: number,
  hardMax: number,
): number => {
  const candidates = collectCandidates(units, hardMax);

  if (candidates.length === 0) {
    // An indivisible footnote reference or URL is safer kept whole than broken.
    return 0;
  }

  const inTargetRange = candidates.filter(
    (candidate) => candidate.length >= targetMin && candidate.length <= targetMax,
  );
  return (
    bestCandidate(inTargetRange, targetMax, 4)
    ?? bestCandidate(inTargetRange, targetMax, 2)
    ?? bestCandidate(candidates.filter((candidate) => candidate.length >= targetMin), targetMax, 4)
    ?? bestCandidate(candidates.filter((candidate) => candidate.length >= targetMin), targetMax, 1)
    ?? candidates[candidates.length - 1]
  ).index;
};

const visibleLength = (units: Unit[]): number =>
  units.reduce((total, unit) => total + unit.length, 0);

const splitTextBlock = (
  text: string,
  targetMin: number,
  targetMax: number,
  hardMax: number,
): Extract<TextFragment, { type: 'fragment' }>[] => {
  const units = tokenize(text);
  const fragments: Extract<TextFragment, { type: 'fragment' }>[] = [];
  let startIndex = 0;

  while (startIndex < units.length) {
    const remaining = units.slice(startIndex);
    const remainingLength = visibleLength(remaining);
    const breakpoint = remainingLength <= targetMax
      ? remaining.length - 1
      : pickBreakpoint(remaining, targetMin, targetMax, hardMax);
    const selected = remaining.slice(0, breakpoint + 1);
    const fragmentText = selected.map((unit) => unit.text).join('');

    if (fragmentText.trim()) {
      fragments.push({
        type: 'fragment',
        text: fragmentText,
        charCount: visibleLength(selected),
      });
    }
    startIndex += Math.max(1, selected.length);
  }

  return fragments;
};

const rebalanceLeadingPunctuation = (
  fragments: Extract<TextFragment, { type: 'fragment' }>[],
): void => {
  for (let index = 1; index < fragments.length; index += 1) {
    while (LEADING_PUNCTUATION_PATTERN.test(fragments[index].text)) {
      const punctuation = fragments[index].text[0];
      fragments[index - 1].text += punctuation;
      fragments[index - 1].charCount += 1;
      fragments[index].text = fragments[index].text.slice(1).trimStart();
      fragments[index].charCount = Math.max(0, fragments[index].charCount - 1);
    }
  }
};

export const fragmentText = (
  input: string,
  options: TextFragmenterOptions = {},
): TextFragment[] => {
  const text = String(input ?? '')
    .replace(/\r\n/gu, '\n')
    .replace(/\r/gu, '\n')
    .replace(/^\n+|\n+$/gu, '');
  if (!text.trim()) return [];

  const { targetMin, targetMax, hardMax } = normalizeOptions(options);
  const parts = text.split(/(\n{2,})/gu);
  const result: TextFragment[] = [];

  for (const part of parts) {
    if (!part) continue;
    if (/^\n{2,}$/u.test(part)) {
      if (result.length > 0 && result[result.length - 1]?.type !== 'break') {
        result.push({ type: 'break', breakCount: part.length });
      }
      continue;
    }

    const fragments = splitTextBlock(part, targetMin, targetMax, hardMax);
    rebalanceLeadingPunctuation(fragments);
    result.push(...fragments.filter((fragment) => fragment.text.length > 0));
  }

  while (result[result.length - 1]?.type === 'break') result.pop();
  return result;
};
