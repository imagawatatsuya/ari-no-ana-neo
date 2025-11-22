export interface Comment {
  id: string;
  novelId: string; // Foreign Key linking to Novel
  name: string;
  text: string;
  date: string;
  vote: number; // -2 to +2
}

export interface Novel {
  id: string;
  title: string;
  author: string;
  trip?: string;
  body: string; // Raw text
  date: string;
  viewCount: number;
}

export type ViewMode = 'list' | 'post' | 'read';

export enum VoteValue {
  BEST = 2,
  GOOD = 1,
  NORMAL = 0,
  BAD = -1,
  WORST = -2
}