import type { Comment, Novel } from './types';

export const editNovelInList = (
  novels: Novel[],
  id: string,
  patch: Pick<Novel, 'title' | 'author' | 'trip' | 'body'>,
): Novel[] => novels.map((novel) => (novel.id === id ? { ...novel, ...patch } : novel));

export const deleteNovelAndComments = (
  novels: Novel[],
  comments: Comment[],
  id: string,
): { novels: Novel[]; comments: Comment[] } => ({
  novels: novels.filter((novel) => novel.id !== id),
  comments: comments.filter((comment) => comment.novelId !== id),
});

export const toggleHiddenNovelId = (
  hiddenNovelIds: string[],
  id: string,
  nextHidden: boolean,
): string[] => {
  const current = new Set(hiddenNovelIds);
  if (nextHidden) {
    current.add(id);
  } else {
    current.delete(id);
  }
  return Array.from(current);
};
