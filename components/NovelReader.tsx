import React, { useState } from 'react';
import { Novel, Comment } from '../types';
import { calculateScore, formatDate, generateTrip } from '../utils';

interface NovelReaderProps {
  novel: Novel;
  comments: Comment[];
  onBack: () => void;
  onComment: (comment: Comment) => void;
}

const MAX_COMMENT_LENGTH = 500;

export const NovelReader: React.FC<NovelReaderProps> = ({ novel, comments, onBack, onComment }) => {
  const [commentName, setCommentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [vote, setVote] = useState<number>(0);
  
  const { total, count } = calculateScore(comments);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (commentText.length > MAX_COMMENT_LENGTH) {
      alert(`Comment is too long! (${commentText.length}/${MAX_COMMENT_LENGTH})`);
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
    alert('Thank you for your vote/comment.');
  };

  return (
    <div className="w-full">
      <div className="mb-4 text-sm">
        <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>&laquo; Back to Index</a>
      </div>

      {/* Title Block */}
      <div className="bg-[#D0D0E0] border border-gray-600 p-2 mb-4">
        <h2 className="text-xl font-bold text-[#000080] mb-1">{novel.title}</h2>
        <div className="text-xs text-gray-700 flex justify-between">
          <span>Author: <b>{novel.author}</b> {novel.trip && <span className="text-gray-500 text-[10px]">{novel.trip}</span>}</span>
          <span>Date: {formatDate(novel.date)}</span>
        </div>
      </div>

      {/* Body Text */}
      <div className="bg-white border-l-4 border-gray-300 p-4 mb-8 min-h-[200px] whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-800">
        {novel.body}
      </div>

      {/* Stats Bar */}
      <div className="bg-[#F0F0F0] border border-gray-400 p-2 mb-6 text-xs text-center text-black">
        Total Score: <b className={total < 0 ? 'text-red-600' : 'text-blue-600'}>{total}</b> 
        {' '}| Votes: {count} | Views: {novel.viewCount}
      </div>

      {/* Comments Section */}
      <div className="mb-8">
        <h3 className="text-[#800000] font-bold border-b border-[#800000] mb-2 pb-1">
          ■ Voice of Readers
        </h3>
        {comments.length === 0 ? (
          <p className="text-gray-500 italic text-xs">No comments yet.</p>
        ) : (
          <ul className="space-y-2">
            {comments.map(c => (
              <li key={c.id} className="bg-[#F9F9F9] border border-dotted border-gray-400 p-2 text-sm">
                <div className="mb-1 font-bold text-[#004000]">
                  {c.name} <span className="font-normal text-gray-500 text-xs">[{formatDate(c.date)}]</span>
                  <span className={`ml-2 text-xs ${c.vote < 0 ? 'text-red-500' : c.vote > 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                   (Vote: {c.vote > 0 ? '+' : ''}{c.vote})
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
        <div className="font-bold text-[#800000] mb-2 text-sm">■ Post Comment & Vote</div>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="w-20 align-top pt-1">Name:</td>
              <td>
                <input 
                  type="text" 
                  className="border border-gray-600 p-0.5 w-48 text-sm"
                  value={commentName}
                  onChange={e => setCommentName(e.target.value)}
                  placeholder="Name#pass"
                />
              </td>
            </tr>
            <tr>
              <td className="align-top pt-1">Vote:</td>
              <td>
                <div className="flex gap-2 items-center text-xs">
                  <label><input type="radio" name="vote" checked={vote === 2} onChange={() => setVote(2)} /> Best(+2)</label>
                  <label><input type="radio" name="vote" checked={vote === 1} onChange={() => setVote(1)} /> Good(+1)</label>
                  <label><input type="radio" name="vote" checked={vote === 0} onChange={() => setVote(0)} /> Normal(0)</label>
                  <label><input type="radio" name="vote" checked={vote === -1} onChange={() => setVote(-1)} /> Bad(-1)</label>
                  <label><input type="radio" name="vote" checked={vote === -2} onChange={() => setVote(-2)} /> Worst(-2)</label>
                </div>
              </td>
            </tr>
            <tr>
              <td className="align-top pt-1">Comment:</td>
              <td>
                <textarea 
                  className="border border-gray-600 w-full h-20 p-1 text-sm"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  maxLength={MAX_COMMENT_LENGTH}
                ></textarea>
                <div className={`text-right text-xs mt-1 ${commentText.length > MAX_COMMENT_LENGTH ? 'text-red-600' : 'text-gray-600'}`}>
                  {commentText.length} / {MAX_COMMENT_LENGTH} characters
                </div>
              </td>
            </tr>
            <tr>
              <td></td>
              <td className="pt-2">
                <button type="submit" className="border-2 border-gray-400 bg-[#DDDDDD] px-4 py-0.5 text-sm active:border-gray-600 active:bg-[#CCCCCC]">
                  Submit
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </form>
    </div>
  );
};