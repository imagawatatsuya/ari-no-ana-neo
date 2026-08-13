import React, { useState } from 'react';
import { Novel, Comment, ReaderIndentMode } from '../types';
import { formatDate, generateTrip, formatManuscriptPages } from '../utils';
import { FootnoteRenderer, FootnoteMode } from './FootnoteRenderer';
import { IndentModeControl } from './IndentModeControl';
import { formatReaderBody } from '../services/jisageAdapter';
import { BASE_PATH, navigate } from '../router';
import { useCommentPostFeedback } from '../features/comments/useCommentPostFeedback';

interface RyuseigaiReaderProps {
  novel: Novel;
  comments: Comment[];
  onComment: (comment: Comment) => Promise<boolean>;
  footnoteMode?: FootnoteMode;
  indentMode: ReaderIndentMode;
  onIndentModeChange: (mode: ReaderIndentMode) => void;
  onOpenReaderSettings: () => void;
}

const MAX_COMMENT_LENGTH = 500;

/** 流星垓の初期ポイント */
const RYUSEIGAI_BASE_SCORE = -300;

export const RyuseigaiReader: React.FC<RyuseigaiReaderProps> = ({
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
  const [vote, setVote] = useState(-500);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { highlightedId, successMessage, onPostSuccess } = useCommentPostFeedback(comments);
  const subtitle = novel.description?.trim() ?? '';
  const authorMessage = novel.authorMessage?.trim() ?? '';

  const voteSum = comments.reduce((acc, c) => acc + c.vote, 0);
  const totalScore = RYUSEIGAI_BASE_SCORE + voteSum;

  const countWhy = comments.filter((c) => c.vote === -500).length;
  const countNotExist = comments.filter((c) => c.vote === -1000).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!commentText.trim()) {
      setFormError('声を入力してください。');
      return;
    }
    if (commentText.length > MAX_COMMENT_LENGTH) {
      setFormError(`コメントが長すぎます (${commentText.length}/${MAX_COMMENT_LENGTH})`);
      return;
    }

    setFormError('');
    const commentId = Date.now().toString();
    const { trip } = generateTrip(commentName);
    setIsSubmitting(true);
    const ok = await onComment({
      id: commentId,
      novelId: novel.id,
      name: '',
      trip,
      text: commentText,
      date: new Date().toISOString(),
      vote,
    });
    setIsSubmitting(false);

    if (!ok) {
      setFormError('刻むことに失敗した。しばらくしてから再度試せ。');
      return;
    }

    setCommentText('');
    setCommentName('');
    setVote(-500);
    onPostSuccess(commentId, '刻んだ。');
  };

  return (
    <div className="ryuseigai-shell ryuseigai-reader-shell">
      {/* 戻る */}
      <div className="ryuseigai-nav-top">
        <a href={BASE_PATH + '/ryuseigai'} onClick={(e) => { e.preventDefault(); navigate('/ryuseigai'); }} className="ryuseigai-back-link">← 流星垓へ戻る</a>
        <button
          type="button"
          className="reader-settings-link"
          onClick={onOpenReaderSettings}
          aria-haspopup="dialog"
        >
          &gt;&gt;字下げ設定
        </button>
      </div>

      <IndentModeControl
        mode={indentMode}
        onChange={onIndentModeChange}
        name="ryuseigai-reader-indent-mode"
        note="既定値は投稿者設定です。全角空白1字は整理し、二字以上の手動空白は保持します。脚注には適用しません。"
      />

      {/* 作品本文: 共通組版システム */}
      <table className="article-table">
        <tbody>
          <tr>
            <td className="article-title">{novel.title}</td>
          </tr>
          {formatManuscriptPages(novel.body) && (
            <tr>
              <td className="article-page-count">{formatManuscriptPages(novel.body)}</td>
            </tr>
          )}
          {subtitle && (
            <tr>
              <td className="ryuseigai-article-subtitle">{subtitle}</td>
            </tr>
          )}
          <tr>
            <td className="article-body">
              <FootnoteRenderer
                content={novel.body}
                indentMode={indentMode}
                authorIndentMode={novel.authorIndentMode}
                footnoteMode={footnoteMode}
                formatBody={formatReaderBody}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="article-date" style={{ textAlign: 'right' }}>{formatDate(novel.date)} に捨てられた</div>

      <div className="ryuseigai-author-block">
        <div className="ryuseigai-author-label"><b>■ 捨てた者</b>{novel.trip && <span>＜{novel.trip.replace('◆', '')}＞</span>}</div>
        <div className="ryuseigai-author-name">{novel.author || '名無し'}</div>
        {authorMessage && (
          <div className="ryuseigai-author-message">
            <div className="ryuseigai-author-message-label">からのメッセージ</div>
            <div className="ryuseigai-author-message-text">{authorMessage}</div>
          </div>
        )}
      </div>

      {/* 存在価値（流星垓独自） */}
      <div className="ryuseigai-point-box">
        <div className="ryuseigai-point-label">存在価値</div>
        <div className="ryuseigai-point-value">{totalScore}</div>
        <div className="ryuseigai-point-breakdown">
          「なぜ生まれてきた？」 [{countWhy}] ／ 「おまえは存在しない」 [{countNotExist}]
        </div>
      </div>

      {/* 声（コメント一覧） */}
      <div className="ryuseigai-section-title" id="comments-section">声</div>
      {successMessage && (
        <div className="comment-post-success comment-post-success--ryuseigai" role="status" aria-live="polite">
          {successMessage}
        </div>
      )}
      {comments.length === 0 ? (
        <div className="ryuseigai-no-comments">まだ誰も何も言っていない。沈黙だけがここにある。</div>
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
                <span className="ryuseigai-comment-vote">
                  {c.vote === -1000 ? 'おまえは存在しない' : 'なぜ生まれてきた？'}
                </span>{' '}
                {c.trip && <span className="comment-host">＜{c.trip.replace('◆', '')}＞</span>}{' '}
                <span className="comment-date">{formatDate(c.date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 声を刻むフォーム（流星垓独自） */}
      <div className="comment-form ryuseigai-comment-form">
        <form onSubmit={handleSubmit} className="ryuseigai-form">
          <div className="ryuseigai-form-title">■ 声を刻む</div>
          <textarea
            value={commentText}
            onChange={(e) => {
              setCommentText(e.target.value);
              if (formError) setFormError('');
            }}
            className="ryuseigai-textarea"
            maxLength={MAX_COMMENT_LENGTH}
            aria-invalid={!!formError}
            aria-describedby={formError ? 'ryuseigai-comment-error' : 'ryuseigai-comment-count'}
          />
          <div id="ryuseigai-comment-count" className="comment-form-count">
            {commentText.length.toLocaleString()} / {MAX_COMMENT_LENGTH} 文字
          </div>
          {formError && (
            <div id="ryuseigai-comment-error" className="form-field-error" role="alert">{formError}</div>
          )}
          <div className="ryuseigai-form-row">
            <b>■ 名</b>{' '}
            <input
              type="text"
              value={commentName}
              onChange={(e) => setCommentName(e.target.value)}
              placeholder="名無し（トリップ: 名前#pass）"
              className="ryuseigai-input"
            />
          </div>
          <div className="ryuseigai-form-row">
            <b>■ 断罪</b>{' '}
            <select value={vote} onChange={(e) => setVote(Number(e.target.value))} className="ryuseigai-select">
              <option value={-500}>なぜ生まれてきた？ (-500)</option>
              <option value={-1000}>おまえは存在しない (-1000)</option>
            </select>
          </div>
          <div className="comment-form-actions">
            <button type="submit" className="ryuseigai-button comment-form-action-primary" disabled={isSubmitting}>
              {isSubmitting ? '刻み中...' : '刻む'}
            </button>
          </div>
        </form>
      </div>

      {/* 戻る */}
      <div className="ryuseigai-nav-bottom">
        <a href={BASE_PATH + '/ryuseigai'} onClick={(e) => { e.preventDefault(); navigate('/ryuseigai'); }} className="ryuseigai-back-link">← 流星垓へ戻る</a>
      </div>
    </div>
  );
};
