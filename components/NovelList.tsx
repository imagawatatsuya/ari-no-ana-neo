import React from 'react';
import { Novel, Comment } from '../types';
import { calculateScore, formatDate } from '../utils';

interface NovelListProps {
  novels: Novel[];
  comments: Comment[];
}

export const NovelList: React.FC<NovelListProps> = ({ novels, comments }) => {
  return (
    <div>
      <div className="section-title">■ 投稿文章一覧</div>
      <div className="legend-box">テキストサイト時代の見た目を再現した一覧テーブルです。タイトルをクリックすると本文へ移動します。</div>

      <table className="classic-table">
        <thead>
          <tr>
            <th style={{ width: 56 }}>No.</th>
            <th>タイトル</th>
            <th style={{ width: 150 }}>作者</th>
            <th style={{ width: 100 }}>得点/票</th>
            <th style={{ width: 170 }}>投稿日</th>
          </tr>
        </thead>
        <tbody>
          {novels.map((novel, index) => {
            const novelComments = comments.filter((c) => c.novelId === novel.id);
            const { total, count } = calculateScore(novelComments);

            return (
              <tr key={novel.id}>
                <td style={{ textAlign: 'center' }}>{novels.length - index}</td>
                <td>
                  <a href={`#read/${novel.id}`} className="novel-title">
                    {novel.title}
                  </a>
                  {index < 2 && <span className="new-badge">NEW!</span>}
                </td>
                <td>{novel.author}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={total < 0 ? 'score-neg' : 'score-pos'}>
                    {total}/{count}
                  </span>
                </td>
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{formatDate(novel.date)}</td>
              </tr>
            );
          })}
          {novels.length === 0 && (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', padding: 18 }}>
                投稿がありません。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
