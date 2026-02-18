import React, { useEffect, useMemo, useState } from 'react';
import { Comment, Novel } from '../types';
import { formatDate } from '../utils';

type BulkAction = 'hide' | 'show' | 'delete';
type StatusFilter = 'all' | 'public' | 'hidden';

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

  const [selectedNovelIds, setSelectedNovelIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>('hide');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [lastHideShowOp, setLastHideShowOp] = useState<{ type: 'hide' | 'show'; ids: string[] } | null>(null);
  const [operationLogs, setOperationLogs] = useState<string[]>([]);

  const hiddenSet = useMemo(() => new Set(hiddenNovelIds), [hiddenNovelIds]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredNovels = useMemo(() => novels.filter((novel) => {
    const matchQuery = !normalizedQuery
      || novel.title.toLowerCase().includes(normalizedQuery)
      || novel.author.toLowerCase().includes(normalizedQuery);

    if (!matchQuery) return false;

    if (statusFilter === 'public') return !hiddenSet.has(novel.id);
    if (statusFilter === 'hidden') return hiddenSet.has(novel.id);
    return true;
  }), [novels, normalizedQuery, statusFilter, hiddenSet]);

  const totalPages = Math.max(1, Math.ceil(filteredNovels.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageStart = (clampedPage - 1) * pageSize;
  const pagedNovels = filteredNovels.slice(pageStart, pageStart + pageSize);
  const currentPageIds = pagedNovels.map((n) => n.id);
  const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedNovelIds.includes(id));

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(prev, 1), totalPages));
  }, [totalPages]);

  useEffect(() => {
    setSelectedNovelIds((prev) => prev.filter((id) => novels.some((n) => n.id === id)));
  }, [novels]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, pageSize]);

  const pushLog = (text: string) => {
    setOperationLogs((prev) => [`${formatDate(new Date().toISOString())} ${text}`, ...prev].slice(0, 20));
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
      pushLog(`編集: ${editingId}`);
      cancelEdit();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('この投稿を削除します。関連コメントも削除されます。よろしいですか？')) return;
    await onDeleteNovel(id);
    pushLog(`削除: ${id}`);
    setSelectedNovelIds((prev) => prev.filter((selectedId) => selectedId !== id));
    if (editingId === id) cancelEdit();
  };

  const handleToggleHide = async (id: string, nextHidden: boolean) => {
    await onToggleHideNovel(id, nextHidden);
    setLastHideShowOp({ type: nextHidden ? 'hide' : 'show', ids: [id] });
    pushLog(`${nextHidden ? '非表示' : '公開'}: ${id}`);
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedNovelIds((prev) => checked ? [...prev, id] : prev.filter((v) => v !== id));
  };

  const toggleSelectAllCurrentPage = (checked: boolean) => {
    if (checked) {
      setSelectedNovelIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
    } else {
      setSelectedNovelIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    }
  };

  const handleBulkExecute = async () => {
    if (selectedNovelIds.length === 0) {
      alert('一括操作対象を選択してください。');
      return;
    }

    const actionLabel = bulkAction === 'hide' ? '非表示' : bulkAction === 'show' ? '公開' : '削除';
    if (!window.confirm(`${selectedNovelIds.length}件に対して「${actionLabel}」を実行します。よろしいですか？`)) return;

    const selectedNow = [...selectedNovelIds];
    const results = await Promise.allSettled(selectedNow.map(async (id) => {
      if (bulkAction === 'delete') {
        await onDeleteNovel(id);
      } else {
        await onToggleHideNovel(id, bulkAction === 'hide');
      }
      return id;
    }));

    const successIds = results.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled').map((r) => r.value);
    const failed = results
      .map((r, index) => ({ result: r, id: selectedNow[index] }))
      .filter((x): x is { result: PromiseRejectedResult; id: string } => x.result.status === 'rejected');

    if (bulkAction === 'hide' || bulkAction === 'show') {
      setLastHideShowOp({ type: bulkAction, ids: successIds });
    } else {
      setLastHideShowOp(null);
    }

    setSelectedNovelIds((prev) => prev.filter((id) => !successIds.includes(id)));
    if (editingId && successIds.includes(editingId)) cancelEdit();

    pushLog(`一括${actionLabel}: 成功${successIds.length}件 / 失敗${failed.length}件`);

    if (failed.length > 0) {
      const detail = failed.map((f) => `${f.id}: ${f.result.reason instanceof Error ? f.result.reason.message : String(f.result.reason)}`).join('\n');
      alert(`一括${actionLabel}の結果\n成功: ${successIds.length}件\n失敗: ${failed.length}件\n\n${detail}`);
      return;
    }

    alert(`一括${actionLabel}が完了しました（${successIds.length}件）。`);
  };

  const handleUndoLastHideShow = async () => {
    if (!lastHideShowOp || lastHideShowOp.ids.length === 0) return;
    const reverseHidden = lastHideShowOp.type !== 'hide';
    if (!window.confirm(`直前の「${lastHideShowOp.type === 'hide' ? '非表示' : '公開'}」操作を取り消します。`)) return;

    const results = await Promise.allSettled(lastHideShowOp.ids.map((id) => onToggleHideNovel(id, reverseHidden)));
    const failedCount = results.filter((r) => r.status === 'rejected').length;
    pushLog(`Undo(${lastHideShowOp.type}): 成功${results.length - failedCount}件 / 失敗${failedCount}件`);
    setLastHideShowOp(null);
    if (failedCount > 0) {
      alert(`取り消し中に失敗がありました（${failedCount}件）。`);
    }
  };

  const handleResetSeedDataWithLog = () => {
    onResetSeedData();
    setSelectedNovelIds([]);
    setLastHideShowOp(null);
    pushLog('ダミーデータ再投入');
  };

  return (
    <div>
      <div className="section-title">■ 管理ダッシュボード</div>
      <div className="legend-box">投稿の編集・削除・非表示設定を行います。非表示にした投稿は一覧から隠れます。テスト前にダミーデータへ戻すこともできます。</div>
      <div style={{ marginBottom: 8 }}>
        <button type="button" className="classic-button" onClick={handleResetSeedDataWithLog}>テスト用ダミーデータを再投入</button>{' '}
        <button type="button" className="classic-button" onClick={handleUndoLastHideShow} disabled={!lastHideShowOp}>直前の公開/非表示を取り消す</button>
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

      <div className="legend-box" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <label>
            検索:{' '}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="タイトル/投稿者"
              style={{ width: 200 }}
            />
          </label>
          <label>
            状態:{' '}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">すべて</option>
              <option value="public">公開のみ</option>
              <option value="hidden">非表示のみ</option>
            </select>
          </label>
          <label>
            表示件数:{' '}
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>
      </div>

      <div className="legend-box" style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span>一括操作（選択中: {selectedNovelIds.length}件）:</span>
          <label><input type="radio" name="bulkAction" checked={bulkAction === 'hide'} onChange={() => setBulkAction('hide')} /> 非表示</label>
          <label><input type="radio" name="bulkAction" checked={bulkAction === 'show'} onChange={() => setBulkAction('show')} /> 公開</label>
          <label><input type="radio" name="bulkAction" checked={bulkAction === 'delete'} onChange={() => setBulkAction('delete')} /> 削除</label>
          <button type="button" className="classic-button" onClick={handleBulkExecute} disabled={selectedNovelIds.length === 0}>一括実行</button>
          <button type="button" className="classic-button" onClick={() => setSelectedNovelIds([])} disabled={selectedNovelIds.length === 0}>選択クリア</button>
        </div>
      </div>

      <table className="classic-table">
        <thead>
          <tr>
            <th style={{ width: 48, textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={allCurrentPageSelected}
                onChange={(e) => toggleSelectAllCurrentPage(e.target.checked)}
                disabled={currentPageIds.length === 0}
                title="現在ページを全選択"
              />
            </th>
            <th style={{ width: 56 }}>No.</th>
            <th>タイトル</th>
            <th style={{ width: 130 }}>投稿者</th>
            <th style={{ width: 130 }}>投稿日</th>
            <th style={{ width: 100 }}>状態</th>
            <th style={{ width: 220 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {pagedNovels.map((novel, idx) => {
            const hidden = hiddenSet.has(novel.id);
            const commentCount = comments.filter((c) => c.novelId === novel.id).length;
            const selected = selectedNovelIds.includes(novel.id);
            return (
              <tr key={novel.id}>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={selected} onChange={(e) => toggleSelectOne(novel.id, e.target.checked)} />
                </td>
                <td style={{ textAlign: 'center' }}>{filteredNovels.length - (pageStart + idx)}</td>
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
          {pagedNovels.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: 18 }}>投稿がありません。</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="legend-box" style={{ marginTop: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>ページ {clampedPage} / {totalPages}（絞り込み {filteredNovels.length}件）</div>
        <div>
          <button type="button" className="classic-button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={clampedPage <= 1}>前へ</button>{' '}
          <button type="button" className="classic-button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={clampedPage >= totalPages}>次へ</button>
        </div>
      </div>

      <div className="legend-box">
        <b>操作ログ（最新20件）</b>
        <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
          {operationLogs.length === 0 && <li>まだ操作ログはありません。</li>}
          {operationLogs.map((log, idx) => <li key={`${log}-${idx}`}>{log}</li>)}
        </ul>
      </div>
    </div>
  );
};
