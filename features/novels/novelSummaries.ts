import { Comment, Novel, NovelSummary } from '../../types';

export const LIST_NOVEL_COLUMNS = 'id, title, author, trip, date, view_count, is_ryuseigai';
export const LIST_COMMENT_COLUMNS = 'novel_id, vote';
export const READ_NOVEL_COLUMNS =
  'id, title, author, trip, body, date, view_count, is_hidden, is_ryuseigai, description, author_message, author_indent_mode';
export const READ_COMMENT_COLUMNS = 'id, novel_id, name, text, date, vote';

export function novelsToSummaries(novels: Novel[], comments: Comment[]): NovelSummary[] {
  return novels.map((novel) => {
    const novelComments = comments.filter((c) => c.novelId === novel.id);
    const voteSum = novelComments.reduce((acc, c) => acc + c.vote, 0);
    return {
      id: novel.id,
      title: novel.title,
      author: novel.author,
      trip: novel.trip,
      date: novel.date,
      viewCount: novel.viewCount,
      commentCount: novelComments.length,
      voteSum,
      isRyuseigai: novel.isRyuseigai,
      isHidden: novel.isHidden,
    };
  });
}
