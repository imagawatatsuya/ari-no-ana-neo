import React, { useMemo } from 'react';
import { NovelListState } from '../types';
import { formatDate } from '../utils';
import { BASE_PATH, navigate } from '../router';

interface RyuseigaiListProps {
  state: NovelListState;
}

/** 流星垓の初期ポイント */
const RYUSEIGAI_BASE_SCORE = -300;

/** Fisher-Yates シャッフル（アクセスごとにランダム順） */
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const RyuseigaiList: React.FC<RyuseigaiListProps> = ({ state }) => {
  const novels = state.status === 'success' ? state.items : [];
  const shuffled = useMemo(() => shuffle(novels), [novels]);
  const stale = state.status === 'success' && state.stale;

  if (state.status === 'loading') {
    return (
      <div className="ryuseigai-shell">
        <div className="ryuseigai-panel" style={{ padding: 18, textAlign: 'center' }} role="status" aria-busy="true">
          ……
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="ryuseigai-shell">
        <div className="ryuseigai-panel" style={{ padding: 18, textAlign: 'center' }} role="alert">
          流星垓の一覧を取得できませんでした。
        </div>
      </div>
    );
  }

  return (
    <div className="ryuseigai-shell">
      <div className="ryuseigai-panel">
        <div className="ryuseigai-header">
          <h1 className="ryuseigai-title">流 星 垓</h1>
          <div className="ryuseigai-epigraph">
            ここに捨てられたものは、まだ息をしている。<br />
            救済はない。ただ、在る。
          </div>
        </div>

        {stale && (
          <div className="list-cache-notice" role="status" aria-live="polite">
            前回取得した一覧を表示しています。最新情報を確認中です。
          </div>
        )}

        {state.status === 'empty' || shuffled.length === 0 ? (
          <div className="ryuseigai-empty">
            まだ何も捨てられていない。
          </div>
        ) : (
          <div className="ryuseigai-entries">
            {shuffled.map((novel) => {
              const score = RYUSEIGAI_BASE_SCORE + novel.voteSum;
              return (
                <div className="ryuseigai-entry" key={novel.id}>
                  <a
                    href={BASE_PATH + `/ryuseigai/read/${novel.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/ryuseigai/read/${novel.id}`);
                    }}
                    className="ryuseigai-entry-link"
                  >
                    {novel.title}
                  </a>
                  <span className="ryuseigai-entry-score">{score}</span>
                  <div className="ryuseigai-entry-meta">
                    {novel.author} ／ {formatDate(novel.date)} ／ 声 {novel.commentCount}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="ryuseigai-footer">
          出口はない。来た道を戻るしかない。
        </div>
      </div>
    </div>
  );
};
