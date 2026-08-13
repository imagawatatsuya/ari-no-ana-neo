import React, { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Novel, ViewMode, Comment, NovelListState, SubmitResult, ReaderIndentMode, normalizeAuthorIndentMode } from './types';
import { SEED_NOVELS, SEED_COMMENTS } from './seedData';
import { NovelList } from './components/NovelList';
import { RyuseigaiList } from './components/RyuseigaiList';
import { IndentModeControl } from './components/IndentModeControl';
import { supabase } from './services/supabaseClient';
import { deleteNovelAndComments, editNovelInList, toggleHiddenNovelId } from './adminOps';
import { loadReaderIndentMode, saveReaderIndentMode } from './services/readerPreferences';
import { insertNovelWithAuthorIndentFallback } from './services/supabaseCompatibility';
import { FootnoteMode } from './components/FootnoteRenderer';
import { BASE_PATH, navigate } from './router';
import { useNovelList } from './features/novels/useNovelList';
import { novelsToSummaries } from './features/novels/novelSummaries';
import { NOVELS_PER_PAGE, RYUSEIGAI_LIST_LIMIT } from './services/supabase/novelQueries';

const AdminDashboard = lazy(() =>
  import('./components/AdminDashboard').then((module) => ({
    default: module.AdminDashboard,
  })),
);
const PostForm = lazy(() =>
  import('./components/PostForm').then((module) => ({
    default: module.PostForm,
  })),
);
const NovelReader = lazy(() =>
  import('./components/NovelReader').then((module) => ({
    default: module.NovelReader,
  })),
);
const RyuseigaiReader = lazy(() =>
  import('./components/RyuseigaiReader').then((module) => ({
    default: module.RyuseigaiReader,
  })),
);

const ViewFallback: React.FC = () => (
  <div className="list-status-message" role="status" aria-busy="true">読み込み中……</div>
);

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

