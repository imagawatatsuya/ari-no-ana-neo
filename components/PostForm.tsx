import React, { useState } from 'react';
import { Novel } from '../types';
import { generateTrip } from '../utils';

interface PostFormProps {
  onPost: (novel: Novel) => void;
  onCancel: () => void;
}

export const PostForm: React.FC<PostFormProps> = ({ onPost, onCancel }) => {
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [body, setBody] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) {
      alert('Title and Body are required!');
      return;
    }

    const { name: authorName, trip } = generateTrip(name);

    const newNovel: Novel = {
      id: Date.now().toString(),
      title,
      author: authorName,
      trip,
      body,
      date: new Date().toISOString(),
      viewCount: 0,
    };

    onPost(newNovel);
  };

  return (
    <div className="w-full">
      <div className="bg-[#800000] text-white font-bold p-1 px-2 text-sm mb-2">
        ■ NEW SUBMISSION
      </div>

      <form onSubmit={handleSubmit} className="bg-[#EFEFEF] border border-gray-500 p-4 text-sm">
        
        <div className="mb-2">
          <label className="block font-bold text-gray-700 mb-1">Title</label>
          <input 
            type="text" 
            className="w-full border border-gray-600 p-1" 
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        <div className="mb-2">
          <label className="block font-bold text-gray-700 mb-1">Name (Tripcode support: Name#pass)</label>
          <input 
            type="text" 
            className="w-full border border-gray-600 p-1 max-w-xs"
            value={name}
            onChange={e => setName(e.target.value)} 
          />
        </div>

        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <label className="block font-bold text-gray-700">Body</label>
          </div>

          <textarea 
            className="w-full h-64 border border-gray-600 p-2 font-mono text-sm leading-normal"
            value={body}
            onChange={e => setBody(e.target.value)}
          ></textarea>
        </div>

        <div className="flex justify-center gap-4 mt-4">
          <button 
            type="submit" 
            className="bg-[#DDDDDD] border-2 border-gray-500 px-6 py-1 font-bold active:bg-[#AAAAAA] hover:bg-[#EAEAEA]"
          >
            POST NOVEL
          </button>
          <button 
            type="button" 
            onClick={onCancel}
            className="text-red-800 underline text-xs self-center"
          >
            Cancel
          </button>
        </div>
      </form>

      <div className="mt-4 text-xs text-gray-600">
        * HTML tags are not allowed.<br/>
        * Please do not post offensive content.<br/>
        * The administrator is not responsible for lost data.
      </div>
    </div>
  );
};