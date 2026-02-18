import React, { useEffect, useMemo, useState } from 'react';
import { Novel, ViewMode, Comment } from './types';
import { SEED_NOVELS, SEED_COMMENTS } from './seedData';
import { NovelList } from './components/NovelList';
import { NovelReader } from './components/NovelReader';
import { PostForm } from './components/PostForm';
import { AdminDashboard } from './components/AdminDashboard';
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
const localAdminUsername = process.env.VITE_ADMIN_USERNAME?.trim() || '';
const localAdminPassword = process.env.VITE_ADMIN_PASSWORD?.trim() || '';

const LATEST_DEPLOYED_AT_ISO = '2026-02-19T02:03:13+09:00';
const DEPLOY_HIGHLIGHT_DURATION_MS = 1000 * 60 * 2;
const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

const formatJSTWithWeekday = (isoDate: string) => {
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const weekday = WEEKDAYS_JA[date.getDay()];
  return `${year}/${month}/${day}(${weekday}) ${hours}:${minutes}:${seconds} 日本時刻`;
};

const App: React.FC = () => {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [hiddenNovelIds, setHiddenNovelIds] = useState<string[]>([]);
  const [view, setView] = useState<ViewMode>('list');
  const [activeNovelId, setActiveNovelId] = useState<string | null>(null);
  const [, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [adminIdInput, setAdminIdInput] = useState('');
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isSupabaseMode = !!supabase;

  useEffect(() => {
    if (isSupabaseMode) {
      fetchDataFromSupabase();
    } else {
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

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#read/')) {
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
      } else {
        setView('list');
        setActiveNovelId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isSupabaseMode]);

  useEffect(() => {
    if (view === 'read' && activeNovelId) {
      incrementViewCount(activeNovelId);
    }
  }, [activeNovelId, view]);

  useEffect(() => {
    localStorage.setItem(HIDDEN_IDS_STORAGE_KEY, JSON.stringify(hiddenNovelIds));
  }, [hiddenNovelIds]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  const loadFromLocalStorage = () => {
    const savedNovels = localStorage.getItem('bunsho_novels_v2');
    const savedComments = localStorage.getItem('bunsho_comments_v2');
    setNovels(savedNovels ? JSON.parse(savedNovels) : SEED_NOVELS);
    setComments(savedComments ? JSON.parse(savedComments) : SEED_COMMENTS);
  };

  const fetchDataFromSupabase = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data: novelsData, error: novelsError } = await supabase.from('novels').select('*').order('date', { ascending: false });
      if (novelsError) throw novelsError;

      const { data: commentsData, error: commentsError } = await supabase.from('comments').select('*');
      if (commentsError) throw commentsError;

      const mappedNovels: Novel[] = (novelsData || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        author: n.author,
        trip: n.trip,
        body: n.body,
        date: n.date,
        viewCount: n.view_count ? Number(n.view_count) : 0,
      }));

      const mappedComments: Comment[] = (commentsData || []).map((c: any) => ({
        id: c.id,
        novelId: c.novel_id,
        name: c.name,
        text: c.text,
        date: c.date,
        vote: c.vote,
      }));

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

  useEffect(() => {
    if (!isSupabaseMode) localStorage.setItem('bunsho_novels_v2', JSON.stringify(novels));
  }, [novels, isSupabaseMode]);

  useEffect(() => {
    if (!isSupabaseMode) localStorage.setItem('bunsho_comments_v2', JSON.stringify(comments));
  }, [comments, isSupabaseMode]);

  const incrementViewCount = async (id: string) => {
    setNovels((prev) => prev.map((n) => (n.id === id ? { ...n, viewCount: n.viewCount + 1 } : n)));

    if (isSupabaseMode && supabase) {
      await supabase.rpc('increment_novel_view', { target_novel_id: id });
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
          author: novelToSave.author,
          trip: novelToSave.trip,
          body: novelToSave.body,
          date: novelToSave.date,
          view_count: novelToSave.viewCount,
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
          name: commentToSave.name,
          text: commentToSave.text,
          date: commentToSave.date,
          vote: commentToSave.vote,
        },
      ]);
      if (error) {
        alert(`コメントの投稿中にエラーが発生しました: ${error.message}`);
        return;
      }
    }
    setComments((prev) => [...prev, commentToSave]);
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

    setNovels((prev) => editNovelInList(prev, id, patch));
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

    const nextState = deleteNovelAndComments(novels, comments, id);
    setNovels(nextState.novels);
    setComments(nextState.comments);
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

  const visibleNovels = useMemo(
    () => novels.filter((novel) => !hiddenNovelIds.includes(novel.id)),
    [novels, hiddenNovelIds],
  );

  const latestDeployedAtText = useMemo(
    () => formatJSTWithWeekday(LATEST_DEPLOYED_AT_ISO),
    [],
  );
  const deployElapsedMs = Math.max(0, nowMs - new Date(LATEST_DEPLOYED_AT_ISO).getTime());
  const isFreshDeploy = deployElapsedMs < DEPLOY_HIGHLIGHT_DURATION_MS;

  const activeNovel = visibleNovels.find((n) => n.id === activeNovelId);

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
      setAdminIdInput('');
      setAdminPassInput('');
      return;
    }

    if (!localAdminPassword) {
      alert('管理画面が無効です。環境変数 VITE_ADMIN_PASSWORD を設定してください。');
      return;
    }
    if (localAdminUsername && adminIdInput.trim() !== localAdminUsername) {
      alert('管理IDが違います。');
      return;
    }
    if (adminPassInput !== localAdminPassword) {
      alert('管理パスワードが違います。');
      return;
    }

    setIsAdminAuthenticated(true);
    sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, String(Date.now()));
    setAdminIdInput('');
    setAdminPassInput('');
  };

  const handleAdminLogout = async () => {
    if (isSupabaseMode && supabase) {
      await supabase.auth.signOut();
    }
    sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    setIsAdminAuthenticated(false);
    setAdminIdInput('');
    setAdminEmailInput('');
    setAdminPassInput('');
  };

  return (
    <div className="site-shell">
      <div className="site-panel">
        <h1 className="site-title">
          <a href="#" style={{ color: '#7a0000', textDecoration: 'none' }}>文章アリの穴NEO</a>
        </h1>

        <div className="header-links">[ <a href="#">トップ</a> ] [ <a href="#post">投稿する</a> ] [ <a href="#admin">管理</a> ] [ <a href="#" onClick={(e) => e.preventDefault()}>検索</a> ] [ <button type="button" className="help-link-btn" onClick={() => setShowHelp(true)}>ヘルプ</button> ] {isAdminAuthenticated && <button type="button" className="help-link-btn" onClick={handleAdminLogout}>[ 管理ログアウト ]</button>}</div>

        <div className="site-meta">管理人: <b>アリOB</b> / モード: {isSupabaseMode ? 'オンライン' : 'オフライン'} / 投稿数: {visibleNovels.length}（全{novels.length}）</div>
        <div className="site-meta">
          最新デプロイ: <b>{latestDeployedAtText}</b>
          {isFreshDeploy && <span className="live-deploy-dot" aria-label="デプロイ直後" title="デプロイ直後（2分間）">●</span>}
        </div>

        {errorMsg && <div className="error-box">{errorMsg}</div>}

        <hr className="top-rule" />
        <div className="marquee-box">2005年のテキスト投稿サイトをオマージュして再現中。感想・評価の書き込み歓迎です。</div>

        {view === 'list' && <NovelList novels={visibleNovels} comments={comments} />}
        {view === 'post' && <PostForm onPost={handlePost} />}
        {view === 'admin' && !isAdminAuthenticated && (
          <div>
            <div className="section-title">■ 管理者ログイン</div>
            <div className="legend-box">{isSupabaseMode ? 'Supabase Auth でログインすると管理機能が有効になります。運用時はRLSで管理者権限を制御してください。' : '管理画面はIDとパスワードで保護できます（IDは任意設定）。認証後、編集・削除・非表示が可能です。'}</div>
            <form onSubmit={handleAdminLogin}>
              <table className="classic-table">
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
                  {!isSupabaseMode && (
                    <tr>
                      <td className="form-label">管理ID</td>
                      <td>
                        <input
                          type="text"
                          value={adminIdInput}
                          onChange={(e) => setAdminIdInput(e.target.value)}
                          autoComplete="username"
                          placeholder={localAdminUsername ? '管理IDを入力' : '未設定（任意）'}
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
            novels={novels}
            comments={comments}
            hiddenNovelIds={hiddenNovelIds}
            onEditNovel={handleEditNovel}
            onDeleteNovel={handleDeleteNovel}
            onToggleHideNovel={handleToggleHideNovel}
            onResetSeedData={handleResetSeedData}
          />
        )}
        {view === 'read' && activeNovel && <NovelReader novel={activeNovel} comments={comments.filter((c) => c.novelId === activeNovel.id)} onComment={handleComment} />}
        {view === 'read' && !activeNovel && <div className="legend-box">投稿が見つからないか、非表示に設定されています。<a href="#">一覧へ戻る</a></div>}

        <div className="site-footer">
          文章アリの穴NEO / 稼働環境: React + {isSupabaseMode ? 'Supabase' : 'LocalStorage'}
          <div className="footer-hit">総アクセス数: {visibleNovels.reduce((acc, n) => acc + n.viewCount, 0)} hits</div>
        </div>

        {showHelp && (
          <div className="help-backdrop" onClick={() => setShowHelp(false)}>
            <div className="help-box" onClick={(e) => e.stopPropagation()}>
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
