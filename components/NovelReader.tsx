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
      <div style={{ marginBottom: 8, fontSize: 12 }}>
        <a href="#">&lt;&lt; 一覧へ戻る</a>
      </div>

      <div className="read-title-box">
        <h2 className="read-title">{novel.title}</h2>
        <div className="read-sub">
          <span>
            作者: <b>{novel.author}</b> {novel.trip && <small>{novel.trip}</small>}
          </span>
          <span>投稿日: {formatDate(novel.date)}</span>
        </div>
      </div>

      <div className="body-box">
        <FootnoteRenderer content={novel.body} />
      </div>

      <div className="stat-bar">
        総合点: <b className={total < 0 ? 'score-neg' : 'score-pos'}>{total}</b> / 票数: {count} / 閲覧: {novel.viewCount}
      </div>

      <div className="section-title">■ 読者の感想</div>
      {comments.length === 0 ? (
        <div className="legend-box">まだ感想はありません。</div>
      ) : (
        <div>
          {comments.map((c) => (
            <div className="comment-item" key={c.id}>
              <div className="comment-name">
                {c.name} <small style={{ color: '#666' }}>[{formatDate(c.date)}]</small>{' '}
                <span className={c.vote < 0 ? 'score-neg' : 'score-pos'}>({c.vote >= 0 ? '+' : ''}{c.vote})</span>
              </div>
              <div className="comment-text">{c.text}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 10 }} />
      <div className="section-title">■ 感想・評価を送る</div>
      <form onSubmit={handleSubmit}>
        <table className="classic-table form-table">
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
                <label><input type="radio" checked={vote === 2} onChange={() => setVote(2)} /> +2</label>{' '}
                <label><input type="radio" checked={vote === 1} onChange={() => setVote(1)} /> +1</label>{' '}
                <label><input type="radio" checked={vote === 0} onChange={() => setVote(0)} /> 0</label>{' '}
                <label><input type="radio" checked={vote === -1} onChange={() => setVote(-1)} /> -1</label>{' '}
                <label><input type="radio" checked={vote === -2} onChange={() => setVote(-2)} /> -2</label>
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
      </form>
    </div>
  );
};
