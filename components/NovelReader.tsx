import React, { useState } from 'react';
import { Novel, Comment } from '../types';
import { calculateScore, formatDate } from '../utils';
import { FootnoteRenderer } from './FootnoteRenderer';

interface NovelReaderProps {
  novel: Novel;
  comments: Comment[];
  onComment: (comment: Comment) => void;
}

const MAX_COMMENT_LENGTH = 500;

const voteLabel = (v: number): string => {
  switch (v) {
    case 2: return 'とても良い';
    case 1: return '良い';
    case 0: return '普通';
    case -1: return '良くない';
    case -2: return '最悪';
    default: return '普通';
  }
};

const badgeClass = (v: number): string => {
  if (v >= 1) return 'comment-badge comment-badge-positive';
  if (v <= -1) return 'comment-badge comment-badge-negative';
  return 'comment-badge comment-badge-neutral';
};

export const NovelReader: React.FC<NovelReaderProps> = ({ novel, comments, onComment }) => {
  const [commentText, setCommentText] = useState('');
  const [vote, setVote] = useState(0);

  const { total, count } = calculateScore(comments);

  const voteBreakdown = {
    best: comments.filter((c) => c.vote === 2).length,
    good: comments.filter((c) => c.vote === 1).length,
    normal: comments.filter((c) => c.vote === 0).length,
    bad: comments.filter((c) => c.vote === -1).length,
    worst: comments.filter((c) => c.vote === -2).length,
  };

  // Star display
  const avg = count > 0 ? total / count : 0;
  const normalized = Math.round(((avg + 2) / 4) * 5);
  const filled = Math.max(0, Math.min(5, normalized));
  const starsOn = '★'.repeat(filled);
  const starsOff = '★'.repeat(5 - filled);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.length > MAX_COMMENT_LENGTH) {
      alert(`コメントが長すぎます (${commentText.length}/${MAX_COMMENT_LENGTH})`);
      return;
    }

    onComment({
      id: Date.now().toString(),
      novelId: novel.id,
      name: '',
      text: commentText,
      date: new Date().toISOString(),
      vote,
    });

    setCommentText('');
    setVote(0);
    alert('感想を受け付けました。');
  };

  return (
    <div>
      {/* 戻る */}
      <div style={{ marginBottom: 6 }}>
        <a href="#">&lt;&lt; 戻る</a>
      </div>

      {/* 記事テーブル */}
      <table className="article-table">
        <tbody>
          {/* タイトル */}
          <tr>
            <td className="article-title">{novel.title}</td>
          </tr>
          {/* 本文 */}
          <tr>
            <td className="article-body">
              <FootnoteRenderer content={novel.body} />
            </td>
          </tr>
          {/* 日付 */}
          <tr>
            <td className="article-date" style={{ textAlign: 'right' }}>{formatDate(novel.date)} 公開</td>
          </tr>
          {/* 作者メッセージ */}
          <tr>
            <td style={{ padding: '4px 8px' }}>
              <dl style={{ margin: 0 }}>
                <dt style={{ fontSize: 16 }}>
                  <b>■作者</b>{novel.trip && <span>＜{novel.trip.replace('◆', '')}＞</span>} <b>からのメッセージ</b>
                </dt>
                <dd style={{ marginLeft: '3%', fontSize: 16, margin: 0, paddingLeft: '3%' }}>
                  {novel.author || 'なし'}
                </dd>
              </dl>
            </td>
          </tr>
        </tbody>
      </table>

      {/* POINT ボックス */}
      <div className="point-box">
        現在のPOINT [ <span className="point-value">{total}</span> ] 投票数 [ {count} ]
        <div>
          <span className="stars-on">{starsOn}</span>
          <span className="stars-off">{starsOff}</span>
        </div>
        <div className="point-breakdown">
          内訳： とても良い [ {voteBreakdown.best} ] 良い [ {voteBreakdown.good} ] 普通 [ {voteBreakdown.normal} ] 良くない [ {voteBreakdown.bad} ] 最悪 [ {voteBreakdown.worst} ]
        </div>
      </div>

      {/* 感想・批評 */}
      <div className="section-title">感想・批評</div>
      {comments.length === 0 ? (
        <div style={{ fontSize: 14, padding: '8px 4px' }}>まだ感想はありません。</div>
      ) : (
        <div>
          {[...comments].reverse().map((c, idx) => (
            <div className="comment-block" key={c.id}>
              <div className="comment-text">{c.text}</div>
              <div className="comment-footer">
                <span className="comment-number">{comments.length - idx}:</span>{' '}
                <span className={badgeClass(c.vote)}>{voteLabel(c.vote)}</span>{' '}
                <span className="comment-host">{c.name}</span>{' '}
                <span className="comment-date">{formatDate(c.date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 感想投稿フォーム */}
      <div style={{ height: 14 }} />
      <form onSubmit={handleSubmit}>
        <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>■感想・批評(改行有効）</div>
        <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} style={{ minHeight: 120, width: '100%' }} maxLength={MAX_COMMENT_LENGTH} />
        <div style={{ marginTop: 6, fontSize: 16 }}>
          <b>■採点</b>{' '}
          <select value={vote} onChange={(e) => setVote(Number(e.target.value))}>
            <option value={0}>採点しない</option>
            <option value={2}>とても良い</option>
            <option value={1}>良い</option>
            <option value={-1}>良くない</option>
            <option value={-2}>最悪</option>
          </select>{' '}
          <span style={{ fontSize: 13, color: '#666' }}>(採点はひとり１回まで。２回目以降の採点や作者の採点は集計されません)</span>
        </div>
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <button type="submit" className="classic-button">投稿</button>{' '}
          <button type="button" className="classic-button" onClick={() => { setCommentText(''); setVote(0); }}>クリア</button>
        </div>
      </form>

      {/* 戻る + 管理者用削除セクション */}
      <div style={{ marginTop: 12 }}>
        <a href="#">&lt;&lt; 戻る</a>
      </div>
      <hr style={{ border: '0', borderTop: '1px inset #999', margin: '8px 0' }} />
      <div style={{ fontSize: 14 }}>
        [ <a href="#admin">感想記事削除</a> ]{' '}
        <input type="password" placeholder="PASSWORD" style={{ width: 120 }} readOnly onClick={() => { window.location.hash = '#admin'; }} />{' '}
        <button type="button" className="classic-button" onClick={() => { window.location.hash = '#admin'; }}>管理者用</button>
      </div>
    </div>
  );
};
