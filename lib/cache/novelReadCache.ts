import type { Comment, Novel } from '../../types';

const MAX_CACHE_ENTRIES = 8;
export const NOVEL_READ_CACHE_TTL_MS = 30_000;
let authGeneration = 0;
const revisions = new Map<string, number>();
export const novelReadCacheRevision = (id: string): string => `${authGeneration}:${revisions.get(id) ?? 0}`;

export type NovelReadCacheEntry = {
  novel: Novel;
  comments: Comment[];
  fetchedAt: number;
};

const cache = new Map<string, NovelReadCacheEntry>();

export function peekNovelReadCache(id: string): NovelReadCacheEntry | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt >= NOVEL_READ_CACHE_TTL_MS || Date.now() < entry.fetchedAt) {
    cache.delete(id);
    return null;
  }
  cache.delete(id);
  cache.set(id, entry);
  return entry;
}

export function writeNovelReadCache(id: string, novel: Novel, comments: Comment[]): void {
  cache.delete(id);
  cache.set(id, { novel, comments, fetchedAt: Date.now() });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function evictNovelReadCache(id: string): void {
  revisions.set(id, (revisions.get(id) ?? 0) + 1);
  cache.delete(id);
}

export function clearNovelReadCache(): void {
  authGeneration += 1;
  revisions.clear();
  cache.clear();
}
