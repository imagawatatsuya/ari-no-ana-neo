import type { Comment, Novel } from '../../types';

const MAX_CACHE_ENTRIES = 8;

export type NovelReadCacheEntry = {
  novel: Novel;
  comments: Comment[];
};

const cache = new Map<string, NovelReadCacheEntry>();

export function peekNovelReadCache(id: string): NovelReadCacheEntry | null {
  const entry = cache.get(id);
  if (!entry) return null;
  cache.delete(id);
  cache.set(id, entry);
  return entry;
}

export function writeNovelReadCache(id: string, novel: Novel, comments: Comment[]): void {
  cache.delete(id);
  cache.set(id, { novel, comments });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function evictNovelReadCache(id: string): void {
  cache.delete(id);
}

export function clearNovelReadCache(): void {
  cache.clear();
}
