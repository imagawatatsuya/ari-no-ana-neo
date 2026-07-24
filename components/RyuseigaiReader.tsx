import React, { useState } from 'react';
import { Novel, Comment } from '../types';
import { formatDate, generateTrip, formatManuscriptPages } from '../utils';
import { FootnoteRenderer, FootnoteMode } from './FootnoteRenderer';

interface RyuseigaiReaderProps {
  novel: Novel;
  comments: Comment[];
  onComment: (comment: Comment) => void;
  footnoteMode?: FootnoteMode;
}

const MAX_COMMENT_LENGTH = 500;

/** 流星垓の初期ポイント */
const RYUSEIGAI_BASE_SCORE = -300;

export const RyuseigaiReader: React.FC<RyuseigaiReaderProps> = ({ novel, comments, onComment, footnoteMode }) => {
  const [commentText, setCommentText] = useState('');
  const [commentName, setCommentName] = useState('');
  const [vote, setVote] = useState(-500);

  const voteSum = comments.reduce((acc, c) => acc + c.vote, 0);
  const totalScore = RYUSEIGAI_BASE_SCORE + voteSum;

  const countWhy = comments.filter((c) => c.vote === -500).length;
  const countNotExist = comments.filter((c) => c.vote === -1000).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.length > MAX_COMMENT_LENGTH) {
      alert(`コメントが長すぎます (${commentText.length}/${MAX_COMMENT_LENGTH})`);
      return;
    }

    const { trip } = generateTrip(commentName);
    onComment({
      id: Date.now().toString(),
      novelId: novel.id,
      name: '',
      trip,
      text: commentText,
      date: new Date().toISOString(),
      vote,
    });

    setCommentText('');
    setCommentName('');
    setVote(-500);
    alert('刻んだ。');
  };

  return (
    <div className="ryuseigai-shell">
      {/* 戻る */}
      <div style={{ marginBottom: 6 }}>
        <a href="#ryuseigai" className="ryuseigai-back-link">← 流星垓へ戻る</a>
      </div>

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
          <tr>
            <td className="article-body">
              <FootnoteRenderer content={novel.body} footnoteMode={footnoteMode} />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="article-date" style={{ textAlign: 'right' }}>{formatDate(novel.date)} に捨てられた</div>

      <div style={{ padding: '4px 8px', fontSize: 16 }}>
        <b>■ 捨てた者</b>{novel.trip && <span>＜{novel.trip.replace('◆', '')}＞</span>}
        <div style={{ marginLeft: '3%' }}>{novel.author || '名無し'}</div>
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
      <div className="ryuseigai-section-title">声</div>
      {comments.length === 0 ? (
        <div className="ryuseigai-no-comments">まだ誰も何も言っていない。沈黙だけがここにある。</div>
      ) : (
        <div>
          {[...comments].reverse().map((c, idx) => (
            <div className="comment-block" key={c.id}>
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
      <div style={{ height: 14 }} />
      <form onSubmit={handleSubmit} className="ryuseigai-form">
        <div className="ryuseigai-form-title">■ 声を刻む</div>
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          className="ryuseigai-textarea"
          maxLength={MAX_COMMENT_LENGTH}
        />
        <div style={{ marginTop: 6 }}>
          <b>■ 名</b>{' '}
          <input
            type="text"
            value={commentName}
            onChange={(e) => setCommentName(e.target.value)}
            placeholder="名無し（トリップ: 名前#pass）"
            className="ryuseigai-input"
          />
        </div>
        <div style={{ marginTop: 6 }}>
          <b>■ 断罪</b>{' '}
          <select value={vote} onChange={(e) => setVote(Number(e.target.value))} className="ryuseigai-select">
            <option value={-500}>なぜ生まれてきた？ (-500)</option>
            <option value={-1000}>おまえは存在しない (-1000)</option>
          </select>
        </div>
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <button type="submit" className="ryuseigai-button">刻む</button>
        </div>
      </form>

      {/* 戻る */}
      <div style={{ marginTop: 12 }}>
        <a href="#ryuseigai" className="ryuseigai-back-link">← 流星垓へ戻る</a>
      </div>
    </div>
  );
};
