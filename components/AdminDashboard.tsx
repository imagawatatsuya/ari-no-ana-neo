import React, { useMemo, useState } from 'react';
import { Comment, Novel } from '../types';
import { formatDate } from '../utils';

type FilterTab = 'all' | 'published' | 'hidden';

interface AdminDashboardProps {
  novels: Novel[];
  comments: Comment[];
  hiddenNovelIds: string[];
  onEditNovel: (id: string, patch: Pick<Novel, 'title' | 'author' | 'trip' | 'body'>) => Promise<void>;
  onDeleteNovel: (id: string) => Promise<void>;
  onToggleHideNovel: (id: string, nextHidden: boolean) => Promise<void>;
  onBulkToggleHide: (ids: string[], nextHidden: boolean) => Promise<void>;
  onToggleRyuseigai: (id: string, nextRyuseigai: boolean) => Promise<void>;
  onResetSeedData: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  novels,
  comments,
  hiddenNovelIds,
  onEditNovel,
  onDeleteNovel,
  onToggleHideNovel,
  onBulkToggleHide,
  onToggleRyuseigai,
  onResetSeedData,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [trip, setTrip] = useState('');
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const hiddenSet = useMemo(() => new Set(hiddenNovelIds), [hiddenNovelIds]);

  const filteredNovels = useMemo(() => {
    switch (filterTab) {
      case 'published':
        return novels.filter((n) => !hiddenSet.has(n.id));
      case 'hidden':
        return novels.filter((n) => hiddenSet.has(n.id));
      default:
        return novels;
    }
  }, [novels, hiddenSet, filterTab]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredNovels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNovels.map((n) => n.id)));
    }
  };

  const handleBulkHide = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`選択した ${selectedIds.size} 件を非表示にします。よろしいですか？`)) return;
    await onBulkToggleHide([...selectedIds], true);
    setSelectedIds(new Set());
  };

  const handleBulkShow = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`選択した ${selectedIds.size} 件を公開にします。よろしいですか？`)) return;
    await onBulkToggleHide([...selectedIds], false);
    setSelectedIds(new Set());
  };

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
      <div className="section-title">管理ダッシュボード</div>
      <div style={{ fontSize: 13, marginBottom: 6 }}>投稿の編集・削除・非表示設定を行います。</div>
      <div style={{ marginBottom: 8 }}>
        <button type="button" className="classic-button" onClick={onResetSeedData}>テスト用ダミーデータを再投入</button>
      </div>

      {/* フィルタタブ */}
      <div className="admin-filter-tabs">
        <button type="button" className={`admin-tab${filterTab === 'all' ? ' admin-tab-active' : ''}`} onClick={() => { setFilterTab('all'); setSelectedIds(new Set()); }}>
          全て ({novels.length})
        </button>
        <button type="button" className={`admin-tab${filterTab === 'published' ? ' admin-tab-active' : ''}`} onClick={() => { setFilterTab('published'); setSelectedIds(new Set()); }}>
          公開中 ({novels.length - hiddenSet.size})
        </button>
        <button type="button" className={`admin-tab${filterTab === 'hidden' ? ' admin-tab-active' : ''}`} onClick={() => { setFilterTab('hidden'); setSelectedIds(new Set()); }}>
          非表示 ({hiddenSet.size})
        </button>
      </div>

      {/* 一括操作バー */}
      {selectedIds.size > 0 && (
        <div className="admin-bulk-bar">
          <span>{selectedIds.size} 件選択中</span>
          <button type="button" className="classic-button" onClick={handleBulkHide}>非表示にする</button>
          <button type="button" className="classic-button" onClick={handleBulkShow}>公開にする</button>
          <button type="button" className="classic-button" onClick={() => setSelectedIds(new Set())}>選択解除</button>
        </div>
      )}

      <table className="classic-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input type="checkbox" checked={filteredNovels.length > 0 && selectedIds.size === filteredNovels.length} onChange={toggleSelectAll} title="全選択" />
            </th>
            <th style={{ width: 48 }}>No.</th>
            <th>タイトル</th>
            <th style={{ width: 120 }}>投稿者</th>
            <th style={{ width: 120 }}>投稿日</th>
            <th style={{ width: 80 }}>状態</th>
            <th style={{ width: 200 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {filteredNovels.map((novel) => {
            const hidden = hiddenSet.has(novel.id);
            const commentCount = comments.filter((c) => c.novelId === novel.id).length;
            return (
              <tr key={novel.id} className={hidden ? 'admin-row-hidden' : undefined}>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={selectedIds.has(novel.id)} onChange={() => toggleSelect(novel.id)} />
                </td>
                <td style={{ textAlign: 'center' }}>{novels.length - novels.indexOf(novel)}</td>
                <td>
                  <b>{novel.title}</b>
                  {hidden && <span className="admin-hidden-badge">[非表示]</span>}
                  <div style={{ fontSize: 12, color: 'var(--point-gray)' }}>コメント: {commentCount} / 閲覧: {novel.viewCount}</div>
                </td>
                <td>{novel.author}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>{formatDate(novel.date)}</td>
                <td style={{ textAlign: 'center' }}>
                  <span className={hidden ? 'score-neg' : novel.isRyuseigai ? 'ryuseigai-badge' : 'score-pos'}>{hidden ? '非表示' : novel.isRyuseigai ? '流星街' : '公開'}</span>
                </td>
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <button type="button" className="classic-button" onClick={() => startEdit(novel)}>編集</button>{' '}
                  <button type="button" className="classic-button" onClick={() => handleDelete(novel.id)}>削除</button>{' '}
                  <button type="button" className="classic-button" onClick={() => handleToggleHide(novel.id, !hidden)}>{hidden ? '表示する' : '非表示'}</button>{' '}
                  <button type="button" className="classic-button" onClick={() => onToggleRyuseigai(novel.id, !novel.isRyuseigai)}>{novel.isRyuseigai ? '流星街から戻す' : '流星街へ'}</button>
                </td>
              </tr>
            );
          })}
          {filteredNovels.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: 18 }}>投稿がありません。</td>
            </tr>
          )}
        </tbody>
      </table>

      {editingId && (
        <div className="admin-edit-box">
          <div className="section-title" style={{ marginBottom: 8 }}>投稿を編集</div>
          <table className="form-table">
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
    </div>
  );
};
