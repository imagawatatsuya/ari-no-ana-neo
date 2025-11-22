import React from 'react';
import { Novel, Comment } from '../types';
import { calculateScore, formatDate } from '../utils';

interface NovelListProps {
  novels: Novel[];
  comments: Comment[];
}

export const NovelList: React.FC<NovelListProps> = ({ novels, comments }) => {
  return (
    <div className="w-full">
      <div className="bg-[#EEEEEE] border border-gray-400 p-1 mb-2 text-xs font-bold text-[#800000]">
        ■ 投稿小説一覧
      </div>

      <table className="w-full border-collapse border border-gray-500 text-sm">
        <thead className="bg-[#E0E0E0]">
          <tr>
            <th className="border border-gray-500 px-2 py-1 w-12">No.</th>
            <th className="border border-gray-500 px-2 py-1 text-left">タイトル</th>
            <th className="border border-gray-500 px-2 py-1 w-32">作者</th>
            <th className="border border-gray-500 px-2 py-1 w-24">得点</th>
            <th className="border border-gray-500 px-2 py-1 w-32">投稿日</th>
          </tr>
        </thead>
        <tbody>
          {novels.map((novel, index) => {
            // Filter comments for this novel to calculate score
            const novelComments = comments.filter(c => c.novelId === novel.id);
            const { total, count } = calculateScore(novelComments);
            const scoreDisplay = count > 0 ? `${total}/${count}` : '-';
            const isNegative = total < 0;

            return (
              <tr key={novel.id} className="hover:bg-[#F8F8F8]">
                <td className="border border-gray-500 px-2 py-1 text-center">
                  {novels.length - index}
                </td>
                <td className="border border-gray-500 px-2 py-1">
                  <a 
                    href={`#read/${novel.id}`}
                    className="font-bold text-blue-800 hover:text-red-600 no-underline hover:underline"
                  >
                    {novel.title}
                  </a>
                  {/* New tag simulation */}
                  {index < 2 && <span className="text-red-600 text-[10px] ml-1 font-normal blink">新着!</span>}
                </td>
                <td className="border border-gray-500 px-2 py-1 truncate">
                  {novel.author}
                </td>
                <td className={`border border-gray-500 px-2 py-1 text-center font-mono ${isNegative ? 'text-red-600 font-bold' : 'text-blue-800'}`}>
                  {scoreDisplay}
                </td>
                <td className="border border-gray-500 px-2 py-1 text-xs text-center">
                  {formatDate(novel.date).split(' ')[0]}
                </td>
              </tr>
            );
          })}
          {novels.length === 0 && (
            <tr>
              <td colSpan={5} className="border border-gray-500 p-4 text-center text-gray-500">
                データベースに小説が見つかりません。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};