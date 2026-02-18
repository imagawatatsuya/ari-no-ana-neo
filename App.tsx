import React, { useEffect, useState } from 'react';
import { Novel, ViewMode, Comment } from './types';
import { NovelList } from './components/NovelList';
import { NovelReader } from './components/NovelReader';
import { PostForm } from './components/PostForm';
import { supabase } from './services/supabaseClient';

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

const SEED_NOVELS: Novel[] = [
  {
    id: '1',
    title: 'Perl僧侶の憂鬱',
    author: 'Kyuu',
    trip: '◆LEGEND05',
    body: `これは 'use strict' の使用を断固として拒んだ男の物語である。

サーバー室は暗く、外は嵐が吹き荒れていた。エラーログは驚くべき速度で埋め尽くされていく。「Premature end of script headers...」彼は呟き、厳格な禁煙ポリシーを無視してタバコに火をつけた。

（続く...）`,
    date: '2005-05-23T14:30:00+09:00',
    viewCount: 1543,
  },
  {
    id: '2',
    title: '正規表現に転生した件について',
    author: 'RegExWizard',
    date: '2005-05-24T09:15:00+09:00',
    body: `目が覚めると、私はもはや人間ではなかった。私はキャプチャグループに分割されていたのだ。

/([a-z]+)@([a-z]+)/

私の人生は今や、純粋なパターンマッチングに過ぎない。`,
    viewCount: 890,
  },
];

const SEED_COMMENTS: Comment[] = [
  { id: 'c1', novelId: '1', name: 'ファン', text: '更新はよ！', date: '2005-05-23T15:00:00+09:00', vote: 2 },
  { id: 'c2', novelId: '1', name: '辛口評論家', text: '短すぎる。', date: '2005-05-23T16:20:00+09:00', vote: -1 },
  { id: 'c3', novelId: '2', name: '774', text: '興味深いコンセプトだ。', date: '2005-05-24T10:00:00+09:00', vote: 1 },
];

const App: React.FC = () => {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [view, setView] = useState<ViewMode>('list');
  const [activeNovelId, setActiveNovelId] = useState<string | null>(null);
  const [, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const isSupabaseMode = !!supabase;

  useEffect(() => {
    if (isSupabaseMode) {
      fetchDataFromSupabase();
    } else {
      loadFromLocalStorage();
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#read/')) {
        setActiveNovelId(hash.replace('#read/', ''));
        setView('read');
      } else if (hash === '#post') {
        setView('post');
        setActiveNovelId(null);
      } else {
        setView('list');
        setActiveNovelId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (view === 'read' && activeNovelId) {
      incrementViewCount(activeNovelId);
    }
  }, [activeNovelId, view]);

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
      const currentNovel = novels.find((n) => n.id === id);
      if (currentNovel) await supabase.from('novels').update({ view_count: currentNovel.viewCount + 1 }).eq('id', id);
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

  const activeNovel = novels.find((n) => n.id === activeNovelId);

  return (
    <div className="site-shell">
      <div className="site-panel">
        <h1 className="site-title">
          <a href="#" style={{ color: '#7a0000', textDecoration: 'none' }}>文章アリの穴NEO</a>
        </h1>

        <div className="header-links">[ <a href="#">トップ</a> ] [ <a href="#post">投稿する</a> ] [ <a href="#" onClick={(e) => e.preventDefault()}>検索</a> ] [ <button type="button" className="help-link-btn" onClick={() => setShowHelp(true)}>ヘルプ</button> ]</div>

        <div className="site-meta">管理人: <b>アリOB</b> / モード: {isSupabaseMode ? 'オンライン' : 'オフライン'} / 投稿数: {novels.length}</div>

        {errorMsg && <div className="error-box">{errorMsg}</div>}

        <hr className="top-rule" />
        <div className="marquee-box">2005年のテキスト投稿サイトをオマージュして再現中。感想・評価の書き込み歓迎です。</div>

        {view === 'list' && <NovelList novels={novels} comments={comments} />}
        {view === 'post' && <PostForm onPost={handlePost} />}
        {view === 'read' && activeNovel && <NovelReader novel={activeNovel} comments={comments.filter((c) => c.novelId === activeNovel.id)} onComment={handleComment} />}

        <div className="site-footer">
          文章アリの穴NEO / 稼働環境: React + {isSupabaseMode ? 'Supabase' : 'LocalStorage'}
          <div className="footer-hit">総アクセス数: {novels.reduce((acc, n) => acc + n.viewCount, 0)} hits</div>
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
                  <li><code>supabase_schema.sql</code> を SQL Editor で実行</li>
                  <li><code>.env</code> に URL / ANON KEY を設定</li>
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
