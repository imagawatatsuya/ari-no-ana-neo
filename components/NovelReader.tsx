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
  const [vote, setVote] = useState<number>(0);
  
  const { total, count } = calculateScore(comments);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (commentText.length > MAX_COMMENT_LENGTH) {
      alert(`コメントが長すぎます！ (${commentText.length}/${MAX_COMMENT_LENGTH})`);
      return;
    }

    const { name, trip } = generateTrip(commentName);
    const newComment: Comment = {
      id: Date.now().toString(),
      novelId: novel.id,
      name: trip ? `${name} ${trip}` : name,
      text: commentText,
      date: new Date().toISOString(),
      vote
    };
    onComment(newComment);
    setCommentText('');
    setVote(0); // Reset to normal
    alert('投票・コメントありがとうございます。');
  };

  return (
    <div className="w-full">
      <div className="mb-4 text-sm">
        <a href="#">&laquo; 一覧に戻る</a>
      </div>

      {/* Title Block */}
      <div className="bg-[#D0D0E0] border border-gray-600 p-2 mb-4">
        <h2 className="text-xl font-bold text-[#000080] mb-1">{novel.title}</h2>
        <div className="text-xs text-gray-700 flex justify-between">
          <span>作者: <b>{novel.author}</b> {novel.trip && <span className="text-gray-500 text-[10px]">{novel.trip}</span>}</span>
          <span>投稿日: {formatDate(novel.date)}</span>
        </div>
      </div>

      {/* Body Text */}
      <div className="bg-white border-l-4 border-gray-300 p-4 mb-8 min-h-[200px]">
        {/* ここを書き換えました */}
        <FootnoteRenderer content={novel.body} />
      </div>

      {/* Stats Bar */}
      <div className="bg-[#F0F0F0] border border-gray-400 p-2 mb-6 text-xs text-center text-black">
        総合点: <b className={total < 0 ? 'text-red-600' : 'text-blue-600'}>{total}</b> 
        {' '}| 票: {count} | 閲覧: {novel.viewCount}
      </div>

      {/* Comments Section */}
      <div className="mb-8">
        <h3 className="text-[#800000] font-bold border-b border-[#800000] mb-2 pb-1">
          ■ 読者の声
        </h3>
        {comments.length === 0 ? (
          <p className="text-gray-500 italic text-xs">コメントはまだありません。</p>
        ) : (
          <ul className="space-y-2">
            {comments.map(c => (
              <li key={c.id} className="bg-[#F9F9F9] border border-dotted border-gray-400 p-2 text-sm">
                <div className="mb-1 font-bold text-[#004000]">
                  {c.name} <span className="font-normal text-gray-500 text-xs">[{formatDate(c.date)}]</span>
                  <span className={`ml-2 text-xs ${c.vote < 0 ? 'text-red-500' : c.vote > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                   (評価: {c.vote > 0 ? '+' : ''}{c.vote})
                  </span>
                </div>
                <div className="whitespace-pre-wrap pl-2 text-[#333333]">{c.text}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Post Comment Form */}
      <form onSubmit={handleSubmit} className="bg-[#E0E0E0] border border-gray-500 p-3 text-black">
        <div className="font-bold text-[#800000] mb-2 text-sm">■ 感想・投票</div>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="w-20 align-top pt-1">名前:</td>
              <td>
                <input 
                  type="text" 
                  className="border border-gray-600 p-0.5 w-48 text-sm"
                  value={commentName}
                  onChange={e => setCommentName(e.target.value)}
                  placeholder="名無し"
                />
              </td>
            </tr>
            <tr>
              <td className="align-top pt-1">評価:</td>
              <td>
                <div className="flex gap-2 items-center text-xs">
                  <label><input type="radio" name="vote" checked={vote === 20} onChange={() => setVote(20)} /> とても良い(+20)</label>
                  <label><input type="radio" name="vote" checked={vote === 10} onChange={() => setVote(10)} /> 良い(+10)</label>
                  <label><input type="radio" name="vote" checked={vote === 0} onChange={() => setVote(0)} /> 普通(0)</label>
                  <label><input type="radio" name="vote" checked={vote === -10} onChange={() => setVote(-10)} /> 悪い(-10)</label>
                  <label><input type="radio" name="vote" checked={vote === -20} onChange={() => setVote(-20)} /> 最悪(-20)</label>
                </div>
              </td>
            </tr>
            <tr>
              <td className="align-top pt-1">コメント:</td>
              <td>
                <textarea 
                  className="border border-gray-600 w-full h-20 p-1 text-sm"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  maxLength={MAX_COMMENT_LENGTH}
                ></textarea>
                <div className={`text-right text-xs mt-1 ${commentText.length > MAX_COMMENT_LENGTH ? 'text-red-600' : 'text-gray-600'}`}>
                  {commentText.length} / {MAX_COMMENT_LENGTH} 文字
                </div>
              </td>
            </tr>
            <tr>
              <td></td>
              <td className="pt-2">
                <button type="submit" className="border-2 border-gray-400 bg-[#DDDDDD] px-4 py-0.5 text-sm active:border-gray-600 active:bg-[#CCCCCC]">
                  送信する
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </form>
    </div>
  );
};