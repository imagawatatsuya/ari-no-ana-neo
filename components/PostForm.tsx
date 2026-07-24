import React, { useState } from 'react';
import { Novel } from '../types';
import { generateTrip, formatManuscriptPages, formatDate, countBodyCharacters } from '../utils';
import { FootnoteRenderer, FootnoteMode } from './FootnoteRenderer';
import { BASE_PATH, navigate } from '../router';

interface PostFormProps {
  onPost: (novel: Novel) => void;
  footnoteMode?: FootnoteMode;
}

// 入力長制限
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 500;
const MAX_NAME = 100;
const MAX_BODY = 100000;

// 連投制限（秒）
const SPAM_COOLDOWN_MS = 60 * 1000;
const LAST_POST_KEY = 'bunsho_last_post_at';

export const PostForm: React.FC<PostFormProps> = ({ onPost, footnoteMode }) => {
  const [mode, setMode] = useState<'input' | 'preview'>('input');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // プレビュー用の生成データ
  const { name: authorName, trip } = generateTrip(name);

  const validate = (): boolean => {
    if (!title.trim()) {
      alert('タイトルは必須です。');
      return false;
    }
    if (!body.trim()) {
      alert('本文は必須です。');
      return false;
    }
    return true;
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setMode('preview');
  };

  const handleSubmit = () => {
    if (isSubmitting) return;

    // 連投制限チェック
    const lastPostAt = Number(sessionStorage.getItem(LAST_POST_KEY) || 0);
    if (lastPostAt && Date.now() - lastPostAt < SPAM_COOLDOWN_MS) {
      const remainSec = Math.ceil((SPAM_COOLDOWN_MS - (Date.now() - lastPostAt)) / 1000);
      alert(`連続投稿は${remainSec}秒後に再度お試しください。`);
      return;
    }

    setIsSubmitting(true);
    sessionStorage.setItem(LAST_POST_KEY, String(Date.now()));

    onPost({
      id: Date.now().toString(),
      title: title.trim(),
      description: description.trim() || undefined,
      author: authorName,
      trip,
      body,
      date: new Date().toISOString(),
      viewCount: 0,
    });
  };

  const handleBack = () => {
    setMode('input');
  };

  // ===== プレビュー画面 =====
  if (mode === 'preview') {
    const previewDate = formatDate(new Date().toISOString());
    const pageCount = formatManuscriptPages(body);

    return (
      <div>
        <div style={{ marginBottom: 6 }}>
          <a href={BASE_PATH + '/'} onClick={(e) => { e.preventDefault(); handleBack(); }}>&nbsp;修正する</a>
        </div>

        {/* 作品ページと同一レイアウト */}
        <table className="article-table">
          <tbody>
            <tr>
              <td className="article-title">{title}</td>
            </tr>
            {pageCount && (
              <tr>
                <td className="article-page-count">{pageCount}</td>
              </tr>
            )}
            <tr>
              <td className={description.trim() ? 'article-subtitle' : 'article-subtitle article-subtitle-empty'}
                  aria-hidden={!description.trim() || undefined}>
                {description.trim() || 'なし'}
              </td>
            </tr>
            <tr>
              <td className="article-body">
                <FootnoteRenderer content={body} footnoteMode={footnoteMode} />
              </td>
            </tr>
          </tbody>
        </table>

        <div className="article-date" style={{ textAlign: 'right' }}>{previewDate} 公開（予定）</div>

        <div style={{ padding: '4px 8px', fontSize: 16 }}>
          <b>■作者</b>{trip && <span>＜{trip.replace('◆', '')}＞</span>} <b>からのメッセージ</b>
          <div style={{ marginLeft: '3%' }}>{authorName}</div>
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button type="button" className="classic-button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? '送信中...' : '投稿する'}
          </button>{' '}
          <button type="button" className="classic-button" onClick={handleBack}>修正する</button>
        </div>
      </div>
    );
  }

  // ===== 入力画面 =====
  const livePageCount = formatManuscriptPages(body);

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <a href={BASE_PATH + '/'} onClick={(e) => { e.preventDefault(); navigate('/'); }}>&nbsp;戻る</a>
      </div>
      <div className="section-title">■ 新規投稿</div>
      <form onSubmit={handlePreview} style={{ marginTop: 6 }}>
        <table className="form-table">
          <tbody>
            <tr>
              <td className="form-label">タイトル</td>
              <td>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={MAX_TITLE}
                  style={{ width: '100%' }}
                />
              </td>
            </tr>
            <tr>
              <td className="form-label">メッセージ</td>
              <td>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={MAX_DESCRIPTION}
                  placeholder="作品ページ上部に表示される自由記述欄（任意）"
                  style={{ width: '100%' }}
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
                  maxLength={MAX_NAME}
                  placeholder="名無し（トリップ: 名前#pass）"
                  style={{ width: '100%' }}
                />
              </td>
            </tr>
            <tr>
              <td className="form-label">本文</td>
              <td>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={MAX_BODY}
                  style={{ minHeight: 280 }}
                />
                <div style={{ fontSize: 13, marginTop: 2, color: 'var(--point-gray)', display: 'flex', gap: 12 }}>
                  <span>文字数: {countBodyCharacters(body).toLocaleString()}文字</span>
                  {livePageCount && <span>原稿用紙: {livePageCount}</span>}
                </div>
              </td>
            </tr>
            <tr>
              <td />
              <td style={{ textAlign: 'center' }}>
                <button type="submit" className="classic-button">プレビュー</button>
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
