import { jisage } from 'jisage-core';
import type { AuthorIndentMode, ReaderIndentMode } from '../types';

/**
 * Application-owned policy for which line openings are treated as dialogue,
 * brackets, or other non-prose starts. Keeping this list here prevents an
 * upstream jisage-core update from silently changing the site's typography.
 */
export const ARI_NO_ANA_EXCLUDE_STARTS_WITH = Object.freeze([
  '「',
  '『',
  '〖',
  '〈',
  '《',
  '（',
  '(',
  '“',
  '"',
  '‘',
  "'",
  '［',
  '[',
  '〔',
  '｛',
  '{',
  '＜',
  '<',
]);

const FULL_WIDTH_INDENT = '　';

/**
 * Treat exactly one leading full-width space as the conventional one-character
 * indent marker in a reader-facing copy. Two or more spaces may be deliberate
 * composition, so they are left untouched. Newline conventions and a BOM are
 * preserved exactly.
 */
export const stripSingleFullWidthIndent = (body: string): string => {
  const parts = body.split(/(\r\n|\n|\r)/);

  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i];
    const hasBom = i === 0 && line.startsWith('\uFEFF');
    const bom = hasBom ? '\uFEFF' : '';
    const content = hasBom ? line.slice(1) : line;

    if (!content.startsWith(FULL_WIDTH_INDENT)) continue;
    if (content.startsWith(FULL_WIDTH_INDENT + FULL_WIDTH_INDENT)) continue;
    if (content.slice(FULL_WIDTH_INDENT.length).trim().length === 0) continue;

    parts[i] = `${bom}${content.slice(FULL_WIDTH_INDENT.length)}`;
  }

  return parts.join('');
};

/**
 * Format only the reader-facing copy. Novel.body must remain the original
 * submitted text so that counts, persistence, and later re-rendering are
 * independent of a reader's preference.
 */
export const formatReaderBody = (
  body: string,
  mode: ReaderIndentMode,
  authorIndentMode: AuthorIndentMode = 'raw',
): string => {
  // Reader choice is final. The author setting is consulted only when the
  // reader explicitly chooses "author"; legacy/malformed values stay raw.
  const effectiveMode = mode === 'author'
    ? (authorIndentMode === 'jisage' ? 'jisage' : 'none')
    : mode;

  // An explicit reader choice of "none" removes only the conventional
  // one-character marker. When the reader follows a raw/none author setting,
  // preserve that author's source exactly instead.
  const shouldNormalizeSingleIndent = mode === 'none' || effectiveMode === 'jisage';
  const normalizedBody = shouldNormalizeSingleIndent
    ? stripSingleFullWidthIndent(body)
    : body;

  if (effectiveMode === 'none') return normalizedBody;

  return jisage(normalizedBody, {
    indent: '　',
    excludeStartsWith: ARI_NO_ANA_EXCLUDE_STARTS_WITH,
  });
};
