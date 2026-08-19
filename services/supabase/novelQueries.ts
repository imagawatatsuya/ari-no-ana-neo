import { LIST_COMMENT_COLUMNS, LIST_NOVEL_COLUMNS, READ_COMMENT_COLUMNS, READ_NOVEL_COLUMNS } from '../../features/novels/novelSummaries';
import { peekNovelReadCache, writeNovelReadCache } from '../../lib/cache/novelReadCache';
import { supabase } from '../supabaseClient';
import { normalizeAuthorIndentMode, type Comment, type Novel, type NovelSummary } from '../../types';

export const NOVELS_PER_PAGE = 20;
export const RYUSEIGAI_LIST_LIMIT = 100;

export type NovelListQueryParams = {
  page: number;
  search: string;
  isRyuseigai: boolean;
  pageSize?: number;
};

export type NovelListFetchResult =
  | { ok: true; items: NovelSummary[]; totalCount: number }
  | { ok: false; message: string };

type RpcRow = {
  id: string;
  title: string;
  author: string;
  trip: string | null;
  date: string;
  view_count: number;
  comment_count: number | string;
  vote_sum: number | string;
  total_count: number | string;
};

const mapRpcRow = (row: RpcRow, isRyuseigai: boolean): NovelSummary => ({
  id: row.id,
  title: row.title,
  author: row.author,
  trip: row.trip ?? undefined,
  date: row.date,
  viewCount: row.view_count ? Number(row.view_count) : 0,
  commentCount: Number(row.comment_count) || 0,
  voteSum: Number(row.vote_sum) || 0,
  isRyuseigai,
  isHidden: false,
});

/** RPC で一覧を1回取得。未デプロイ時は最適化フォールバックへ */
export async function fetchNovelListPage(params: NovelListQueryParams): Promise<NovelListFetchResult> {
  if (!supabase) {
    return { ok: false, message: 'Supabase が設定されていません。' };
  }

  const pageSize = params.pageSize ?? NOVELS_PER_PAGE;
  const offset = (params.page - 1) * pageSize;
  const trimmed = params.search.trim();

  const rpcResult = await supabase.rpc('list_public_novels', {
    p_offset: offset,
    p_limit: pageSize,
    p_search: trimmed || null,
    p_is_ryuseigai: params.isRyuseigai,
  });

  if (!rpcResult.error && rpcResult.data) {
    const rows = rpcResult.data as RpcRow[];
    const totalCount = rows.length > 0 ? Number(rows[0].total_count) || 0 : 0;
    return {
      ok: true,
      items: rows.map((row) => mapRpcRow(row, params.isRyuseigai)),
      totalCount,
    };
  }

  // RPC 未適用（関数不存在など）の場合のみフォールバック
  const rpcMissing =
    rpcResult.error?.code === 'PGRST202' ||
    rpcResult.error?.message?.includes('list_public_novels') ||
    rpcResult.error?.message?.includes('Could not find the function');

  if (!rpcMissing) {
    return {
      ok: false,
      message: rpcResult.error?.message ?? '一覧の取得に失敗しました。',
    };
  }

  return fetchNovelListPageFallback(params);
}

async function fetchNovelListPageFallback(params: NovelListQueryParams): Promise<NovelListFetchResult> {
  if (!supabase) {
    return { ok: false, message: 'Supabase が設定されていません。' };
  }

  const pageSize = params.pageSize ?? NOVELS_PER_PAGE;
  const from = (params.page - 1) * pageSize;
  const to = from + pageSize - 1;
  const trimmed = params.search.trim();

  let countQuery = supabase
    .from('novels')
    .select('id', { count: 'exact', head: true })
    .eq('is_hidden', false)
    .eq('is_ryuseigai', params.isRyuseigai);
  if (trimmed) {
    countQuery = countQuery.or(`title.ilike.%${trimmed}%,author.ilike.%${trimmed}%`);
  }

  let novelsQuery = supabase
    .from('novels')
    .select(LIST_NOVEL_COLUMNS)
    .eq('is_hidden', false)
    .eq('is_ryuseigai', params.isRyuseigai)
    .order('date', { ascending: false })
    .range(from, to);
  if (trimmed) {
    novelsQuery = novelsQuery.or(`title.ilike.%${trimmed}%,author.ilike.%${trimmed}%`);
  }

  const [countResult, novelsResult] = await Promise.all([countQuery, novelsQuery]);

  if (countResult.error) {
    return { ok: false, message: countResult.error.message };
  }
  if (novelsResult.error) {
    return { ok: false, message: novelsResult.error.message };
  }

  const novelsData = novelsResult.data ?? [];
  const novelIds = novelsData.map((n) => n.id);

  const voteByNovel = new Map<string, { count: number; sum: number }>();
  if (novelIds.length > 0) {
    const { data: commentsData, error: commentsError } = await supabase
      .from('comments')
      .select(LIST_COMMENT_COLUMNS)
      .in('novel_id', novelIds);

    if (commentsError) {
      return { ok: false, message: commentsError.message };
    }

    for (const c of commentsData ?? []) {
      const entry = voteByNovel.get(c.novel_id) ?? { count: 0, sum: 0 };
      entry.count += 1;
      entry.sum += c.vote;
      voteByNovel.set(c.novel_id, entry);
    }
  }

  const items: NovelSummary[] = novelsData.map((n) => {
    const agg = voteByNovel.get(n.id) ?? { count: 0, sum: 0 };
    return {
      id: n.id,
      title: n.title,
      author: n.author,
      trip: n.trip ?? undefined,
      date: n.date,
      viewCount: n.view_count ? Number(n.view_count) : 0,
      commentCount: agg.count,
      voteSum: agg.sum,
      isRyuseigai: !!n.is_ryuseigai,
      isHidden: false,
    };
  });

  return {
    ok: true,
    items,
    totalCount: countResult.count ?? 0,
  };
}