const App: React.FC = () => {
  const isSupabaseMode = !!supabase;
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
  const [readNovel, setReadNovel] = useState<Novel | null>(null);
  const [readComments, setReadComments] = useState<Comment[]>([]);
  const [adminNovels, setAdminNovels] = useState<Novel[]>([]);
  const [adminComments, setAdminComments] = useState<Comment[]>([]);
  const [readerIndentMode, setReaderIndentMode] = useState<ReaderIndentMode>(() => loadReaderIndentMode());
  const [isLocalDataLoaded, setIsLocalDataLoaded] = useState(isSupabaseMode);
  const readRequestIdRef = useRef(0);

  const { listState: supabaseListState, totalCount: supabaseTotalCount, refresh: refreshList } = useNovelList(
    isSupabaseMode && view === 'list',
    useMemo(
      () => ({ page: currentPage, search: searchQuery, isRyuseigai: false, pageSize: NOVELS_PER_PAGE }),
      [currentPage, searchQuery],
    ),
  );

  const { listState: supabaseRyuseigaiListState } = useNovelList(
    isSupabaseMode && view === 'ryuseigai',
    useMemo(
      () => ({ page: 1, search: '', isRyuseigai: true, pageSize: RYUSEIGAI_LIST_LIMIT }),
      [],
    ),
  );
  // 脚注表示モード（管理者設定）
  const FOOTNOTE_MODE_KEY = 'bunsho_footnote_mode';
  const [footnoteMode, setFootnoteMode] = useState<FootnoteMode>(
    () => (localStorage.getItem(FOOTNOTE_MODE_KEY) as FootnoteMode) || 'scroll'
  );

  useEffect(() => {
    if (!isSupabaseMode) {
      loadFromLocalStorage();
      setIsLocalDataLoaded(true);
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

  // Supabaseモード: 作品閲覧時に個別取得
  useLayoutEffect(() => {
    if (!isSupabaseMode) return;
    if (view !== 'read' && view !== 'ryuseigai-read') return;
    if (!activeNovelId) return;

    setReadNovel(null);
    setReadComments([]);
    setIsLoading(true);
  }, [view, activeNovelId, isSupabaseMode]);

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

  // Supabaseモード: 流星垓作品閲覧（共通 fetchNovelForRead を使用）
  useEffect(() => {
    if (isSupabaseMode && view === 'ryuseigai-read' && activeNovelId) {
      fetchNovelForRead(activeNovelId);
    }
  }, [view, activeNovelId, isSupabaseMode]);

  useEffect(() => {
    const parseRoute = () => {
      // GitHub Pages 404.html リダイレクト処理
      const stored = sessionStorage.getItem('__spa_path');
      if (stored) {
        sessionStorage.removeItem('__spa_path');
        window.history.replaceState({}, '', stored);
      }

      // 旧ハッシュURL互換: #read/123 等を /read/123 にリダイレクト
      const hash = window.location.hash;
      if (hash && hash !== '#' && hash !== '#main-content') {
        const route = hash.slice(1); // '#read/123' → 'read/123'
        const newPath = BASE_PATH + '/' + route;
        window.history.replaceState({}, '', newPath);
      }

      let path = window.location.pathname;
      if (BASE_PATH && path.startsWith(BASE_PATH)) {
        path = path.slice(BASE_PATH.length) || '/';
      }

      if (path.startsWith('/ryuseigai/read/')) {
        setActiveNovelId(path.replace('/ryuseigai/read/', ''));
        setView('ryuseigai-read');
      } else if (path === '/ryuseigai') {
        setView('ryuseigai');
        setActiveNovelId(null);
      } else if (path.startsWith('/read/')) {
        setActiveNovelId(path.replace('/read/', ''));
        setView('read');
      } else if (path === '/post') {
        setView('post');
        setActiveNovelId(null);
      } else if (path === '/admin') {
        if (!isSupabaseMode && !localAdminPassword) {
          setErrorMsg('管理画面は無効です。オフライン運用では VITE_ADMIN_PASSWORD を設定してください。');
          setView('list');
          navigate('/');
          return;
        }
        setView('admin');
        setActiveNovelId(null);
      } else if (path.startsWith('/page/')) {
        const pageNum = parseInt(path.replace('/page/', ''), 10);
        setCurrentPage(isNaN(pageNum) ? 1 : Math.max(1, pageNum));
        setView('list');
        setActiveNovelId(null);
      } else {
        setCurrentPage(1);
        setView('list');
        setActiveNovelId(null);
      }
    };

    parseRoute();
    window.addEventListener('popstate', parseRoute);
    return () => window.removeEventListener('popstate', parseRoute);
  }, [isSupabaseMode]);

  useEffect(() => {
    if ((view === 'read' || view === 'ryuseigai-read') && activeNovelId) {
      incrementViewCount(activeNovelId);
      window.scrollTo(0, 0);
    }
  }, [activeNovelId, view]);

  useEffect(() => {
    if (!isSupabaseMode && !isLocalDataLoaded) return;
    localStorage.setItem(HIDDEN_IDS_STORAGE_KEY, JSON.stringify(hiddenNovelIds));
  }, [hiddenNovelIds, isLocalDataLoaded, isSupabaseMode]);

  useEffect(() => {
    saveReaderIndentMode(readerIndentMode);
  }, [readerIndentMode]);

  const loadFromLocalStorage = () => {
    const savedNovels = localStorage.getItem('bunsho_novels_v2');
    const savedComments = localStorage.getItem('bunsho_comments_v2');
    setNovels(savedNovels ? JSON.parse(savedNovels) : SEED_NOVELS);
    setComments(savedComments ? JSON.parse(savedComments) : SEED_COMMENTS);
  };

  // --- Supabase: 作品個別取得（閲覧ページ用） ---
  const fetchNovelForRead = async (id: string) => {
    if (!supabase) return;
    const requestId = ++readRequestIdRef.current;
    try {
      const { data: novelData, error: novelError } = await supabase
        .from('novels')
        .select('*')
        .eq('id', id)
        .single();
      if (novelError) throw novelError;
      if (requestId !== readRequestIdRef.current) return;

      const mapped: Novel = {
        id: novelData.id,
        title: novelData.title,
        author: novelData.author,
        trip: novelData.trip,
        body: novelData.body,
        date: novelData.date,
        viewCount: novelData.view_count ? Number(novelData.view_count) : 0,
        commentCount: 0,
        voteSum: 0,
        isHidden: !!novelData.is_hidden,
        description: novelData.description ?? undefined,
        authorMessage: novelData.author_message ?? undefined,
        authorIndentMode: normalizeAuthorIndentMode(novelData.author_indent_mode, 'raw'),
      };
      setReadNovel(mapped);

      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('novel_id', id);
      if (commentsError) throw commentsError;
      if (requestId !== readRequestIdRef.current) return;

      setReadComments((commentsData || []).map((c: any) => ({
        id: c.id,
        novelId: c.novel_id,
        name: c.name,
        text: c.text,
        date: c.date,
        vote: c.vote,
      })));
    } catch (err: any) {
      if (requestId !== readRequestIdRef.current) return;
      console.error('Supabase Error (read):', err);
      setReadNovel(null);
      setReadComments([]);
    } finally {
      if (requestId === readRequestIdRef.current) {
        setIsLoading(false);
      }
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
        commentCount: 0,
        voteSum: 0,
        isHidden: !!n.is_hidden,
        isRyuseigai: !!n.is_ryuseigai,
        description: n.description ?? undefined,
        authorMessage: n.author_message ?? undefined,
        authorIndentMode: normalizeAuthorIndentMode(n.author_indent_mode, 'raw'),
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


  useEffect(() => {
    if (!isSupabaseMode && isLocalDataLoaded) {
      localStorage.setItem('bunsho_novels_v2', JSON.stringify(novels));
    }
  }, [novels, isLocalDataLoaded, isSupabaseMode]);

  useEffect(() => {
    if (!isSupabaseMode && isLocalDataLoaded) {
      localStorage.setItem('bunsho_comments_v2', JSON.stringify(comments));
    }
  }, [comments, isLocalDataLoaded, isSupabaseMode]);

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

  const handlePost = async (novel: Novel): Promise<SubmitResult> => {
    const novelToSave: Novel = {
      ...novel,
      date: getJSTISOString(),
      commentCount: 0,
      voteSum: 0,
    };
    if (isSupabaseMode && supabase) {
      const payload = {
        id: novelToSave.id,
        title: novelToSave.title,
        description: novelToSave.description || null,
        author_message: novelToSave.authorMessage || null,
        author: novelToSave.author,
        trip: novelToSave.trip || null,
        body: novelToSave.body,
        author_indent_mode: novelToSave.authorIndentMode ?? 'none',
        date: novelToSave.date,
      };
      const { error, notice } = await insertNovelWithAuthorIndentFallback(
        supabase.from('novels'),
        payload,
        novelToSave.authorIndentMode ?? 'none',
      );

      if (error) {
        return { ok: false, message: `文章の投稿中にエラーが発生しました: ${error.message ?? 'Supabaseへの保存に失敗しました。'}` };
      }

      navigate('/');
      return { ok: true, novelId: novelToSave.id, notice };
    } else {
      setNovels([novelToSave, ...novels]);
    }
    navigate('/');
    return { ok: true, novelId: novelToSave.id };
  };

  const handleComment = async (comment: Comment): Promise<boolean> => {
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
        return false;
      }
      setReadComments((prev) => [...prev, commentToSave]);
    } else {
      setComments((prev) => [...prev, commentToSave]);
    }
    return true;
  };


  const handleEditNovel = async (id: string, patch: Pick<Novel, 'title' | 'description' | 'authorMessage' | 'author' | 'trip' | 'body'>) => {
    if (!isAdminAuthenticated) {
      alert('管理者認証が必要です。');
      return;
    }

    if (isSupabaseMode && supabase) {
      const { error } = await supabase
        .from('novels')
        .update({
          title: patch.title,
          description: patch.description || null,
          author_message: patch.authorMessage || null,
          author: patch.author,
          trip: patch.trip ?? null,
          body: patch.body,
        })
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
      navigate('/');
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
      let next = …1043 tokens truncated…S_PER_PAGE, clampedPage * NOVELS_PER_PAGE),
    [visibleNovels, clampedPage],
  );

  const offlineListState = useMemo((): NovelListState => {
    if (pagedNovels.length === 0 && visibleNovels.length === 0) {
      return { status: 'empty' };
    }
    return {
      status: 'success',
      items: novelsToSummaries(pagedNovels, comments),
      totalCount: visibleNovels.length,
    };
  }, [pagedNovels, comments, visibleNovels]);

  const offlineRyuseigaiListState = useMemo((): NovelListState => {
    if (offlineRyuseigaiNovels.length === 0) {
      return { status: 'empty' };
    }
    return {
      status: 'success',
      items: novelsToSummaries(offlineRyuseigaiNovels, offlineRyuseigaiComments),
      totalCount: offlineRyuseigaiNovels.length,
    };
  }, [offlineRyuseigaiNovels, offlineRyuseigaiComments]);

  const listStateForView = isSupabaseMode ? supabaseListState : offlineListState;
  const ryuseigaiListStateForView = isSupabaseMode ? supabaseRyuseigaiListState : offlineRyuseigaiListState;

  // 作品閲覧: Supabaseモードは readNovel（ID一致時のみ） / オフラインは visibleNovels から検索
  const activeNovel = isSupabaseMode
    ? (readNovel?.id === activeNovelId ? readNovel : null)
    : visibleNovels.find((n) => n.id === activeNovelId) ?? null;
  const activeComments = isSupabaseMode
    ? (readNovel?.id === activeNovelId ? readComments : [])
    : comments.filter((c) => c.novelId === activeNovelId);

  // 流星垓作品閲覧: 共通 readNovel/readComments を使用（オフラインのみ独自フィルタ）
  const activeRyuseigaiNovel = isSupabaseMode
    ? (readNovel?.id === activeNovelId ? readNovel : null)
    : offlineRyuseigaiNovels.find((n) => n.id === activeNovelId) ?? null;
  const activeRyuseigaiComments = isSupabaseMode
    ? (readNovel?.id === activeNovelId ? readComments : [])
    : offlineRyuseigaiComments.filter((c) => c.novelId === activeNovelId);

  // SEO: document.title / meta / favicon / JSON-LD を動的切替
  useEffect(() => {
    const SITE_NAME = '文章アリの穴NEO';
    const BASE_URL = 'https://imagawatatsuya.github.io/ari-no-ana-neo/';
    const defaultTitle = SITE_NAME;
    const defaultDesc = '文章アリの穴NEO - 匿名投稿・添削できる修行場所。2005年のテキスト投稿サイト「文章アリの穴」をオマージュした再現サイト。';
    const defaultIcon = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐜</text></svg>";

    const ryuseigaiTitle = '流星垓';
    const ryuseigaiDesc = 'ここに捨てられたものは、まだ息をしている。救済はない。ただ、在る。';
    const ryuseigaiIcon = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>☄️</text></svg>";

    // 現在閲覧中の作品（通常 or 流星垓）
    const readingNovel = view === 'read' ? activeNovel : view === 'ryuseigai-read' ? activeRyuseigaiNovel : null;
    const isRyuseigaiView = view === 'ryuseigai' || view === 'ryuseigai-read';

    let title: string;
    let desc: string;
    let icon: string;

    if (readingNovel) {
      // 記事個別: 「作品名｜作者名 - サイト名」
      const authorDisplay = readingNovel.author || '名無し';
      title = `${readingNovel.title}｜${authorDisplay} - ${SITE_NAME}`;
      // 本文冒頭120文字を description に（脚注記法・URL除去）
      const plainBody = readingNovel.body
        .replace(/\[\^.+?\]/g, '')
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/[\n\r\u3000\t]/g, ' ')
        .trim();
      desc = plainBody.slice(0, 120) || defaultDesc;
      icon = isRyuseigaiView ? ryuseigaiIcon : defaultIcon;
    } else if (isRyuseigaiView) {
      title = ryuseigaiTitle;
      desc = ryuseigaiDesc;
      icon = ryuseigaiIcon;
    } else {
      title = defaultTitle;
      desc = defaultDesc;
      icon = defaultIcon;
    }

    document.title = title;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', desc);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', desc);

    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (favicon) favicon.href = icon;

    // JSON-LD 構造化データ（記事閲覧時のみ）
    const existingLd = document.getElementById('seo-jsonld');
    if (existingLd) existingLd.remove();

    if (readingNovel) {
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: readingNovel.title,
        author: { '@type': 'Person', name: readingNovel.author || '名無し' },
        datePublished: readingNovel.date ? readingNovel.date.slice(0, 10) : undefined,
        description: desc,
        mainEntityOfPage: { '@type': 'WebPage', '@id': BASE_URL },
        publisher: { '@type': 'Organization', name: SITE_NAME },
      };
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'seo-jsonld';
      script.textContent = JSON.stringify(ld);
      document.head.appendChild(script);
    }
  }, [view, activeNovel, activeRyuseigaiNovel]);

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
          <a href={BASE_PATH + '/post'} onClick={(e) => { e.preventDefault(); navigate('/post'); }}>&gt;&gt;新規投稿</a> ｜ <a href={BASE_PATH + '/admin'} onClick={(e) => { e.preventDefault(); navigate('/admin'); }}>&gt;&gt;管理者用</a> ｜ <button type="button" className="help-link-btn" onClick={() => setShowHelp(true)}>&gt;&gt;設定 / ヘルプ</button>{isAdminAuthenticated && <> ｜ <button type="button" className="help-link-btn" onClick={handleAdminLogout}>&gt;&gt;ログアウト</button></>}
        </div>

        {/* タイトル領域 (中央) */}
        <div className="site-pretitle">２ｃｈ文章</div>
        <h1 className="site-title">
          <a href={BASE_PATH + '/'} onClick={(e) => { e.preventDefault(); navigate('/'); }}>アリの穴NEO</a>
        </h1>
        <div className="site-subtitle">匿名投稿・添削できる修行場所。煽り・罵倒は覚悟の上で</div>

        {/* ステータス行（管理画面のみ。一覧は list-toolbar 内） */}
        {view === 'admin' && (
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
        )}
        </>)}

        {errorMsg && <div className="error-box" role="alert">{errorMsg}</div>}

        <main id="main-content">

        {view === 'list' && (
          <div className="list-toolbar">
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
          </div>
        )}

        {view === 'list' && (
          <NovelList
            state={listStateForView}
            onRetry={isSupabaseMode ? refreshList : undefined}
          />
        )}
        {view === 'list' && totalPages > 1 && (
          <nav className="pagination" aria-label="ページナビゲーション">
            {clampedPage > 1 && (
              <a href={BASE_PATH + `/page/${clampedPage - 1}`} onClick={(e) => { e.preventDefault(); navigate(`/page/${clampedPage - 1}`); }} className="pagination-arrow">&lt;&lt; 前へ</a>
            )}
            <span className="pagination-dots">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) =>
                p === clampedPage
                  ? <span key={p} className="pagination-dot pagination-dot-active" aria-current="page">●</span>
                  : <a key={p} href={BASE_PATH + `/page/${p}`} onClick={(e) => { e.preventDefault(); navigate(`/page/${p}`); }} className="pagination-dot">○</a>
              )}
            </span>
            {clampedPage < totalPages && (
              <a href={BASE_PATH + `/page/${clampedPage + 1}`} onClick={(e) => { e.preventDefault(); navigate(`/page/${clampedPage + 1}`); }} className="pagination-arrow">次へ &gt;&gt;</a>
            )}
          </nav>
        )}
        {view === 'post' && (
          <Suspense fallback={<ViewFallback />}>
            <PostForm onPost={handlePost} footnoteMode={footnoteMode} />
          </Suspense>
        )}
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
          <Suspense fallback={<ViewFallback />}>
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
              footnoteMode={footnoteMode}
              onChangeFootnoteMode={(mode) => {
                setFootnoteMode(mode);
                localStorage.setItem(FOOTNOTE_MODE_KEY, mode);
              }}
            />
          </Suspense>
        )}
        {view === 'read' && activeNovel && (
          <Suspense fallback={<ViewFallback />}>
            <NovelReader
              novel={activeNovel}
              comments={activeComments}
              onComment={handleComment}
              footnoteMode={footnoteMode}
              indentMode={readerIndentMode}
              onIndentModeChange={setReaderIndentMode}
              onOpenReaderSettings={() => setShowHelp(true)}
            />
          </Suspense>
        )}
        {view === 'read' && !activeNovel && !isLoading && <div style={{ padding: 8 }}>投稿が見つからないか、非表示に設定されています。<a href={BASE_PATH + '/'} onClick={(e) => { e.preventDefault(); navigate('/'); }}>一覧へ戻る</a></div>}
        {view === 'read' && !activeNovel && isLoading && <div style={{ padding: 8 }}>読み込み中...</div>}

        {/* 流星垓 */}
        {view === 'ryuseigai' && (
          <RyuseigaiList state={ryuseigaiListStateForView} />
        )}
        {view === 'ryuseigai-read' && activeRyuseigaiNovel && (
          <Suspense fallback={<ViewFallback />}>
            <RyuseigaiReader
              novel={activeRyuseigaiNovel}
              comments={activeRyuseigaiComments}
              onComment={handleComment}
              footnoteMode={footnoteMode}
              indentMode={readerIndentMode}
              onIndentModeChange={setReaderIndentMode}
              onOpenReaderSettings={() => setShowHelp(true)}
            />
          </Suspense>
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
                <section className="help-settings" aria-labelledby="help-indent-settings-title">
                  <h2 id="help-indent-settings-title" className="section-title">■ 字下げ設定</h2>
                  <p>作品本文の行頭字下げを、読者ごとに切り替えられます。設定はこのブラウザに保存されます。</p>
                  <IndentModeControl
                    mode={readerIndentMode}
                    onChange={setReaderIndentMode}
                    name="settings-reader-indent-mode"
                    note="既定値は投稿者設定です。全角空白1字は整理し、二字以上の手動空白は保持します。脚注には適用しません。"
                  />
                </section>
                <p><b>■ 閲覧</b></p>
                <p>一覧からタイトルをクリックすると作品を読めます。作品内の <span className="footnote-ref-link">[1]</span> 等の番号は脚注へのリンクです。</p>
                <p><b>■ 投稿</b></p>
                <p>「新規投稿」から作品を投稿できます。タイトル・本文を入力し、プレビュー確認後に送信してください。本文内の <code>[^1]</code> と <code>[^1]: 脚注テキスト</code> で脚注を使えます。</p>
                <p><b>■ 感想・評価</b></p>
                <p>作品ページ下部から感想を投稿できます。評価（とても良い～最悪）を選んで投票してください。</p>
                <p><b>■ その他</b></p>
                <p>当サイトは2005年のテキスト投稿サイト「文章アリの穴」をオマージュした再現サイトです。煽り・罵倒は覚悟の上で。</p>
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

