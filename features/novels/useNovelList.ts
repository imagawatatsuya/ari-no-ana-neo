import { NovelListState } from '../../types';
import { readNovelListCache, writeNovelListCache, novelListParamsKey } from '../../lib/cache/novelListCache';
import { fetchNovelListPage, NovelListQueryParams } from '../../services/supabase/novelQueries';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export { novelListParamsKey } from '../../lib/cache/novelListCache';

export function useNovelList(
  enabled: boolean,
  params: NovelListQueryParams,
): { listState: NovelListState; totalCount: number; refresh: () => void } {
  const [listState, setListState] = useState<NovelListState>({ status: 'loading' });
  const [totalCount, setTotalCount] = useState(0);
  const requestIdRef = useRef(0);
  const paramsKey = novelListParamsKey(params);

  // ページ切替時にペイント前へ古い一覧を消す（別ページの作品が一瞬見えるのを防ぐ）
  useLayoutEffect(() => {
    if (!enabled) return;

    const cached = readNovelListCache(params);
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
  }, [enabled, paramsKey]);

  useEffect(() => {
    if (!enabled) return;

    const requestId = ++requestIdRef.current;

    const load = async () => {
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

      const cached = readNovelListCache(params);
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

    void load();
    // paramsKey が変わったときだけ再取得（params オブジェクト参照は毎 render で変わる）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, paramsKey]);

  const refresh = () => {
    if (!enabled) return;

    const requestId = ++requestIdRef.current;
    setListState({ status: 'loading' });

    void (async () => {
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

      const cached = readNovelListCache(params);
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
    })();
  };

  return { listState, totalCount, refresh };
}
