import React from 'react';
import { Novel, Comment } from '../types';
import { formatStarRating, formatDate } from '../utils';

interface NovelListProps {
  novels: Novel[];
  comments: Comment[];
}

export const NovelList: React.FC<NovelListProps> = ({ novels, comments }) => {
  return (
    <div>
      <table className="classic-table">
        <thead>
          <tr>
            <th>Title</th>
            <th style={{ width: 130 }}>投稿者</th>
            <th style={{ width: 160 }}>日付</th>
            <th style={{ width: 140 }}>スコア</th>
          </tr>
        </thead>
        <tbody>
          {novels.map((novel, index) => {
            const novelComments = comments.filter((c) => c.novelId === novel.id);
            const { stars, score } = formatStarRating(novelComments);

            return (
              <tr key={novel.id}>
                <td>
                  <a href={`#read/${novel.id}`} className="novel-title">
                    {novel.title}
                  </a>
                  {index < 2 && <span className="new-badge">NEW!</span>}
                  <div style={{ fontSize: 12, color: '#555' }}>
                    [{novelComments.length} 件] {novel.author}
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}>{novel.author}</td>
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: 13 }}>
                  {formatDate(novel.date)}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className="star-rating">{stars}</span>
                  <div className="star-score">{score}</div>
                </td>
              </tr>
            );
          })}
          {novels.length === 0 && (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: 18 }}>
                投稿がありません。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
