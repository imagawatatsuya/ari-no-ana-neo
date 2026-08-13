import type { ReaderIndentMode } from '../types';

export const READER_PREFERENCES_STORAGE_KEY = 'bunsho_reader_preferences_v1';

const DEFAULT_READER_INDENT_MODE: ReaderIndentMode = 'none';

export interface ReaderPreferences {
  indentMode: ReaderIndentMode;
}

export const parseReaderIndentMode = (raw: string | null): ReaderIndentMode => {
  if (!raw) return DEFAULT_READER_INDENT_MODE;

  try {
    const parsed = JSON.parse(raw) as Partial<ReaderPreferences>;
    if (parsed.indentMode === 'jisage' || parsed.indentMode === 'author') {
      return parsed.indentMode;
    }
    return DEFAULT_READER_INDENT_MODE;
  } catch {
    return DEFAULT_READER_INDENT_MODE;
  }
};

export const loadReaderIndentMode = (): ReaderIndentMode => {
  if (typeof window === 'undefined') return DEFAULT_READER_INDENT_MODE;

  try {
    return parseReaderIndentMode(window.localStorage.getItem(READER_PREFERENCES_STORAGE_KEY));
  } catch {
    return DEFAULT_READER_INDENT_MODE;
  }
};

export const saveReaderIndentMode = (indentMode: ReaderIndentMode): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      READER_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ indentMode } satisfies ReaderPreferences),
    );
  } catch {
    // Private browsing or storage restrictions should not block reading.
  }
};
