import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Novel, Comment, ReaderIndentMode } from '../types';
import { calculateScore, formatDate, formatManuscriptPages, isCountedVote, resolveAuthorName, getCooldownRemainSec, markCooldown, cooldownErrorText, LAST_COMMENT_KEY } from '../utils';
import { FootnoteRenderer, FootnoteMode } from './FootnoteRenderer';
import { IndentModeControl } from './IndentModeControl';
import { formatReaderBody } from '../services/jisageAdapter';
import { BASE_PATH, navigate } from '../router';
import { useCommentPostFeedback } from '../features/comments/useCommentPostFeedback';
import { fragmentText } from '../lib/textFragmenter';
import { loadReaderBookmark, saveReaderBookmark } from '../services/readerBookmarks';

interface NovelReaderProps {
  novel: Novel;
  comments: Comment[];
  onComment: (comment: Comment) => Promise<boolean>;
  footnoteMode?: FootnoteMode;
  indentMode: ReaderIndentMode;
  onIndentModeChange: (mode: ReaderIndentMode) => void;
  onOpenReaderSettings: () => void;
}

type ReaderBookmarkState = {
  novelId: string;
  fragmentIndex: number | null;
};

type PendingBookmarkResume = {
  novelId: string;
  fragmentIndex: number;
};

const MAX_COMMENT_LENGTH = 500;

const voteLabel = (v: number): string => {
  switch (v) {
    case 2: return 'とても良い';
    case 1: return '良い';
    case 0: return '普通';
    case -1: return '良くない';
    case -2: return '最悪';
    default: return '';
  }
};

const badgeClass = (v: number): string => {
  if (v >= 1) return 'comment-badge comment-badge-positive';
  if (v <= -1) return 'comment-badge comment-badge-negative';
  return 'comment-badge comment-badge-neutral';
};

