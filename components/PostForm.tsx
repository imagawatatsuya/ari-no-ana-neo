import React, { useEffect, useState } from 'react';
import { Novel, SubmitResult } from '../types';
import { generateTrip, formatManuscriptPages, formatDate, countBodyCharacters } from '../utils';
import { FootnoteRenderer, FootnoteMode } from './FootnoteRenderer';
import { BASE_PATH, navigate } from '../router';
import { clearPostDraft, readPostDraft, writePostDraft } from '../lib/draftStorage';

interface PostFormProps {
  onPost: (novel: Novel) => Promise<SubmitResult>;
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

  useEffect(() => {
    const draft = readPostDraft();
    if (draft) {
      setTitle(draft.title);
      setDescription(draft.description);
      setName(draft.name);
      setBody(draft.body);
    }
  }, []);

  useEffect(() => {
    writePostDraft({ title, description, name, body });
  }, [title, description, name, body]);

  const { name: authorName, trip } = generateTrip(name);
  const livePageCount = formatManuscriptPages(body);
  const previewDate = formatDate(new Date().toISOString());
  const previewPageCount = formatManuscriptPages(body);

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

  const switchToPreview = () => {
    if (!validate()) return;
    setMode('preview');
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const lastPostAt = Number(sessionStorage.getItem(LAST_POST_KEY) || 0);
    if (lastPostAt && Date.now() - lastPostAt < SPAM_COOLDOWN_MS) {
      const remainSec = Math.ceil((SPAM_COOLDOWN_MS - (Date.now() - lastPostAt)) / 1000);
      alert(`連続投稿は${remainSec}秒後に再度お試しください。`);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onPost({
        id: Date.now().toString(),
        title: title.trim(),
        description: description.trim() || undefined,
        author: authorName,
        trip,
        body,
        date: new Date().toISOString(),
        viewCount: 0,
        commentCount: 0,
        voteSum: 0,
      });

      if (!result.ok) {
        alert(result.message);
        setIsSubmitting(false);
        return;
      }

      sessionStorage.setItem(LAST_POST_KEY, String(Date.now()));
      clearPostDraft();
      setTitle('');
      setDescription('');
      setName('');
      setBody('');
      setMode('input');
    } catch {
      alert('投稿中にエラーが発生しました。入力内容は保持されています。');
      setIsSubmitting(false);
    }
  };

  const handleSubmitClick = () => {
    if (!window.confirm('この内容で投稿しますか？')) return;
    void handleSubmit();
  };

  return (
    <div className="post-form">
      <div className="post-form-header">
        <a
          href={BASE_PATH + '/'}
          className="post-form-back"
          onClick={(e) => { e.preventDefault(); navigate('/'); }}
        >
          戻る
        </a>
        <div className="section-title">■ 新規投稿</div>
      </div>

      <div className="post-form-tabs" role="tablist" aria-label="投稿モード">
        <button
          type="button"
          role="tab"
          id="post-tab-input"
          aria-selected={mode === 'input'}
          aria-controls="post-panel-input"
          className={`post-form-tab${mode === 'input' ? ' post-form-tab--active' : ''}`}
          onClick={() => setMode('input')}
        >
          入力
        </button>
        <button
          type="button"
          role="tab"
          id="post-tab-preview"
          aria-selected={mode === 'preview'}
          aria-controls="post-panel-preview"
          className={`post-form-tab${mode === 'preview' ? ' post-form-tab--active' : ''}`}
          onClick={switchToPreview}
        >
          プレビュー
        </button>
      </div>

      <div
        id="post-panel-input"
        role="tabpanel"
        aria-labelledby="post-tab-input"
        className={`post-form-panel${mode !== 'input' ? ' post-form-panel--hidden' : ''}`}
        hidden={mode !== 'input'}
      >
        <form onSubmit={(e) => { e.preventDefault(); switchToPreview(); }}>
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
                  <div className="post-form-stats">
                    <span>文字数: {countBodyCharacters(body).toLocaleString()}文字</span>
                    {livePageCount && <span>原稿用紙: {livePageCount}</span>}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </form>

        <div className="post-form-note">
          ※ HTMLタグは使えません。改行はそのまま保持されます。
        </div>
      </div>

      <div
        id="post-panel-preview"
        role="tabpanel"
        aria-labelledby="post-tab-preview"
        className={`post-form-panel${mode !== 'preview' ? ' post-form-panel--hidden' : ''}`}
        hidden={mode !== 'preview'}
      >
        <table className="article-table">
          <tbody>
            <tr>
              <td className="article-title">{title}</td>
            </tr>
            {previewPageCount && (
              <tr>
                <td className="article-page-count">{previewPageCount}</td>
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

        <div className="post-form-author">
          <b>■作者</b>{trip && <span>＜{trip.replace('◆', '')}＞</span>} <b>からのメッセージ</b>
          <div style={{ marginLeft: '3%' }}>{authorName}</div>
        </div>
      </div>

      <div className="post-form-actions">
        {mode === 'input' ? (
          <button type="button" className="classic-button post-form-action-primary" onClick={switchToPreview}>
            プレビュー
          </button>
        ) : (
          <>
            <button
              type="button"
              className="classic-button post-form-action-primary"
              onClick={handleSubmitClick}
              disabled={isSubmitting}
            >
              {isSubmitting ? '送信中...' : '投稿する'}
            </button>
            <button type="button" className="classic-button" onClick={() => setMode('input')}>
              入力に戻る
            </button>
          </>
        )}
      </div>
    </div>
  );
};
