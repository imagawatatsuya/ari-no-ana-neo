import { jisage } from 'jisage-core';
import type { ReaderIndentMode } from '../types';

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
export const formatReaderBody = (body: string, mode: ReaderIndentMode): string => {
  if (mode === 'none') return body;

  return jisage(body, {
    indent: '　',
    excludeStartsWith: ARI_NO_ANA_EXCLUDE_STARTS_WITH,
  });
};
