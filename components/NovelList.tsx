import React from 'react';
import { NovelListState } from '../types';
import { formatStarRatingFromAggregate, formatDate } from '../utils';
import { navigate } from '../router';

const openNovel = (id: string) => navigate(`/read/${id}`);

const handleEntryKeyDown = (id: string, e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openNovel(id);
  }
};

interface NovelListProps {
  state: NovelListState;
  onRetry?: () => void;
}

export const NovelList: React.FC<NovelListProps> = ({ state, onRetry }) => {
  if (state.status === 'loading') {
    return (
      <div
        className="list-status-message"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        作品一覧を読み込んでいます……
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="list-status-message list-status-error" role="alert">
        <p>作品一覧を取得できませんでした。</p>
        <p>{state.message}</p>
        {state.cachedItems && state.cachedItems.length > 0 && (
          <p>前回取得した一覧を表示しています。</p>
        )}
        {onRetry && (
          <button type="button" className="classic-button" onClick={onRetry}>
            再読み込み
          </button>
        )}
      </div>
    );
  }

  const novels = state.status === 'success' ? state.items : [];
  const stale = state.status === 'success' && state.stale;

  return (
    <>
      {stale && (
        <div className="list-cache-notice" role="status" aria-live="polite">
          前回取得した一覧を表示しています。最新情報を確認中です。
        </div>
      )}
      <table className="classic-table">
        <thead>
          <tr>
            <th style={{ width: '70%' }}>Title</th>
            <th style={{ width: '12%' }}>投稿日</th>
            <th style={{ width: '6%' }}>感想</th>
            <th style={{ width: '12%' }}>ポイント</th>
          </tr>
        </thead>
        {state.status === 'empty' && (
          <tbody>
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: 18 }}>
                投稿がありません。
              </td>
            </tr>
          </tbody>
        )}
        {novels.map((novel, index) => {
          const { stars, score } = formatStarRatingFromAggregate(novel.voteSum, novel.commentCount);
          const starsOn = stars.replace(/☆/g, '');
          const starsOff = '★'.repeat(5 - starsOn.length);

          return (
            <tbody
              key={novel.id}
              className="entry-group"
              onClick={() => openNovel(novel.id)}
              onKeyDown={(e) => handleEntryKeyDown(novel.id, e)}
              tabIndex={0}
              role="link"
              aria-label={`${novel.title}を読む`}
            >
              <tr className="entry-title-row">
                <td>
                  <span className="entry-title-link">{novel.title}</span>
                </td>
                <td className="entry-date">{formatDate(novel.date)}</td>
                <td className="entry-comments">{novel.commentCount}</td>
                <td className="entry-point">
                  <span className="stars-on" aria-hidden="true">{starsOn}</span>
                  <span className="stars-off" aria-hidden="true">{starsOff}</span>
                  <br />
                  <span className="point-score">{score}</span>
                </td>
              </tr>
              <tr className="entry-meta-row">
                <td colSpan={4}>
                  ［ {novel.commentCount} 件 ］ {novel.author}
                  {index < 2 && <span className="entry-new-badge">NEW!</span>}
                </td>
              </tr>
            </tbody>
          );
        })}
      </table>
    </>
  );
};
