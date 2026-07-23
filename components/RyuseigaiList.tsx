import React, { useMemo } from 'react';
import { Novel, Comment } from '../types';
import { formatDate } from '../utils';

interface RyuseigaiListProps {
  novels: Novel[];
  comments: Comment[];
}

/** 流星街の初期ポイント */
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

export const RyuseigaiList: React.FC<RyuseigaiListProps> = ({ novels, comments }) => {
  // アクセスごとにランダム順（マウント時にシャッフル）
  const shuffled = useMemo(() => shuffle(novels), [novels]);

  const getScore = (novelId: string): number => {
    const novelComments = comments.filter((c) => c.novelId === novelId);
    const voteSum = novelComments.reduce((acc, c) => acc + c.vote, 0);
    return RYUSEIGAI_BASE_SCORE + voteSum;
  };

  return (
    <div className="ryuseigai-shell">
      <div className="ryuseigai-panel">
        {/* 流星街ヘッダ */}
        <div className="ryuseigai-header">
          <h1 className="ryuseigai-title">流 星 街</h1>
          <div className="ryuseigai-subtitle">― 芥溜 ―</div>
          <div className="ryuseigai-epigraph">
            ここに捨てられたものは、まだ息をしている。<br />
            救済はない。ただ、在る。
          </div>
        </div>

        {/* 作品一覧: ページングなし・ランダム順 */}
        {shuffled.length === 0 ? (
          <div className="ryuseigai-empty">
            まだ何も捨てられていない。
          </div>
        ) : (
          <div className="ryuseigai-entries">
            {shuffled.map((novel) => {
              const score = getScore(novel.id);
              const commentCount = comments.filter((c) => c.novelId === novel.id).length;
              return (
                <div className="ryuseigai-entry" key={novel.id}>
                  <a href={`#ryuseigai/read/${novel.id}`} className="ryuseigai-entry-link">
                    {novel.title}
                  </a>
                  <span className="ryuseigai-entry-score">{score}</span>
                  <div className="ryuseigai-entry-meta">
                    {novel.author} ／ {formatDate(novel.date)} ／ 声 {commentCount}
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
