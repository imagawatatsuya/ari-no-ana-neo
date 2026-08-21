/** 一覧表示用（本文・コメント本文を含まない） */
export interface NovelSummary {
  id: string;
  title: string;
  author: string;
  trip?: string;
  date: string;
  viewCount: number;
  commentCount: number;
  voteCount: number;
  voteSum: number;
  isRyuseigai?: boolean;
  isHidden?: boolean;
}

export type NovelListState =
  | { status: 'loading' }
  | { status: 'success'; items: NovelSummary[]; totalCount: number; stale?: boolean }
  | { status: 'empty' }
  | { status: 'error'; message: string; cachedItems?: NovelSummary[]; cachedTotalCount?: number };

export type SubmitResult =
  | { ok: true; novelId: string; notice?: string }
  | { ok: false; message: string };

export interface Comment {
  id: string;
  novelId: string; // Foreign Key linking to Novel
  name: string;
  text: string;
  date: string;
  vote: number | null; // 5段階は -2..2。未採点は null。流星垓は -500 / -1000
}

export interface Novel extends NovelSummary {
  description?: string; // 自由記述メッセージバー（作品ページ上部のグレー帯）
  authorMessage?: string; // 作者からのメッセージ本文
  body: string; // Raw text
  /** 投稿者の意図。旧投稿で未保存の場合は raw として扱う。 */
  authorIndentMode?: AuthorIndentMode;
}

export type ViewMode = 'list' | 'post' | 'read' | 'admin' | 'ryuseigai' | 'ryuseigai-read';

export type AuthorIndentMode = 'none' | 'jisage' | 'raw';

export type ReaderIndentMode = 'none' | 'jisage' | 'author';

export const isAuthorIndentMode = (value: unknown): value is AuthorIndentMode =>
  value === 'none' || value === 'jisage' || value === 'raw';

export const normalizeAuthorIndentMode = (
  value: unknown,
  fallback: AuthorIndentMode = 'raw',
): AuthorIndentMode => (isAuthorIndentMode(value) ? value : fallback);

export enum VoteValue {
  BEST = 2,
  GOOD = 1,
  NORMAL = 0,
  BAD = -1,
  WORST = -2
}
