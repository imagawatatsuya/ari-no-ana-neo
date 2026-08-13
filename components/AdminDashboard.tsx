import React, { useMemo, useState } from 'react';
import { Comment, Novel } from '../types';
import { formatDate } from '../utils';
import { FootnoteMode } from './FootnoteRenderer';

type FilterTab = 'all' | 'published' | 'hidden';
const MAX_DESCRIPTION = 500;
const MAX_AUTHOR_MESSAGE = 500;

interface AdminDashboardProps {
  novels: Novel[];
  comments: Comment[];
  hiddenNovelIds: string[];
  onEditNovel: (id: string, patch: Pick<Novel, 'title' | 'description' | 'authorMessage' | 'author' | 'trip' | 'body'>) => Promise<void>;
  onDeleteNovel: (id: string) => Promise<void>;
  onToggleHideNovel: (id: string, nextHidden: boolean) => Promise<void>;
  onBulkToggleHide: (ids: string[], nextHidden: boolean) => Promise<void>;
  onToggleRyuseigai: (id: string, nextRyuseigai: boolean) => Promise<void>;
  onResetSeedData: () => void;
  footnoteMode: FootnoteMode;
  onChangeFootnoteMode: (mode: FootnoteMode) => void;
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
  footnoteMode,
  onChangeFootnoteMode,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [authorMessage, setAuthorMessage] = useState('');
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
    setDescription(novel.description || '');
    setAuthorMessage(novel.authorMessage || '');
    setAuthor(novel.author);
    setTrip(novel.trip || '');
    setBody(novel.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setAuthorMessage('');
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
        description: description.trim() || undefined,
        authorMessage: authorMessage.trim() || undefined,
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

      <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--admin-bulk-bg)', border: '1px solid var(--admin-bulk-border)', fontSize: 13 }}>
        <b>脚注クリック動作:</b>{' '}
        <label style={{ marginRight: 12 }}>
          <input type="radio" name="footnoteMode" checked={footnoteMode === 'scroll'} onChange={() => onChangeFootnoteMode('scroll')} /> スクロール
        </label>
        <label>
          <input type="radio" name="footnoteMode" checked={footnoteMode === 'tooltip'} onChange={() => onChangeFootnoteMode('tooltip')} /> ツールチップ
        </label>
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
          <button type="button" className="classic-button" onClick={() => setSelectedIds(new Set())}>