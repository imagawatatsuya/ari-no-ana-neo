import React, { useState } from 'react';
import { Novel } from '../types';
import { generateTrip } from '../utils';

interface PostFormProps {
  onPost: (novel: Novel) => void;
}

export const PostForm: React.FC<PostFormProps> = ({ onPost }) => {
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [body, setBody] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) {
      alert('タイトルと本文は必須です。');
      return;
    }

    const { name: authorName, trip } = generateTrip(name);
    onPost({
      id: Date.now().toString(),
      title,
      author: authorName,
      trip,
      body,
      date: new Date().toISOString(),
      viewCount: 0,
    });
  };

  return (
    <div>
      <div className="section-title">■ 新規投稿フォーム</div>
      <form onSubmit={handleSubmit}>
        <table className="classic-table">
          <tbody>
            <tr>
              <td className="form-label">タイトル</td>
              <td>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%' }} />
              </td>
            </tr>
            <tr>
              <td className="form-label">名前</td>
              <td>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="名無し（トリップ: 名前#pass）"
                  style={{ width: '360px', maxWidth: '100%' }}
                />
              </td>
            </tr>
            <tr>
              <td className="form-label">本文</td>
              <td>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 260 }} />
              </td>
            </tr>
            <tr>
              <td />
              <td>
                <button type="submit" className="classic-button">投稿する</button>{' '}
                <a href="#">キャンセル</a>
              </td>
            </tr>
          </tbody>
        </table>
      </form>

      <div className="legend-box" style={{ marginTop: 10 }}>
        ※ HTMLタグは使えません。改行はそのまま保持されます。
      </div>
    </div>
  );
};
