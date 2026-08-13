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

  useEf