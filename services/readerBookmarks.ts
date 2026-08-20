export const READER_BOOKMARKS_STORAGE_KEY = 'bunsho_reader_bookmarks_v1';

export interface ReaderBookmark {
  novelId: string;
  fragmentIndex: number;
  savedAt: string;
}

export type ReaderBookmarks = Record<string, ReaderBookmark>;

const normalizeNovelId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const normalizeFragmentIndex = (value: unknown): number | null => {
  const normalized = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1) return null;
  return normalized;
};

const normalizeBookmarkRecord = (
  value: unknown,
  novelId: string,
): ReaderBookmark | null => {
  if (!value || typeof value !== 'object') return null;

  const record = value as Partial<ReaderBookmark>;
  const recordNovelId = normalizeNovelId(record.novelId);
  const fragmentIndex = normalizeFragmentIndex(record.fragmentIndex);
  if (recordNovelId !== novelId || fragmentIndex === null) return null;

  return {
    novelId,
    fragmentIndex,
    savedAt: typeof record.savedAt === 'string' ? record.savedAt : '',
  };
};

export const parseReaderBookmarks = (raw: string | null): ReaderBookmarks => {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const bookmarks: ReaderBookmarks = {};
    for (const [key, value] of Object.entries(parsed)) {
      const novelId = normalizeNovelId(key);
      if (!novelId) continue;

      const bookmark = normalizeBookmarkRecord(value, novelId);
      if (bookmark) {
        bookmarks[novelId] = bookmark;
      }
    }
    return bookmarks;
  } catch {
    return {};
  }
};

export const updateReaderBookmarks = (
  bookmarks: ReaderBookmarks,
  novelId: string,
  fragmentIndex: number | null,
  savedAt = new Date().toISOString(),
): ReaderBookmarks => {
  const normalizedNovelId = normalizeNovelId(novelId);
  if (!normalizedNovelId) return bookmarks;

  const next = { ...bookmarks };
  if (fragmentIndex === null) {
    delete next[normalizedNovelId];
    return next;
  }

  const normalizedFragmentIndex = normalizeFragmentIndex(fragmentIndex);
  if (normalizedFragmentIndex === null) return bookmarks;

  next[normalizedNovelId] = {
    novelId: normalizedNovelId,
    fragmentIndex: normalizedFragmentIndex,
    savedAt,
  };
  return next;
};

export const loadReaderBookmark = (novelId: string): ReaderBookmark | null => {
  const normalizedNovelId = normalizeNovelId(novelId);
  if (!normalizedNovelId || typeof window === 'undefined') return null;

  try {
    const bookmarks = parseReaderBookmarks(
      window.localStorage.getItem(READER_BOOKMARKS_STORAGE_KEY),
    );
    return bookmarks[normalizedNovelId] ?? null;
  } catch {
    return null;
  }
};

export const saveReaderBookmark = (
  novelId: string,
  fragmentIndex: number | null,
): void => {
  const normalizedNovelId = normalizeNovelId(novelId);
  if (!normalizedNovelId || typeof window === 'undefined') return;

  try {
    const current = parseReaderBookmarks(
      window.localStorage.getItem(READER_BOOKMARKS_STORAGE_KEY),
    );
    const next = updateReaderBookmarks(current, normalizedNovelId, fragmentIndex);
    window.localStorage.setItem(READER_BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing or storage restrictions should not block reading.
  }
};