export const NovelReader: React.FC<NovelReaderProps> = React.memo(({
  novel,
  comments,
  onComment,
  footnoteMode,
  indentMode,
  onIndentModeChange,
  onOpenReaderSettings,
}) => {
  const [commentText, setCommentText] = useState('');
  const [commentName, setCommentName] = useState('');
  const [vote, setVote] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bodyPresentation, setBodyPresentation] = useState<'continuous' | 'fragments'>('continuous');
  const [bookmarkState, setBookmarkState] = useState<ReaderBookmarkState>(() => ({
    novelId: novel.id,
    fragmentIndex: loadReaderBookmark(novel.id)?.fragmentIndex ?? null,
  }));
  const [pendingBookmarkResume, setPendingBookmarkResume] = useState<PendingBookmarkResume | null>(null);
  const [bookmarkResumeMessage, setBookmarkResumeMessage] = useState('');
  const { highlightedId, successMessage, onPostSuccess } = useCommentPostFeedback(comments);
  const authorMessage = novel.authorMessage?.trim() ?? '';

  useEffect(() => {
    setBookmarkState({
      novelId: novel.id,
      fragmentIndex: loadReaderBookmark(novel.id)?.fragmentIndex ?? null,
    });
    setPendingBookmarkResume(null);
    setBookmarkResumeMessage('');
  }, [novel.id]);

  const bookmarkIndex = bookmarkState.novelId === novel.id ? bookmarkState.fragmentIndex : null;

  const handleBookmarkToggle = useCallback((fragmentIndex: number) => {
    const nextBookmarkIndex = bookmarkIndex === fragmentIndex ? null : fragmentIndex;
    setBookmarkState({ novelId: novel.id, fragmentIndex: nextBookmarkIndex });
    saveReaderBookmark(novel.id, nextBookmarkIndex);
  }, [bookmarkIndex, novel.id]);

  const handleBookmarkResume = useCallback(() => {
    if (bookmarkIndex === null) return;

    setBookmarkResumeMessage('');
    setPendingBookmarkResume({
      novelId: novel.id,
      fragmentIndex: bookmarkIndex,
    });
    setBodyPresentation('fragments');
  }, [bookmarkIndex, novel.id]);

  useEffect(() => {
    if (
      bodyPresentation !== 'fragments'
      || pendingBookmarkResume === null
      || pendingBookmarkResume.novelId !== novel.id
    ) {
      return;
    }

    const { fragmentIndex } = pendingBookmarkResume;
    const target = document.getElementById(`reader-fragment-${fragmentIndex}`);
    setPendingBookmarkResume(null);

    if (!target) {
      setBookmarkResumeMessage(
        `しおりの位置（断片 ${fragmentIndex}）が見つかりません。本文が更新された可能性があります。`,
      );
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
    setBookmarkResumeMessage(`断片 ${fragmentIndex} から再開しました。`);
  }, [bodyPresentation, novel.id, pendingBookmarkResume]);

  const { total, count } = useMemo(() => calculateScore(comments), [comments]);
  const pageCountLabel = useMemo(() => formatManuscriptPages(novel.body), [novel.body]);

  const voteBreakdown = useMemo(() => {
    const breakdown = { best: 0, good: 0, normal: 0, bad: 0, worst: 0 };
    for (const comment of comments) {
      if (comment.vote === 2) breakdown.best += 1;
      else if (comment.vote === 1) breakdown.good += 1;
      else if (comment.vote === 0) breakdown.normal += 1;
      else if (comment.vote === -1) breakdown.bad += 1;
      else if (comment.vote === -2) breakdown.worst += 1;
    }
    return breakdown;
  }, [comments]);

  const avg = count > 0 ? total / count : 0;
  // 未採点のみのときは空。0点平均を3星にしない。
  const filled = count > 0 ? Math.max(0, Math.min(5, Math.round(((avg + 2) / 4) * 5))) : 0;
  const starsOn = '★'.repeat(filled);
  const starsOff = '★'.repeat(5 - filled);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!commentText.trim()) {
      setFormError('感想を入力してください。');
      return;
    }
    const remainSec = getCooldownRemainSec(LAST_COMMENT_KEY);
    if (remainSec > 0) {
      setFormError(cooldownErrorText(remainSec));
      return;
    }
    if (commentText.length > MAX_COMMENT_LENGTH) {
      setFormError(`コメントが長すぎます (${commentText.length}/${MAX_COMMENT_LENGTH})`);
      return;
    }

    setFormError('');
    const commentId = Date.now().toString();
    setIsSubmitting(true);
    const ok = await onComment({
      id: commentId,
      novelId: novel.id,
      name: resolveAuthorName(commentName),
      text: commentText,
      date: new Date().toISOString(),
      vote,
    });
    setIsSubmitting(false);

    if (!ok) {
      setFormError('投稿に失敗しました。しばらくしてから再度お試しください。');
      return;
    }

    setCommentText('');
    setCommentName('');
    setVote(null);
    markCooldown(LAST_COMMENT_KEY);
    onPostSuccess(commentId, '感想を投稿しました。');
  };

  return (
    <div>
      <div className="reader-top-nav">
        <a href={BASE_PATH + '/'} onClick={(e) => { e.preventDefault(); navigate('/'); }} className="back-link">戻る</a>
        <div className="reader-top-actions">
          {bookmarkIndex !== null && (
            <button
              type="button"
              className="reader-resume-bookmark"
              onClick={handleBookmarkResume}
              aria-label={`断片 ${bookmarkIndex} のしおりから再開`}
            >
              しおりから再開（断片 {bookmarkIndex}）
            </button>
          )}
          <div className="reader-presentation-switch" role="group" aria-label="本文の読み方">
            <button
              type="button"
              className={bodyPresentation === 'continuous' ? 'is-active' : ''}
              aria-pressed={bodyPresentation === 'continuous'}
              onClick={() => setBodyPresentation('continuous')}
            >
              全文
            </button>
            <button
              type="button"
              className={bodyPresentation === 'fragments' ? 'is-active' : ''}
              aria-pressed={bodyPresentation === 'fragments'}
              onClick={() => setBodyPresentation('fragments')}
            >
              断片読み
            </button>
          </div>
          <button
            type="button"
            className="reader-settings-link"
            onClick={onOpenReaderSettings}
            aria-haspopup="dialog"
          >
            &gt;&gt;字下げ設定
          </button>
        </div>
      </div>
      {bookmarkResumeMessage && (
        <div className="reader-bookmark-status" role="status" aria-live="polite">
          {bookmarkResumeMessage}
        </div>
      )}

      <IndentModeControl
        mode={indentMode}
        onChange={onIndentModeChange}
        name="reader-indent-mode"
        note="既定値は投稿者設定です。全角空白1字は整理し、二字以上の手動空白は保持します。脚注には適用しません。"
      />

      {/* 記事テーブル: 元サイト <table width="90%" cellspacing="4" cellpadding="8" align="center"> */}
      <table className="article-table">
        <tbody>
          {/* タイトル: .font_title { font-size:240%; font-weight:bold; color:#444444 } */}
          <tr>
            <td className="article-title">{novel.title}</td>
          </tr>
          {/* 原稿用紙換算枚数: 元サイト【N 枚】表示 / 1枚未満表示 */}
          {pageCountLabel && (
            <tr>
              <td className="article-page-count">{pageCountLabel}</td>
            </tr>
          )}
          {/* 副題: 元サイトの自由記述メッセージバー */}
          {novel.description?.trim() && (
            <tr>
              <td className="article-subtitle">{novel.description.trim()}</td>
            </tr>
          )}
          {/* 本文: .font_body { font-size:100%; line-height:150% } */}
          <tr>
            <td className="article-body">
              <FootnoteRenderer
                content={novel.body}
                indentMode={indentMode}
                authorIndentMode={novel.authorIndentMode}
                footnoteMode={footnoteMode}
                formatBody={formatReaderBody}
                segmentBody={bodyPresentation === 'fragments' ? fragmentText : undefined}
                bookmarkedFragmentIndex={bodyPresentation === 'fragments' ? bookmarkIndex : null}
                onBookmarkToggle={bodyPresentation === 'fragments' ? handleBookmarkToggle : undefined}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 日付: 元サイトはテーブル外・右寄せ */}
      <div className="article-date" style={{ textAlign: 'right' }}>{formatDate(novel.date)} 公開</div>

      {/* 作者情報とメッセージ */}
      <div style={{ padding: '4px 8px', fontSize: 16 }}>
        <b>■作者</b>
        <div style={{ marginLeft: '3%' }}>{novel.author || '名無し'}</div>
        {authorMessage && (
          <div style={{ marginTop: 8 }}>
            <b>■メッセージ</b>
            <div style={{ marginLeft: '3%', whiteSpace: 'pre-wrap' }}>{authorMessage}</div>
          </div>
        )}
      </div>

      {/* POINT ボックス */}
      <div className="point-box">
        現在のPOINT [ <span className="point-value">{total}</span> ] 投票数 [ {count} ]
        <div aria-label={`5点満点中${filled}点`}>
          <span className="stars-on" aria-hidden="true">{starsOn}</span>
          <span className="stars-off" aria-hidden="true">{starsOff}</span>
        </div>
        <div className="point-breakdown">
          内訳： とても良い [ {voteBreakdown.best} ] 良い [ {voteBreakdown.good} ] 普通 [ {voteBreakdown.normal} ] 良くない [ {voteBreakdown.bad} ] 最悪 [ {voteBreakdown.worst} ]
        </div>
      </div>

      {/* 感想・批評 */}
      <div className="section-title" id="comments-section">感想・批評</div>
      {comments.length === 0 ? (
        <div style={{ fontSize: 14, padding: '8px 4px' }}>まだ感想はありません。</div>
      ) : (
        <div>
          {[...comments].reverse().map((c, idx) => (
            <div
              className={`comment-block${c.id === highlightedId ? ' comment-block--new' : ''}`}
              id={`comment-${c.id}`}
              key={c.id}
            >
              <div className="comment-text">{c.text}</div>
              <div className="comment-footer">
                <span className="comment-number">{comments.length - idx}:</span>{' '}
                <span className="comment-name">{c.name.trim() || '名無し'}</span>{' '}
                {isCountedVote(c.vote) && voteLabel(c.vote) && (
                  <span className={badgeClass(c.vote)}>{voteLabel(c.vote)}</span>
                )}{' '}
                <span className="comment-date">{formatDate(c.date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 感想投稿フォーム */}
      <div className="comment-form">
        <form onSubmit={handleSubmit}>
          {successMessage && (
            <div className="comment-post-success" role="status" aria-live="polite">
              {successMessage}
            </div>
          )}
          <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>■感想・批評(改行有効）</div>
          <textarea
            value={commentText}
            onChange={(e) => {
              setCommentText(e.target.value);
              if (formError) setFormError('');
            }}
            style={{ minHeight: 120, width: '100%' }}
            maxLength={MAX_COMMENT_LENGTH}
            aria-invalid={!!formError}
            aria-describedby={formError ? 'comment-form-error' : 'comment-form-count'}
          />
          <div id="comment-form-count" className="comment-form-count">
            {commentText.length.toLocaleString()} / {MAX_COMMENT_LENGTH} 文字
          </div>
          {formError && (
            <div id="comment-form-error" className="form-field-error" role="alert">{formError}</div>
          )}
          <div style={{ marginTop: 6, fontSize: 16 }}>
            <b>■名前</b>{' '}
            <input type="text" value={commentName} onChange={(e) => setCommentName(e.target.value)} placeholder="名無し" maxLength={100} style={{ width: 260, maxWidth: '100%' }} />
            <div className="comment-form-count">{commentName.length.toLocaleString()} / 100</div>
          </div>
          <div style={{ marginTop: 6, fontSize: 16 }}>
            <b>■採点</b>{' '}
            <select
              value={vote === null ? 'none' : String(vote)}
              onChange={(e) => setVote(e.target.value === 'none' ? null : Number(e.target.value))}
            >
              <option value="none">採点しない</option>
              <option value="2">とても良い</option>
              <option value="1">良い</option>
              <option value="0">普通</option>
              <option value="-1">良くない</option>
              <option value="-2">最悪</option>
            </select>
            <div className="vote-note">採点しない場合、ポイント集計には含まれません。</div>
          </div>
          <div className="comment-form-actions">
            <button type="submit" className="classic-button comment-form-action-primary" disabled={isSubmitting}>
              {isSubmitting ? '送信中...' : '投稿'}
            </button>
            <button type="button" className="classic-button" disabled={isSubmitting} onClick={() => { setCommentText(''); setCommentName(''); setVote(null); setFormError(''); }}>クリア</button>
          </div>
        </form>
      </div>

      {/* 戻る */}
      <div style={{ marginTop: 12 }}>
        <a href={BASE_PATH + '/'} onClick={(e) => { e.preventDefault(); navigate('/'); }} className="back-link">戻る</a>
      </div>
      <hr style={{ border: '0', borderTop: '1px inset #999', margin: '8px 0' }} />
      <div className="admin-inline-section" style={{ fontSize: 14 }}>
        <span>[ <a href={BASE_PATH + '/admin'} onClick={(e) => { e.preventDefault(); navigate('/admin'); }}>感想記事削除</a> ]</span>
        <button type="button" className="classic-button" onClick={() => { navigate('/admin'); }}>管理者用</button>
      </div>
    </div>
  );
});
