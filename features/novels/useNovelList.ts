import { NovelListState } from '../../types';
import { readNovelListCache, writeNovelListCache } from '../../lib/cache/novelListCache';
import { fetchNovelListPage, NovelListQueryParams } from '../../services/supabase/novelQueries';
import { useEffect, useRef, useState } from 'react';

export function useNovelList(
  enabled: boolean,
  params: NovelListQueryParams,
): { listState: NovelListState; totalCount: number; refresh: () => void } {
  const [listState, setListState] = useState<NovelListState>({ status: 'loading' });
  const [totalCount, setTotalCount] = useState(0);
  const requestIdRef = useRef(0);

  const load = async (showCacheFirst: boolean) => {
    const requestId = ++requestIdRef.current;
    const cached = showCacheFirst ? readNovelListCache(params) : null;

    if (cached) {
      setListState({
        status: 'success',
        items: cached.items,
        totalCount: cached.totalCount,
        stale: true,
      });
      setTotalCount(cached.totalCount);
    } else {
      setListState({ status: 'loading' });
    }

    const result = await fetchNovelListPage(params);
    if (requestId !== requestIdRef.current) return;

    if (result.ok) {
      writeNovelListCache(params, result.items, result.totalCount);
      if (result.totalCount === 0) {
        setListState({ status: 'empty' });
        setTotalCount(0);
      } else {
        setListState({
          status: 'success',
          items: result.items,
          totalCount: result.totalCount,
        });
        setTotalCount(result.totalCount);
      }
      return;
    }

    if (cached) {
      setListState({
        status: 'success',
        items: cached.items,
        totalCount: cached.totalCount,
        stale: true,
      });
      setTotalCount(cached.totalCount);
      return;
    }

    setListState({ status: 'error', message: result.message });
  };

  useEffect(() => {
    if (!enabled) return;
    load(true);
  }, [enabled, params.page, params.search, params.isRyuseigai, params.pageSize]);

  const refresh = () => {
    if (!enabled) return;
    load(false);
  };

  return { listState, totalCount, refresh };
}