export type NovelReadResult =
  | { ok: true; novel: Novel; comments: Comment[]; commentsFailed?: boolean }
  | { ok: false; message: string };

type NovelReadRow = {
  id: string;
  title: string;
  author: string;
  trip: string | null;
  body: string;
  date: string;
  view_count: number | string | null;
  is_hidden: boolean | null;
  is_ryuseigai: boolean | null;
  description: string | null;
  author_message: string | null;
  author_indent_mode: string | null;
};

type CommentReadRow = {
  id: string;
  novel_id: string;
  name: string | null;
  text: string;
  date: string;
  vote: number;
};

type InFlightRead = {
  promise: Promise<NovelReadResult>;
  novel?: Novel;
  novelListeners: Array<(novel: Novel) => void>;
};

const inflightReads = new Map<string, InFlightRead>();

const mapReadNovel = (row: NovelReadRow): Novel => ({
  id: row.id,
  title: row.title,
  author: row.author,
  trip: row.trip ?? undefined,
  body: row.body,
  date: row.date,
  viewCount: row.view_count ? Number(row.view_count) : 0,
  commentCount: 0,
  voteSum: 0,
  isHidden: !!row.is_hidden,
  isRyuseigai: !!row.is_ryuseigai,
  description: row.description ?? undefined,
  authorMessage: row.author_message ?? undefined,
  authorIndentMode: normalizeAuthorIndentMode(row.author_indent_mode, 'raw'),
});

const mapReadComments = (rows: CommentReadRow[] | null): Comment[] =>
  (rows ?? []).map((row) => ({
    id: row.id,
    novelId: row.novel_id,
    name: row.name || '',
    text: row.text,
    date: row.date,
    vote: row.vote,
  }));

const notifyNovelListeners = (slot: InFlightRead, novel: Novel) => {
  slot.novel = novel;
  for (const listener of slot.novelListeners) listener(novel);
  slot.novelListeners.length = 0;
};

async function fetchNovelForReadFromSupabase(
  id: string,
  slot: InFlightRead,
): Promise<NovelReadResult> {
  if (!supabase) {
    return { ok: false, message: 'Supabase が設定されていません。' };
  }

  const novelRequest = supabase
    .from('novels')
    .select(READ_NOVEL_COLUMNS)
    .eq('id', id)
    .single();
  const commentsRequest = supabase
    .from('comments')
    .select(READ_COMMENT_COLUMNS)
    .eq('novel_id', id);

  const { data: novelData, error: novelError } = await novelRequest;
  if (novelError || !novelData) {
    return { ok: false, message: novelError?.message ?? '作品の取得に失敗しました。' };
  }

  const novel = mapReadNovel(novelData as NovelReadRow);
  notifyNovelListeners(slot, novel);

  const { data: commentsData, error: commentsError } = await commentsRequest;
  if (commentsError) {
    return { ok: true, novel, comments: [], commentsFailed: true };
  }

  const comments = mapReadComments(commentsData as CommentReadRow[] | null);
  writeNovelReadCache(id, novel, comments);
  return { ok: true, novel, comments };
}

/** 同一 ID の進行中リクエストを共有し、本文到着時点で onNovel を呼ぶ */
export function loadNovelForRead(
  id: string,
  options?: { onNovel?: (novel: Novel) => void },
): Promise<NovelReadResult> {
  if (!supabase) {
    return Promise.resolve({ ok: false, message: 'Supabase が設定されていません。' });
  }

  const cached = peekNovelReadCache(id);
  if (cached) {
    if (options?.onNovel) options.onNovel(cached.novel);
    return Promise.resolve({ ok: true, novel: cached.novel, comments: cached.comments });
  }

  let slot = inflightReads.get(id);
  if (!slot) {
    const created: InFlightRead = { promise: Promise.resolve({ ok: false, message: '' }), novelListeners: [] };
    created.promise = fetchNovelForReadFromSupabase(id, created).finally(() => {
      inflightReads.delete(id);
    });
    inflightReads.set(id, created);
    slot = created;
  }

  if (options?.onNovel) {
    if (slot.novel) options.onNovel(slot.novel);
    else slot.novelListeners.push(options.onNovel);
  }

  return slot.promise;
}

export function prefetchNovelForRead(id: string): void {
  if (peekNovelReadCache(id)) return;
  void loadNovelForRead(id);
}
