import type { NovelSummary } from '../../types';
import type { NovelListQueryParams } from '../../services/supabase/novelQueries';

const CACHE_KEY = 'ari_novel_list_cache_v1';
const SCHEMA_VERSION = 3;
const LEGACY_SCHEMA_VERSION = 1;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 20;

export type NovelListCacheEntry = {
  fetchedAt: number;
  page: number;
  search: string;
  isRyuseigai: boolean;
  pageSize?: number;
  items: NovelSummary[];
  totalCount: number;
};

type NovelListCacheStore = {
  schemaVersion: typeof SCHEMA_VERSION;
  entries: Record<string, NovelListCacheEntry>;
};

type LegacyNovelListCacheEntry = NovelListCacheEntry & {
  schemaVersion: typeof LEGACY_SCHEMA_VERSION;
};

export const novelListParamsKey = (params: NovelListQueryParams): string =>
  `${params.isRyuseigai}|${params.page}|${params.search.trim()}|${params.pageSize ?? ''}`;

const matchesLegacyParams = (entry: NovelListCacheEntry, params: NovelListQueryParams): boolean =>
  entry.pageSize === undefined &&
  entry.page === params.page &&
  entry.search === params.search.trim() &&
  entry.isRyuseigai === params.isRyuseigai;

const isUsableEntry = (entry: NovelListCacheEntry | undefined): entry is NovelListCacheEntry =>
  !!entry &&
  Number.isFinite(entry.fetchedAt) &&
  Date.now() - entry.fetchedAt <= CACHE_TTL_MS &&
  Array.isArray(entry.items) &&
  Number.isFinite(entry.totalCount);

const readCacheStore = (): NovelListCacheStore => {
  const emptyStore: NovelListCacheStore = { schemaVersion: SCHEMA_VERSION, entries: {} };

  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return emptyStore;

    const parsed = JSON.parse(raw) as NovelListCacheStore | LegacyNovelListCacheEntry;
    if (parsed.schemaVersion === SCHEMA_VERSION && 'entries' in parsed && parsed.entries) {
      return parsed;
    }

    if (parsed.schemaVersion === LEGACY_SCHEMA_VERSION && 'items' in parsed) {
      const { schemaVersion: _legacyVersion, ...legacyEntry } = parsed;
      return {
        schemaVersion: SCHEMA_VERSION,
        entries: {
          [novelListParamsKey(legacyEntry)]: legacyEntry,
        },
      };
    }
  } catch {
    // invalid JSON や storage 読み込み失敗は空キャッシュとして扱う
  }

  return emptyStore;
};

export function readNovelListCache(params: NovelListQueryParams): NovelListCacheEntry | null {
  const entries = readCacheStore().entries;
  const entry = entries[novelListParamsKey(params)] ??
    Object.values(entries).find(
      (cached) => isUsableEntry(cached) && matchesLegacyParams(cached, params),
    );
  return isUsableEntry(entry) ? entry : null;
}

export function writeNovelListCache(
  params: NovelListQueryParams,
  items: NovelSummary[],
  totalCount: number,
): void {
  try {
    const store = readCacheStore();
    const entry: NovelListCacheEntry = {
      fetchedAt: Date.now(),
      page: params.page,
      search: params.search.trim(),
      isRyuseigai: params.isRyuseigai,
      pageSize: params.pageSize,
      items,
      totalCount,
    };

    const entries = Object.fromEntries(
      Object.entries({
        ...store.entries,
        [novelListParamsKey(params)]: entry,
      })
        .filter(([, cached]) => isUsableEntry(cached))
        .sort(([, left], [, right]) => right.fetchedAt - left.fetchedAt)
        .slice(0, MAX_CACHE_ENTRIES),
    );

    localStorage.setItem(CACHE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, entries }));
  } catch {
    // quota exceeded 等は無視
  }
}

export function clearNovelListCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
