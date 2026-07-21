import React, { useState } from 'react';
import { Novel } from '../types';
import { generateTrip } from '../utils';

interface PostFormProps {
  onPost: (novel: Novel) => void;
}

export const PostForm: React.FC<PostFormProps> = ({ onPost }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
      description,
      author: authorName,
      trip,
      body,
      date: new Date().toISOString(),
      viewCount: 0,
    });
  };

  return (
    <div>
      <div className="section-title">新規投稿</div>
      <form onSubmit={handleSubmit} style={{ marginTop: 6 }}>
        <table className="form-table">
          <tbody>
            <tr>
              <td className="form-label">Title</td>
              <td>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%' }} />
              </td>
            </tr>
            <tr>
              <td className="form-label">メッセージ</td>
              <td>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="作品ページ上部に表示される自由記述欄"
                  style={{ width: '360px', maxWidth: '100%' }}
                />
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

      <div style={{ marginTop: 6, fontSize: 12 }}>
        ※ HTMLタグは使えません。改行はそのまま保持されます。
      </div>
    </div>
  );
};
