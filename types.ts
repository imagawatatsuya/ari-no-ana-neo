export interface Comment {
  id: string;
  novelId: string; // Foreign Key linking to Novel
  name: string; // 非使用（互換性のため残置）
  trip?: string; // トリップ（識別用）
  text: string;
  date: string;
  vote: number; // -2 to +2
}

export interface Novel {
  id: string;
  title: string;
  description?: string; // 自由記述メッセージバー（作品ページ上部のグレー帯）
  author: string; // 名前（識別用・トリップ生成元）
  trip?: string; // トリップ（識別用）
  body: string; // Raw text
  date: string;
  viewCount: number;
}

export type ViewMode = 'list' | 'post' | 'read' | 'admin';

export enum VoteValue {
  BEST = 2,
  GOOD = 1,
  NORMAL = 0,
  BAD = -1,
  WORST = -2
}