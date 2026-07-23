import React, { useEffect, useMemo, useState } from 'react';
import { Novel, ViewMode, Comment } from './types';
import { SEED_NOVELS, SEED_COMMENTS } from './seedData';
import { NovelList } from './components/NovelList';
import { NovelReader } from './components/NovelReader';
import { PostForm } from './components/PostForm';
import { AdminDashboard } from './components/AdminDashboard';
import { RyuseigaiList } from './components/RyuseigaiList';
import { RyuseigaiReader } from './components/RyuseigaiReader';
import { supabase } from './services/supabaseClient';
import { deleteNovelAndComments, editNovelInList, toggleHiddenNovelId } from './adminOps';

const getJSTISOString = () => {
  const jstDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const year = jstDate.getFullYear();
  const month = String(jstDate.getMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getDate()).padStart(2, '0');
  const hours = String(jstDate.getHours()).padStart(2, '0');
  const minutes = String(jstDate.getMinutes()).padStart(2, '0');
  const seconds = String(jstDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
};

const HIDDEN_IDS_STORAGE_KEY = 'bunsho_hidden_novel_ids_v1';
const ADMIN_AUTH_STORAGE_KEY = 'bunsho_admin_auth_v1';
const ADMIN_AUTH_TTL_MS = 1000 * 60 * 30;
const localAdminPassword = import.meta.env.VITE_ADMIN_PASSWORD?.trim() || '';
const NOVELS_PER_PAGE = 20;

const App: React.FC = () => {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [hiddenNovelIds, setHiddenNovelIds] = useState<string[]>([]);
  const [view, setView] = useState<ViewMode>('list');
  const [activeNovelId, setActiveNovelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // サーバーサイドページング用
  const [totalNovelCount, setTotalNovelCount] = useState(0);
  const [readNovel, setReadNovel] = useState<Novel | null>(null);
  const [readComments, setReadComments] = useState<Comment[]>([]);
  const [adminNovels, setAdminNovels] = useState<Novel[]>([]);
  const [adminComments, setAdminComments] = useState<Comment[]>([]);
  // 流星垓用（一覧のみ。閲覧は共通 readNovel/readComments を使用）
  const [ryuseigaiNovels, setRyuseigaiNovels] = useState<Novel[]>([]);
  const [ryuseigaiComments, setRyuseigaiComments] = useState<Comment[]>([]);

  const isSupabaseMode = !!supabase;

  useEffect(() => {
    if (!isSupabaseMode) {
      loadFromLocalStorage();
    }

    const savedHiddenNovelIds = localStorage.getItem(HIDDEN_IDS_STORAGE_KEY);
    if (savedHiddenNovelIds) {
      try {
        setHiddenNovelIds(JSON.parse(savedHiddenNovelIds));
      } catch {
        setHiddenNovelIds([]);
      }
    }

    if (isSupabaseMode && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setIsAdminAuthenticated(!!data.session);
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAdminAuthenticated(!!session);
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }

    const authAt = Number(sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY) || 0);
    if (authAt && Date.now() - authAt < ADMIN_AUTH_TTL_MS) {
      setIsAdminAuthenticated(true);
    } else {
      sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    }
  }, [isSupabaseMode]);

  // Supabaseモード: ページ遷移時にサーバーから当該ページ取得
  useEffect(() => {
    if (isSupabaseMode && view === 'list') {
      fetchPageFromSupabase(currentPage, searchQuery);
    }
  }, [currentPage, view, isSupabaseMode, searchQuery]);

  // Supabaseモード: 作品閲覧時に個別取得
  useEffect(() => {
    if (isSupabaseMode && view === 'read' && activeNovelId) {
      fetchNovelForRead(activeNovelId);
    }
  }, [view, activeNovelId, isSupabaseMode]);

  // Supabaseモード: 管理画面 진입 시 전건 취득
  useEffect(() => {
    if (isSupabaseMode && view === 'admin' && isAdminAuthenticated) {
      fetchAllForAdmin();
    }
  }, [view, isAdminAuthenticated, isSupabaseMode]);

  // Supabaseモード: 流星垓一覧取得
  useEffect(() => {
    if (isSupabaseMode && view === 'ryuseigai') {
      fetchRyuseigaiFromSupabase();
    }
  }, [view, isSupabaseMode]);

  // Supabaseモード: 流星垓作品閲覧（共通 fetchNovelForRead を使用）
  useEffect(() => {
    if (isSupabaseMode && view === 'ryuseigai-read' && activeNovelId) {
      fetchNovelForRead(activeNovelId);
    }
  }, [view, activeNovelId, isSupabaseMode]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#ryuseigai/read/')) {
        setActiveNovelId(hash.replace('#ryuseigai/read/', ''));
        setView('ryuseigai-read');
      } else if (hash === '#ryuseigai') {
        setView('ryuseigai');
        setActiveNovelId(null);
      } else if (hash.startsWith('#read/')) {
        setActiveNovelId(hash.replace('#read/', ''));
        setView('read');
      } else if (hash === '#post') {
        setView('post');
        setActiveNovelId(null);
      } else if (hash === '#admin') {
        if (!isSupabaseMode && !localAdminPassword) {
          setErrorMsg('管理画面は無効です。オフライン運用では VITE_ADMIN_PASSWORD を設定してください。');
          setView('list');
          window.location.hash = '';
          return;
        }
        setView('admin');
        setActiveNovelId(null);
      } else if (hash.startsWith('#page/')) {
        const pageNum = parseInt(hash.replace('#page/', ''), 10);
        setCurrentPage(isNaN(pageNum) ? 1 : Math.max(1, pageNum));
        setView('list');
        setActiveNovelId(null);
      } else {
        setCurrentPage(1);
        setView('list');
        setActiveNovelId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isSupabaseMode]);

  // 流星垓ビュー: document.title / meta / favicon を動的切替
  useEffect(() => {
    const isRyuseigaiView = view === 'ryuseigai' || view === 'ryuseigai-read';
    const defaultTitle = '文章アリの穴NEO';
    const defaultDesc = '文章アリの穴NEO - 匿名投稿・添削できる修行場所。2005年のテキスト投稿サイト「文章アリの穴」をオマージュした再現サイト。';
    const defaultIcon = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐜</text></svg>";

    const ryuseigaiTitle = '流星垓';
    const ryuseigaiDesc = 'ここに捨てられたものは、まだ息をしている。救済はない。ただ、在る。';
    const ryuseigaiIcon = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>☄️</text></svg>";

    document.title = isRyuseigaiView ? ryuseigaiTitle : defaultTitle;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', isRyuseigaiView ? ryuseigaiDesc : defaultDesc);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', isRyuseigaiView ? ryuseigaiTitle : defaultTitle);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', isRyuseigaiView ? ryuseigaiDesc : defaultDesc);

    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (favicon) favicon.href = isRyuseigaiView ? ryuseigaiIcon : defaultIcon;
  }, [view]);

  useEffect(() => {
    if ((view === 'read' || view === 'ryuseigai-read') && activeNovelId) {
      incrementViewCount(activeNovelId);
      window.scrollTo(0, 0);
    }
  }, [activeNovelId, view]);

  useEffect(() => {
    localStorage.setItem(HIDDEN_IDS_STORAGE_KEY, JSON.stringify(hiddenNovelIds));
  }, [hiddenNovelIds]);

  const loadFromLocalStorage = () => {
    const savedNovels = localStorage.getItem('bunsho_novels_v2');
    const savedComments = localStorage.getItem('bunsho_comments_v2');
    setNovels(savedNovels ? JSON.parse(savedNovels) : SEED_NOVELS);
    setComments(savedComments ? JSON.parse(savedComments) : SEED_COMMENTS);
  };

  // --- Supabase: サーバーサイドページング（一覧用: 20件ずつ） ---
  const fetchPageFromSupabase = async (page: number, search?: string) => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const from = (page - 1) * NOVELS_PER_PAGE;
      const to = from + NOVELS_PER_PAGE - 1;
      const trimmed = (search ?? '').trim();

      // 総件数取得（is_hidden=false かつ is_ryuseigai=false のみ、検索条件付き）
      let countQuery = supabase
        .from('novels')
        .select('*', { count: 'exact', head: true })
        .eq('is_hidden', false)
        .eq('is_ryuseigai', false);
      if (trimmed) {
        countQuery = countQuery.or(`title.ilike.%${trimmed}%,author.ilike.%${trimmed}%`);
      }
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalNovelCount(count ?? 0);

      // 当該ページの作品取得（流星垓送りの作品は除外）
      let novelsQuery = supabase
        .from('novels')
        .select('*')
        .eq('is_hidden', false)
        .eq('is_ryuseigai', false)
        .order('date', { ascending: false })
        .range(from, to);
      if (trimmed) {
        novelsQuery = novelsQuery.or(`title.ilike.%${trimmed}%,author.ilike.%${trimmed}%`);
      }
      const { data: novelsData, error: novelsError } = await novelsQuery;
      if (novelsError) throw novelsError;

      const mappedNovels: Novel[] = (novelsData || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        author: n.author,
        trip: n.trip,
        body: n.body,
        date: n.date,
        viewCount: n.view_count ? Number(n.view_count) : 0,
        isHidden: false,
        isRyuseigai: !!n.is_ryuseigai,
      }));

      // 当該ページ作品のコメントのみ取得
      const novelIds = mappedNovels.map((n) => n.id);
      let mappedComments: Comment[] = [];
      if (novelIds.length > 0) {
        const { data: commentsData, error: commentsError } = await supabase
          .from('comments')
          .select('*')
          .in('novel_id', novelIds);
        if (commentsError) throw commentsError;
        mappedComments = (commentsData || []).map((c: any) => ({
          id: c.id,
          novelId: c.novel_id,
          name: c.name,
          text: c.text,
          date: c.date,
          vote: c.vote,
        }));
      }

      setNovels(mappedNovels);
      setComments(mappedComments);
    } catch (err: any) {
      console.error('Supabase Error:', err);
      setErrorMsg('データベースへの接続に失敗しました。オフラインモードで表示します。');
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  };

  // --- Supabase: 作品個別取得（閲覧ページ用） ---
  const fetchNovelForRead = async (id: string) => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data: novelData, error: novelError } = await supabase
        .from('novels')
        .select('*')
        .eq('id', id)
        .single();
      if (novelError) throw novelError;

      const mapped: Novel = {
        id: novelData.id,
        title: novelData.title,
        author: novelData.author,
        trip: novelData.trip,
        body: novelData.body,
        date: novelData.date,
        viewCount: novelData.view_count ? Number(novelData.view_count) : 0,
        isHidden: !!novelData.is_hidden,
      };
      setReadNovel(mapped);

      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('novel_id', id);
      if (commentsError) throw commentsError;
      setReadComments((commentsData || []).map((c: any) => ({
        id: c.id,
        novelId: c.novel_id,
        name: c.name,
        text: c.text,
        date: c.date,
        vote: c.vote,
      })));
    } catch (err: any) {
      console.error('Supabase Error (read):', err);
      setReadNovel(null);
      setReadComments([]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Supabase: 全件取得（管理画面用） ---
  const fetchAllForAdmin = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data: novelsData, error: novelsError } = await supabase
        .from('novels')
        .select('*')
        .order('date', { ascending: false });
      if (novelsError) throw novelsError;

      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*');
      if (commentsError) throw commentsError;

      const mappedNovels: Novel[] = (novelsData || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        author: n.author,
        trip: n.trip,
        body: n.body,
        date: n.date,
        viewCount: n.view_count ? Number(n.view_count) : 0,
        isHidden: !!n.is_hidden,
        isRyuseigai: !!n.is_ryuseigai,
      }));

      const mappedComments: Comment[] = (commentsData || []).map((c: any) => ({
        id: c.id,
        novelId: c.novel_id,
        name: c.name,
        text: c.text,
        date: c.date,
        vote: c.vote,
      }));

      setAdminNovels(mappedNovels);
      setAdminComments(mappedComments);
      const serverHiddenIds = mappedNovels.filter((n) => n.isHidden).map((n) => n.id);
      setHiddenNovelIds(serverHiddenIds);
    } catch (err: any) {
      console.error('Supabase Error (admin):', err);
      setErrorMsg('管理データの取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Supabase: 流星垓一覧取得 ---
  const fetchRyuseigaiFromSupabase = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data: novelsData, error: novelsError } = await supabase
        .from('novels')
        .select('*')
        .eq('is_ryuseigai', true)
        .eq('is_hidden', false);
      if (novelsError) throw novelsError;

      const mappedNovels: Novel[] = (novelsData || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        author: n.author,
        trip: n.trip,
        body: n.body,
        date: n.date,
        viewCount: n.view_count ? Number(n.view_count) : 0,
        isHidden: false,
        isRyuseigai: true,
      }));

      const novelIds = mappedNovels.map((n) => n.id);
      let mappedComments: Comment[] = [];
      if (novelIds.length > 0) {
        const { data: commentsData, error: commentsError } = await supabase
          .from('comments')
          .select('*')
          .in('novel_id', novelIds);
        if (commentsError) throw commentsError;
        mappedComments = (commentsData || []).map((c: any) => ({
          id: c.id,
          novelId: c.novel_id,
          name: c.name,
          text: c.text,
          date: c.date,
          vote: c.vote,
        }));
      }

      setRyuseigaiNovels(mappedNovels);
      setRyuseigaiComments(mappedComments);
    } catch (err: any) {
      console.error('Supabase Error (ryuseigai):', err);
      setRyuseigaiNovels([]);
      setRyuseigaiComments([]);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    if (!isSupabaseMode) localStorage.setItem('bunsho_novels_v2', JSON.stringify(novels));
  }, [novels, isSupabaseMode]);

  useEffect(() => {
    if (!isSupabaseMode) localStorage.setItem('bunsho_comments_v2', JSON.stringify(comments));
  }, [comments, isSupabaseMode]);

  const incrementViewCount = async (id: string) => {
    if (isSupabaseMode) {
      // Supabaseモード: readNovel の viewCount をローカルincrement + RPC
      setReadNovel((prev) => prev && prev.id === id ? { ...prev, viewCount: prev.viewCount + 1 } : prev);
      if (supabase) {
        await supabase.rpc('increment_novel_view', { target_novel_id: id });
      }
    } else {
      setNovels((prev) => prev.map((n) => (n.id === id ? { ...n, viewCount: n.viewCount + 1 } : n)));
    }
  };

  const handlePost = async (novel: Novel) => {
    const novelToSave = { ...novel, date: getJSTISOString() };
    if (isSupabaseMode && supabase) {
      setIsLoading(true);
      const { error } = await supabase.from('novels').insert([
        {
          id: novelToSave.id,
          title: novelToSave.title,
          description: novelToSave.description || null,
          author: novelToSave.author,
          trip: novelToSave.trip || null,
          body: novelToSave.body,
          date: novelToSave.date,
        },
      ]);
      setIsLoading(false);
      if (error) {
        alert(`文章の投稿中にエラーが発生しました: ${error.message}`);
        return;
      }
    }
    setNovels([novelToSave, ...novels]);
    window.location.hash = '';
  };

  const handleComment = async (comment: Comment) => {
    const commentToSave = { ...comment, date: getJSTISOString() };
    if (isSupabaseMode && supabase) {
      const { error } = await supabase.from('comments').insert([
        {
          id: commentToSave.id,
          novel_id: commentToSave.novelId,
          name: commentToSave.name || '',
          text: commentToSave.text,
          date: commentToSave.date,
          vote: commentToSave.vote,
        },
      ]);
      if (error) {
        alert(`コメントの投稿中にエラーが発生しました: ${error.message}`);
        return;
      }
      setReadComments((prev) => [...prev, commentToSave]);
    } else {
      setComments((prev) => [...prev, commentToSave]);
    }
  };


  const handleEditNovel = async (id: string, patch: Pick<Novel, 'title' | 'author' | 'trip' | 'body'>) => {
    if (!isAdminAuthenticated) {
      alert('管理者認証が必要です。');
      return;
    }

    if (isSupabaseMode && supabase) {
      const { error } = await supabase
        .from('novels')
        .update({ title: patch.title, author: patch.author, trip: patch.trip ?? null, body: patch.body })
        .eq('id', id);
      if (error) {
        alert(`投稿の更新に失敗しました: ${error.message}`);
        return;
      }
    }

    if (isSupabaseMode) {
      setAdminNovels((prev) => editNovelInList(prev, id, patch));
    } else {
      setNovels((prev) => editNovelInList(prev, id, patch));
    }
    alert('投稿を更新しました。');
  };

  const handleDeleteNovel = async (id: string) => {
    if (!isAdminAuthenticated) {
      alert('管理者認証が必要です。');
      return;
    }

    if (isSupabaseMode && supabase) {
      const { error: commentDeleteError } = await supabase.from('comments').delete().eq('novel_id', id);
      if (commentDeleteError) {
        alert(`コメント削除に失敗しました: ${commentDeleteError.message}`);
        return;
      }

      const { error: novelDeleteError } = await supabase.from('novels').delete().eq('id', id);
      if (novelDeleteError) {
        alert(`投稿削除に失敗しました: ${novelDeleteError.message}`);
        return;
      }
    }

    if (isSupabaseMode) {
      const nextState = deleteNovelAndComments(adminNovels, adminComments, id);
      setAdminNovels(nextState.novels);
      setAdminComments(nextState.comments);
    } else {
      const nextState = deleteNovelAndComments(novels, comments, id);
      setNovels(nextState.novels);
      setComments(nextState.comments);
    }
    setHiddenNovelIds((prev) => prev.filter((hiddenId) => hiddenId !== id));
    if (activeNovelId === id) {
      window.location.hash = '';
    }
  };

  const handleToggleHideNovel = async (id: string, nextHidden: boolean) => {
    if (!isAdminAuthenticated) {
      alert('管理者認証が必要です。');
      return;
    }

    setHiddenNovelIds((prev) => toggleHiddenNovelId(prev, id, nextHidden));
    if (isSupabaseMode) {
      setAdminNovels((prev) => prev.map((n) => (n.id === id ? { ...n, isHidden: nextHidden } : n)));
    } else {
      setNovels((prev) => prev.map((n) => (n.id === id ? { ...n, isHidden: nextHidden } : n)));
    }

    if (isSupabaseMode && supabase) {
      const { error } = await supabase.from('novels').update({ is_hidden: nextHidden }).eq('id', id);
      if (error) {
        console.error('Failed to sync is_hidden:', error);
        setErrorMsg('非表示状態の同期に失敗しました。');
      }
    }
  };

  const handleBulkToggleHide = async (ids: string[], nextHidden: boolean) => {
    if (!isAdminAuthenticated) {
      alert('管理者認証が必要です。');
      return;
    }

    setHiddenNovelIds((prev) => {
      let next = [...prev];
      for (const id of ids) {
        next = toggleHiddenNovelId(next, id, nextHidden);
      }
      return next;
    });
    if (isSupabaseMode) {
      setAdminNovels((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, isHidden: nextHidden } : n)));
    } else {
      setNovels((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, isHidden: nextHidden } : n)));
    }

    if (isSupabaseMode && supabase) {
      const { error } = await supabase.from('novels').update({ is_hidden: nextHidden }).in('id', ids);
      if (error) {
        console.error('Failed to bulk sync is_hidden:', error);
        setErrorMsg('一括非表示の同期に失敗しました。');
      }
    }
  };

  const handleResetSeedData = () => {
    if (!isAdminAuthenticated) {
      alert('管理者認証が必要です。');
      return;
    }

    if (!window.confirm('テスト用ダミーデータ（5件）に戻します。現在のローカルデータは上書きされます。よろしいですか？')) return;

    setNovels(SEED_NOVELS);
    setComments(SEED_COMMENTS);
    setHiddenNovelIds([]);
    alert('ダミーデータを再投入しました。');
  };

  // --- 流星垓送りトグル ---
  const handleToggleRyuseigai = async (id: string, nextRyuseigai: boolean) => {
    if (!isAdminAuthenticated) {
      alert('管理者認証が必要です。');
      return;
    }

    if (isSupabaseMode) {
      setAdminNovels((prev) => prev.map((n) => (n.id === id ? { ...n, isRyuseigai: nextRyuseigai } : n)));
      setNovels((prev) => prev.map((n) => (n.id === id ? { ...n, isRyuseigai: nextRyuseigai } : n)));
    } else {
      setNovels((prev) => prev.map((n) => (n.id === id ? { ...n, isRyuseigai: nextRyuseigai } : n)));
    }

    if (isSupabaseMode && supabase) {
      const { error } = await supabase.from('novels').update({ is_ryuseigai: nextRyuseigai }).eq('id', id);
      if (error) {
        console.error('Failed to sync is_ryuseigai:', error);
        setErrorMsg('流星垓状態の同期に失敗しました。');
      }
    }
  };

  // --- 検索ハンドラ ---
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setCurrentPage(1);
  };

  const handleSearchClear = () => {
    setSearchInput('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // --- ページング計算（モード分岐） ---
  const visibleNovels = useMemo(() => {
    let list = novels.filter((novel) => !hiddenNovelIds.includes(novel.id) && !novel.isRyuseigai);
    // オフラインモード: クライアント側で検索フィルタ
    if (!isSupabaseMode && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(q) || n.author.toLowerCase().includes(q));
    }
    // 新着順（投稿日時降順）で統一
    return [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [novels, hiddenNovelIds, isSupabaseMode, searchQuery]);

  // --- 流星垓作品（オフラインモード用） ---
  const offlineRyuseigaiNovels = useMemo(() => {
    if (isSupabaseMode) return [];
    return novels.filter((n) => n.isRyuseigai && !hiddenNovelIds.includes(n.id));
  }, [novels, hiddenNovelIds, isSupabaseMode]);

  const offlineRyuseigaiComments = useMemo(() => {
    if (isSupabaseMode) return [];
    const ids = new Set(offlineRyuseigaiNovels.map((n) => n.id));
    return comments.filter((c) => ids.has(c.novelId));
  }, [comments, offlineRyuseigaiNovels, isSupabaseMode]);

  // Supabaseモード: サーバーが総件数を返す / オフライン: クライアント計算
  const totalPages = isSupabaseMode
    ? Math.max(1, Math.ceil(totalNovelCount / NOVELS_PER_PAGE))
    : Math.max(1, Math.ceil(visibleNovels.length / NOVELS_PER_PAGE));
  const clampedPage = Math.min(currentPage, totalPages);

  // Supabaseモード: visibleNovels（ソート済み）をそのまま使用 / オフライン: クライアントでスライス
  const pagedNovels = useMemo(
    () => isSupabaseMode
      ? visibleNovels
      : visibleNovels.slice((clampedPage - 1) * NOVELS_PER_PAGE, clampedPage * NOVELS_PER_PAGE),
    [visibleNovels, clampedPage, isSupabaseMode],
  );

  // 作品閲覧: Supabaseモードは readNovel / オフラインは visibleNovels から検索
  const activeNovel = isSupabaseMode
    ? readNovel
    : visibleNovels.find((n) => n.id === activeNovelId) ?? null;
  const activeComments = isSupabaseMode
    ? readComments
    : comments.filter((c) => c.novelId === activeNovelId);

  // 流星垓作品閲覧: 共通 readNovel/readComments を使用（オフラインのみ独自フィルタ）
  const activeRyuseigaiNovel = isSupabaseMode
    ? readNovel
    : offlineRyuseigaiNovels.find((n) => n.id === activeNovelId) ?? null;
  const activeRyuseigaiComments = isSupabaseMode
    ? readComments
    : offlineRyuseigaiComments.filter((c) => c.novelId === activeNovelId);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSupabaseMode && supabase) {
      const { error } = await supabase.auth.signInWithPassword({
        email: adminEmailInput.trim(),
        password: adminPassInput,
      });
      if (error) {
        alert(`管理ログインに失敗しました: ${error.message}`);
        return;
      }

      setIsAdminAuthenticated(true);
      setAdminEmailInput('');
      setAdminPassInput('');
      return;
    }

    if (!localAdminPassword) {
      alert('管理画面が無効です。環境変数 VITE_ADMIN_PASSWORD を設定してください。');
      return;
    }
    if (adminPassInput !== localAdminPassword) {
      alert('管理パスワードが違います。');
      return;
    }

    setIsAdminAuthenticated(true);
    sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, String(Date.now()));
    setAdminPassInput('');
  };

  const handleAdminLogout = async () => {
    if (isSupabaseMode && supabase) {
      await supabase.auth.signOut();
    }
    sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    setIsAdminAuthenticated(false);
    setAdminEmailInput('');
    setAdminPassInput('');
  };

  return (
    <div className="site-shell">
      <a href="#main-content" className="skip-link">本文へスキップ</a>
      <div className="site-panel">
        {/* 作品ページ（read/post）と流星垓には通常ヘッダを表示しない */}
        {view !== 'read' && view !== 'post' && view !== 'ryuseigai' && view !== 'ryuseigai-read' && (<>
        {/* 上部ナビ (右寄せ: オリジナルCGI準拠) */}
        <div className="top-nav">
          <a href="#post">&gt;&gt;新規投稿</a> ｜ <a href="#admin">&gt;&gt;管理者用</a> ｜ <button type="button" className="help-link-btn" onClick={() => setShowHelp(true)}>&gt;&gt;ヘルプ</button>{isAdminAuthenticated && <> ｜ <button type="button" className="help-link-btn" onClick={handleAdminLogout}>&gt;&gt;ログアウト</button></>}
        </div>

        {/* タイトル領域 (中央) */}
        <div className="site-pretitle">２ｃｈ文章</div>
        <h1 className="site-title">
          <a href="#">アリの穴NEO</a>
        </h1>
        <div className="site-subtitle">匿名投稿・添削できる修行場所。煽り・罵倒は覚悟の上で</div>

        {/* ステータス行 */}
        <div className="stats-row">
          <span>
            {isSupabaseMode
              ? `全 ${totalNovelCount} 作品`
              : visibleNovels.length === novels.length
                ? `全 ${novels.length} 作品`
                : `全 ${novels.length} 作品中 ${visibleNovels.length} 表示`}
            {totalPages > 1 && ` [ ${clampedPage}/${totalPages} ページ ]`}
          </span>
          <span>
            モード: {isSupabaseMode ? 'オンライン' : 'オフライン'} / 管理人: アリOB
          </span>
        </div>
        </>)}

        {errorMsg && <div className="error-box" role="alert">{errorMsg}</div>}

        <main id="main-content">

        {view === 'list' && (
          <form className="search-bar" onSubmit={handleSearch} role="search" aria-label="作品検索">
            <input
              type="text"
              className="search-input"
              placeholder="タイトル / 作者で検索"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button type="submit" className="classic-button">検索</button>
            {searchQuery && <button type="button" className="classic-button" onClick={handleSearchClear}>解除</button>}
          </form>
        )}

        {view === 'list' && <NovelList novels={pagedNovels} comments={comments} />}
        {view === 'list' && totalPages > 1 && (
          <nav className="pagination" aria-label="ページナビゲーション">
            {clampedPage > 1 && (
              <a href={`#page/${clampedPage - 1}`} className="pagination-arrow">&lt;&lt; 前へ</a>
            )}
            <span className="pagination-dots">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) =>
                p === clampedPage
                  ? <span key={p} className="pagination-dot pagination-dot-active" aria-current="page">●</span>
                  : <a key={p} href={`#page/${p}`} className="pagination-dot">○</a>
              )}
            </span>
            {clampedPage < totalPages && (
              <a href={`#page/${clampedPage + 1}`} className="pagination-arrow">次へ &gt;&gt;</a>
            )}
          </nav>
        )}
        {view === 'post' && <PostForm onPost={handlePost} />}
        {view === 'admin' && !isAdminAuthenticated && (
          <div>
            <div className="section-title">管理者ログイン</div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>{isSupabaseMode ? 'Supabase Auth でログインすると管理機能が有効になります。' : '管理画面はパスワードで保護されています。'}</div>
            <form onSubmit={handleAdminLogin}>
              <table className="form-table">
                <tbody>
                  {isSupabaseMode && (
                    <tr>
                      <td className="form-label">Email</td>
                      <td>
                        <input
                          type="email"
                          value={adminEmailInput}
                          onChange={(e) => setAdminEmailInput(e.target.value)}
                          autoComplete="username"
                          style={{ width: 280, maxWidth: '100%' }}
                        />
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="form-label">{isSupabaseMode ? 'Password' : '管理PW'}</td>
                    <td>
                      <input
                        type="password"
                        value={adminPassInput}
                        onChange={(e) => setAdminPassInput(e.target.value)}
                        autoComplete="current-password"
                        style={{ width: 280, maxWidth: '100%' }}
                      />{' '}
                      <button type="submit" className="classic-button">ログイン</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </form>
          </div>
        )}
        {view === 'admin' && isAdminAuthenticated && (
          <AdminDashboard
            novels={isSupabaseMode ? adminNovels : novels}
            comments={isSupabaseMode ? adminComments : comments}
            hiddenNovelIds={hiddenNovelIds}
            onEditNovel={handleEditNovel}
            onDeleteNovel={handleDeleteNovel}
            onToggleHideNovel={handleToggleHideNovel}
            onBulkToggleHide={handleBulkToggleHide}
            onToggleRyuseigai={handleToggleRyuseigai}
            onResetSeedData={handleResetSeedData}
          />
        )}
        {view === 'read' && activeNovel && <NovelReader novel={activeNovel} comments={activeComments} onComment={handleComment} />}
        {view === 'read' && !activeNovel && !isLoading && <div style={{ padding: 8 }}>投稿が見つからないか、非表示に設定されています。<a href="#">一覧へ戻る</a></div>}
        {view === 'read' && !activeNovel && isLoading && <div style={{ padding: 8 }}>読み込み中...</div>}

        {/* 流星垓 */}
        {view === 'ryuseigai' && (
          <RyuseigaiList
            novels={isSupabaseMode ? ryuseigaiNovels : offlineRyuseigaiNovels}
            comments={isSupabaseMode ? ryuseigaiComments : offlineRyuseigaiComments}
          />
        )}
        {view === 'ryuseigai-read' && activeRyuseigaiNovel && (
          <RyuseigaiReader
            novel={activeRyuseigaiNovel}
            comments={activeRyuseigaiComments}
            onComment={handleComment}
          />
        )}
        {view === 'ryuseigai-read' && !activeRyuseigaiNovel && !isLoading && (
          <div className="ryuseigai-shell"><div className="ryuseigai-panel" style={{ padding: 18, textAlign: 'center' }}>ここには何もない。あるいは、まだ誰も辿り着いていない。</div></div>
        )}
        {view === 'ryuseigai-read' && !activeRyuseigaiNovel && isLoading && (
          <div className="ryuseigai-shell"><div className="ryuseigai-panel" style={{ padding: 18, textAlign: 'center' }}>……</div></div>
        )}
        </main>

        {/* フッター（流星垓には表示しない） */}
        {view !== 'ryuseigai' && view !== 'ryuseigai-read' && (<>
        <hr className="hr-standard" />
        <div className="site-footer">
          <div className="footer-script">Based on Anthology V1.7  Script by YASUU!!</div>
          <div style={{ fontSize: 12, marginTop: 2 }}>総アクセス数: {isSupabaseMode ? '―' : visibleNovels.reduce((acc, n) => acc + n.viewCount, 0)} hits / 稼働環境: React + {isSupabaseMode ? 'Supabase' : 'LocalStorage'}</div>
        </div>
        </>)}

        {showHelp && (
          <div className="help-backdrop" onClick={() => setShowHelp(false)}>
            <div className="help-box" role="dialog" aria-modal="true" aria-label="設定 / ヘルプ" onClick={(e) => e.stopPropagation()}>
              <div className="help-head">
                <span>設定 / ヘルプ</span>
                <button type="button" className="classic-button" onClick={() => setShowHelp(false)}>閉</button>
              </div>
              <div className="help-body">
                <p><b>Supabase利用時の設定</b></p>
                <ol>
                  <li><code>supabase_schema_v2.sql</code> を SQL Editor で実行</li>
                  <li><code>.env</code> に URL / ANON KEY を設定</li>
                  <li>本番は <code>supabase.auth</code> とRLSで管理者のみ更新・削除を許可</li>
                  <li>GitHub Actions の Secrets に同値を設定</li>
                </ol>
                <div style={{ textAlign: 'center' }}>
                  <button type="button" className="classic-button" onClick={() => setShowHelp(false)}>閉じる</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
