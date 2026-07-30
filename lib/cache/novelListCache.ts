import type { NovelSummary } from '../../types';
import type { NovelListQueryParams } from '../../services/supabase/novelQueries';

const CACHE_KEY = 'ari_novel_list_cache_v1';
const SCHEMA_VERSION = 1;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type NovelListCacheEntry = {
  schemaVersion: number;
  fetchedAt: number;
  page: number;
  search: string;
  isRyuseigai: boolean;
  items: NovelSummary[];
  totalCount: number;
};

const paramsKey = (params: NovelListQueryParams): string =>
  `${params.isRyuseigai}|${params.page}|${params.search.trim()}`;

export const novelListParamsKey = (params: NovelListQueryParams): string =>
  `${params.isRyuseigai}|${params.page}|${params.search.trim()}|${params.pageSize ?? ''}`;

export function readNovelListCache(params: NovelListQueryParams): NovelListCacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as NovelListCacheEntry;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    if (paramsKey(params) !== paramsKey(parsed)) return null;
    if (!Array.isArray(parsed.items)) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function writeNovelListCache(
  params: NovelListQueryParams,
  items: NovelSummary[],
  totalCount: number,
): void {
  try {
    const entry: NovelListCacheEntry = {
      schemaVersion: SCHEMA_VERSION,
      fetchedAt: Date.now(),
      page: params.page,
      search: params.search.trim(),
      isRyuseigai: params.isRyuseigai,
      items,
      totalCount,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
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
