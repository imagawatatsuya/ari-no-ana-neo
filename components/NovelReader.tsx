import React, { useState } from 'react';
import { Novel, Comment } from '../types';
import { calculateScore, formatDate, generateTrip, formatManuscriptPages } from '../utils';
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
  const [commentName, setCommentName] = useState('');
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
    setVote(0);
    alert('感想を受け付けました。');
  };

  return (
    <div>
      {/* 戻る: 元サイト <a href="./antho.cgi">&nbsp;戻る</a> */}
      <div style={{ marginBottom: 6 }}>
        <a href="#" className="back-link">&nbsp;戻る</a>
      </div>

      {/* 記事テーブル: 元サイト <table width="90%" cellspacing="4" cellpadding="8" align="center"> */}
      <table className="article-table">
        <tbody>
          {/* タイトル: .font_title { font-size:240%; font-weight:bold; color:#444444 } */}
          <tr>
            <td className="article-title">{novel.title}</td>
          </tr>
          {/* 原稿用紙換算枚数: 元サイト【N 枚】表示 / 1枚未満表示 */}
          {formatManuscriptPages(novel.body) && (
            <tr>
              <td className="article-page-count">{formatManuscriptPages(novel.body)}</td>
            </tr>
          )}
          {/* メッセージバー: 元サイト <td bgcolor="#D3CEC0" align="center"><span class="font_discription"> — 自由記述 */}
          <tr>
            <td className={novel.description ? 'article-subtitle' : 'article-subtitle article-subtitle-empty'}>
              {novel.description || 'なし'}
            </td>
          </tr>
          {/* 本文: .font_body { font-size:100%; line-height:150% } */}
          <tr>
            <td className="article-body">
              <FootnoteRenderer content={novel.body} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 日付: 元サイトはテーブル外・右寄せ */}
      <div className="article-date" style={{ textAlign: 'right' }}>{formatDate(novel.date)} 公開</div>

      {/* 作者識別: 元サイト「作者＜trip＞ からのメッセージ」 */}
      <div style={{ padding: '4px 8px', fontSize: 16 }}>
        <b>■作者</b>{novel.trip && <span>＜{novel.trip.replace('◆', '')}＞</span>} <b>からのメッセージ</b>
        <div style={{ marginLeft: '3%' }}>{novel.author || '名無し'}</div>
      </div>

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
                {c.trip && <span className="comment-host">＜{c.trip.replace('◆', '')}＞</span>}{' '}
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
          <b>■名前</b>{' '}
          <input type="text" value={commentName} onChange={(e) => setCommentName(e.target.value)} placeholder="名無し（トリップ: 名前#pass）" style={{ width: 260, maxWidth: '100%' }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 16 }}>
          <b>■採点</b>{' '}
          <select value={vote} onChange={(e) => setVote(Number(e.target.value))}>
            <option value={0}>採点しない</option>
            <option value={2}>とても良い</option>
            <option value={1}>良い</option>
            <option value={-1}>良くない</option>
            <option value={-2}>最悪</option>
          </select>
          <span className="vote-note" style={{ fontSize: 13, color: '#666' }}>(採点はひとり１回まで。２回目以降の採点や作者の採点は集計されません)</span>
        </div>
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <button type="submit" className="classic-button">投稿</button>{' '}
          <button type="button" className="classic-button" onClick={() => { setCommentText(''); setVote(0); }}>クリア</button>
        </div>
      </form>

      {/* 戻る: 元サイト <a href="./antho.cgi">&nbsp;戻る</a> */}
      <div style={{ marginTop: 12 }}>
        <a href="#" className="back-link">&nbsp;戻る</a>
      </div>
      <hr style={{ border: '0', borderTop: '1px inset #999', margin: '8px 0' }} />
      <div className="admin-inline-section" style={{ fontSize: 14 }}>
        <span>[ <a href="#admin">感想記事削除</a> ]</span>
        <input type="password" placeholder="PASSWORD" style={{ width: 120, maxWidth: '40%' }} readOnly onClick={() => { window.location.hash = '#admin'; }} />
        <button type="button" className="classic-button" onClick={() => { window.location.hash = '#admin'; }}>管理者用</button>
      </div>
    </div>
  );
};
