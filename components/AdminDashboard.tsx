import React, { useMemo, useState } from 'react';
import { Comment, Novel } from '../types';
import { formatDate } from '../utils';

interface AdminDashboardProps {
  novels: Novel[];
  comments: Comment[];
  hiddenNovelIds: string[];
  onEditNovel: (id: string, patch: Pick<Novel, 'title' | 'author' | 'trip' | 'body'>) => Promise<void>;
  onDeleteNovel: (id: string) => Promise<void>;
  onToggleHideNovel: (id: string, nextHidden: boolean) => Promise<void>;
  onResetSeedData: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  novels,
  comments,
  hiddenNovelIds,
  onEditNovel,
  onDeleteNovel,
  onToggleHideNovel,
  onResetSeedData,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [trip, setTrip] = useState('');
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const hiddenSet = useMemo(() => new Set(hiddenNovelIds), [hiddenNovelIds]);

  const startEdit = (novel: Novel) => {
    setEditingId(novel.id);
    setTitle(novel.title);
    setAuthor(novel.author);
    setTrip(novel.trip || '');
    setBody(novel.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setAuthor('');
    setTrip('');
    setBody('');
  };

  const handleSave = async () => {
    if (!editingId) return;
    if (!title.trim() || !body.trim()) {
      alert('タイトルと本文は必須です。');
      return;
    }

    setIsSaving(true);
    try {
      await onEditNovel(editingId, {
        title: title.trim(),
        author: author.trim() || '名無し',
        trip: trip.trim() || undefined,
        body,
      });
      cancelEdit();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('この投稿を削除します。関連コメントも削除されます。よろしいですか？')) return;
    await onDeleteNovel(id);
    if (editingId === id) cancelEdit();
  };

  const handleToggleHide = async (id: string, nextHidden: boolean) => {
    await onToggleHideNovel(id, nextHidden);
  };

  return (
    <div>
      <div className="section-title">■ 管理ダッシュボード</div>
      <div className="legend-box">投稿の編集・削除・非表示設定を行います。非表示にした投稿は一覧から隠れます。テスト前にダミーデータへ戻すこともできます。</div>
      <div style={{ marginBottom: 8 }}>
        <button type="button" className="classic-button" onClick={onResetSeedData}>テスト用ダミーデータを再投入</button>
      </div>

      {editingId && (
        <div className="admin-edit-box">
          <div className="section-title" style={{ marginBottom: 8 }}>■ 投稿を編集</div>
          <table className="classic-table">
            <tbody>
              <tr>
                <td className="form-label">タイトル</td>
                <td><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%' }} /></td>
              </tr>
              <tr>
                <td className="form-label">名前</td>
                <td><input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} style={{ width: 300, maxWidth: '100%' }} /></td>
              </tr>
              <tr>
                <td className="form-label">トリップ</td>
                <td><input type="text" value={trip} onChange={(e) => setTrip(e.target.value)} style={{ width: 300, maxWidth: '100%' }} /></td>
              </tr>
              <tr>
                <td className="form-label">本文</td>
                <td><textarea value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 200 }} /></td>
              </tr>
              <tr>
                <td />
                <td>
                  <button type="button" className="classic-button" onClick={handleSave} disabled={isSaving}>{isSaving ? '保存中...' : '保存'}</button>{' '}
                  <button type="button" className="classic-button" onClick={cancelEdit} disabled={isSaving}>キャンセル</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <table className="classic-table">
        <thead>
          <tr>
            <th style={{ width: 56 }}>No.</th>
            <th>タイトル</th>
            <th style={{ width: 130 }}>投稿者</th>
            <th style={{ width: 130 }}>投稿日</th>
            <th style={{ width: 100 }}>状態</th>
            <th style={{ width: 220 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {novels.map((novel, idx) => {
            const hidden = hiddenSet.has(novel.id);
            const commentCount = comments.filter((c) => c.novelId === novel.id).length;
            return (
              <tr key={novel.id}>
                <td style={{ textAlign: 'center' }}>{novels.length - idx}</td>
                <td>
                  <b>{novel.title}</b>
                  <div style={{ fontSize: 12, color: '#555' }}>コメント: {commentCount} / 閲覧: {novel.viewCount}</div>
                </td>
                <td>{novel.author}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>{formatDate(novel.date)}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={hidden ? 'score-neg' : 'score-pos'}>{hidden ? '非表示' : '公開'}</span>
                </td>
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <button type="button" className="classic-button" onClick={() => startEdit(novel)}>編集</button>{' '}
                  <button type="button" className="classic-button" onClick={() => handleDelete(novel.id)}>削除</button>{' '}
                  <button type="button" className="classic-button" onClick={() => handleToggleHide(novel.id, !hidden)}>{hidden ? '表示する' : '非表示'}</button>
                </td>
              </tr>
            );
          })}
          {novels.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: 18 }}>投稿がありません。</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
