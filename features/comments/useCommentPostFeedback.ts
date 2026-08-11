import { useEffect, useState } from 'react';
import type { Comment } from '../../types';

export function useCommentPostFeedback(comments: Comment[]) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!pendingScrollId) return;
    if (!comments.some((c) => c.id === pendingScrollId)) return;

    const el = document.getElementById(`comment-${pendingScrollId}`);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    setHighlightedId(pendingScrollId);
    const timer = window.setTimeout(() => {
      setHighlightedId(null);
      setPendingScrollId(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [pendingScrollId, comments]);

  const onPostSuccess = (commentId: string, message: string) => {
    setSuccessMessage(message);
    setPendingScrollId(commentId);
  };

  return { highlightedId, successMessage, onPostSuccess };
}
