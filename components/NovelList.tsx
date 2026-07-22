import React from 'react';
import { Novel, Comment } from '../types';
import { formatStarRating, formatDate } from '../utils';

interface NovelListProps {
  novels: Novel[];
  comments: Comment[];
}

export const NovelList: React.FC<NovelListProps> = ({ novels, comments }) => {
  return (
    <table className="classic-table">
      <thead>
        <tr>
          <th style={{ width: '70%' }}>Title</th>
          <th style={{ width: '12%' }}>投稿日</th>
          <th style={{ width: '6%' }}>感想</th>
          <th style={{ width: '12%' }}>ポイント</th>
        </tr>
      </thead>
      <tbody>
        {novels.map((novel, index) => {
          const novelComments = comments.filter((c) => c.novelId === novel.id);
          const { stars, score } = formatStarRating(novelComments);
          const starsOn = stars.replace(/☆/g, '');
          const starsOff = '★'.repeat(5 - starsOn.length);

          return (
            <React.Fragment key={novel.id}>
              {/* Row 1: Title / Date / Comments / Points */}
              <tr className="entry-title-row">
                <td>
                  <a href={`#read/${novel.id}`} className="entry-title-link">
                    {novel.title}
                  </a>
                </td>
                <td className="entry-date">{formatDate(novel.date)}</td>
                <td className="entry-comments">{novelComments.length}</td>
                <td className="entry-point">
                  <span className="stars-on" aria-hidden="true">{starsOn}</span>
                  <span className="stars-off" aria-hidden="true">{starsOff}</span>
                  <br />
                  <span className="point-score">{score}</span>
                </td>
              </tr>
              {/* Row 2: Meta (page count + author) */}
              <tr className="entry-meta-row">
                <td colSpan={4}>
                  ［ {novelComments.length} 件 ］ {novel.author}
                  {index < 2 && <span className="entry-new-badge">NEW!</span>}
                </td>
              </tr>
              {/* Separator HR */}
              {index < novels.length - 1 && (
                <tr>
                  <td colSpan={4} style={{ padding: 0 }}>
                    <hr className="entry-separator" />
                  </td>
                </tr>
              )}
            </React.Fragment>
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
  );
};
