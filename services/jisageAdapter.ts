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

  if (effectiveMode === 'none') return body;

  return jisage(body, {
    indent: '　',
    excludeStartsWith: ARI_NO_ANA_EXCLUDE_STARTS_WITH,
  });
};
