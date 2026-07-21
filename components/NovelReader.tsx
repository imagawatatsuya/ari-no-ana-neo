import React, { useState } from 'react';
import { Novel, Comment } from '../types';
import { calculateScore, formatDate, generateTrip } from '../utils';
import { FootnoteRenderer } from './FootnoteRenderer';

interface NovelReaderProps {
  novel: Novel;
  comments: Comment[];
  onComment: (comment: Comment) => void;
}

const MAX_COMMENT_LENGTH = 500;

export const NovelReader: React.FC<NovelReaderProps> = ({ novel, comments, onComment }) => {
  const [commentName, setCommentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [vote, setVote] = useState(0);

  const { total, count } = calculateScore(comments);

  // 投票内訳を計算
  const voteBreakdown = {
    best: comments.filter((c) => c.vote === 2).length,
    good: comments.filter((c) => c.vote === 1).length,
    normal: comments.filter((c) => c.vote === 0).length,
    bad: comments.filter((c) => c.vote === -1).length,
    worst: comments.filter((c) => c.vote === -2).length,
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.length > MAX_COMMENT_LENGTH) {
      alert(`コメントが長すぎます (${commentText.length}/${MAX_COMMENT_LENGTH})`);
      return;
    }

    const { name, trip } = generateTrip(commentName);
    onComment({
      id: Date.now().toString(),
      novelId: novel.id,
      name: trip ? `${name} ${trip}` : name,
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
      <div style={{ marginBottom: 6, fontSize: 13 }}>
        <a href="#">&lt;&lt; 戻る</a>
      </div>

      {/* タイトルボックス */}
      <div className="read-title-box">
        <h2 className="read-title">{novel.title}</h2>
      </div>

      {/* 本文 */}
      <div className="body-box">
        <FootnoteRenderer content={novel.body} />
      </div>

      {/* 投稿日・作者 */}
      <div style={{ fontSize: 13, color: '#333', marginBottom: 6 }}>
        {formatDate(novel.date)} 投稿
      </div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        投稿者: <b>{novel.author}</b>{novel.trip && <span> {novel.trip}</span>}
      </div>

      {/* POINT表示 */}
      <div className="stat-bar">
        現在のPOINT [ <b>{total}</b> ] 投票数 [ {count} ]
        <div className="vote-breakdown">
          内訳: とても良い [ {voteBreakdown.best} ] 良い [ {voteBreakdown.good} ] 普通 [ {voteBreakdown.normal} ] 良くない [ {voteBreakdown.bad} ] 最低 [ {voteBreakdown.worst} ]
        </div>
      </div>

      {/* 感想・コメント一覧 */}
      <div className="section-title">感想・コメント</div>
      {comments.length === 0 ? (
        <div style={{ fontSize: 13, color: '#555', padding: '6px 4px' }}>まだ感想はありません。</div>
      ) : (
        <div>
          {[...comments].reverse().map((c, idx) => (
            <div className="comment-item" key={c.id}>
              <div className="comment-name">
                <span className="comment-number">{comments.length - idx}:</span>{' '}
                {c.name}{' '}
                <small style={{ color: '#666', fontWeight: 'normal' }}>{formatDate(c.date)}</small>
              </div>
              <div className="comment-text">{c.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* 感想投稿フォーム */}
      <div style={{ height: 12 }} />
      <div className="section-title">感想・評価を送る</div>
      <form onSubmit={handleSubmit}>
        <table className="classic-table">
          <tbody>
            <tr>
              <td className="form-label">名前</td>
              <td>
                <input type="text" value={commentName} onChange={(e) => setCommentName(e.target.value)} placeholder="名無し" style={{ width: 280, maxWidth: '100%' }} />
              </td>
            </tr>
            <tr>
              <td className="form-label">評価</td>
              <td>
                <label><input type="radio" checked={vote === 2} onChange={() => setVote(2)} /> とても良い</label>{' '}
                <label><input type="radio" checked={vote === 1} onChange={() => setVote(1)} /> 良い</label>{' '}
                <label><input type="radio" checked={vote === 0} onChange={() => setVote(0)} /> 普通</label>{' '}
                <label><input type="radio" checked={vote === -1} onChange={() => setVote(-1)} /> 良くない</label>{' '}
                <label><input type="radio" checked={vote === -2} onChange={() => setVote(-2)} /> 最低</label>
              </td>
            </tr>
            <tr>
              <td className="form-label">コメント</td>
              <td>
                <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} style={{ minHeight: 100 }} maxLength={MAX_COMMENT_LENGTH} />
                <div style={{ textAlign: 'right', fontSize: 12, color: '#666' }}>{commentText.length}/{MAX_COMMENT_LENGTH}</div>
              </td>
            </tr>
            <tr>
              <td />
              <td>
                <button type="submit" className="classic-button">送信</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          (投票はひとり1回まで。2回目以降の投票は前の投票に上書きされます)
        </div>
      </form>
    </div>
  );
};
