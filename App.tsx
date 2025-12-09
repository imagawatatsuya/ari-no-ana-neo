import React, { useState, useEffect } from 'react';
import { Novel, ViewMode, Comment } from './types';
import { NovelList } from './components/NovelList';
import { NovelReader } from './components/NovelReader';
import { PostForm } from './components/PostForm';
import { supabase } from './services/supabaseClient';
// 1. ファイルの上部でインポートを追加

// Separated Seed Data to simulate relational DB (Fallback for Local/Demo mode)
const SEED_NOVELS: Novel[] = [
  {
    id: '1',
    title: 'Perl僧侶の憂鬱',
    author: 'Kyuu',
    trip: '◆LEGEND05',
    body: `これは 'use strict' の使用を断固として拒んだ男の物語である。\n\nサーバー室は暗く、外は嵐が吹き荒れていた。エラーログは驚くべき速度で埋め尽くされていく。「Premature end of script headers...」彼は呟き、厳格な禁煙ポリシーを無視してタバコに火をつけた。\n\n（続く...）`,
    date: new Date(2005, 4, 23, 14, 30).toISOString(),
    viewCount: 1543,
  },
  {
    id: '2',
    title: '正規表現に転生した件について',
    author: 'RegExWizard',
    date: new Date(2005, 4, 24, 9, 15).toISOString(),
    body: `目が覚めると、私はもはや人間ではなかった。私はキャプチャグループに分割されていたのだ。\n\n/([a-z]+)@([a-z]+)/\n\n私の人生は今や、純粋なパターンマッチングに過ぎない。`,
    viewCount: 890,
  }
];

const SEED_COMMENTS: Comment[] = [
  { id: 'c1', novelId: '1', name: 'ファン', text: '更新はよ！', date: new Date(2005, 4, 23, 15, 0).toISOString(), vote: 2 },
  { id: 'c2', novelId: '1', name: '辛口評論家', text: '短すぎる。', date: new Date(2005, 4, 23, 16, 20).toISOString(), vote: -1 },
  { id: 'c3', novelId: '2', name: '774', text: '興味深いコンセプトだ。', date: new Date(2005, 4, 24, 10, 0).toISOString(), vote: 1 }
];

const App: React.FC = () => {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [view, setView] = useState<ViewMode>('list');
  const [activeNovelId, setActiveNovelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Check if we are running in Supabase mode
  const isSupabaseMode = !!supabase;

  // Initial Data Fetch
  useEffect(() => {
    if (isSupabaseMode) {
      fetchDataFromSupabase();
    } else {
      loadFromLocalStorage();
    }
  }, []);

  // Hash Routing Listener
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#read/')) {
        const id = hash.replace('#read/', '');
        setActiveNovelId(id);
        setView('read');
      } else if (hash === '#post') {
        setView('post');
        setActiveNovelId(null);
      } else {
        // Default to list for #list, empty hash, or unknown hash
        setView('list');
        setActiveNovelId(null);
      }
    };

    // Initial check
    handleHashChange();

    // Listen for changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Increment View Count when opening a novel (detected by activeNovelId change)
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
      // Fetch Novels
      const { data: novelsData, error: novelsError } = await supabase
        .from('novels')
        .select('*')
        .order('date', { ascending: false });

      if (novelsError) throw novelsError;

      // Fetch Comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*');

      if (commentsError) throw commentsError;

      // Map Snake_case DB columns to CamelCase Types
      const mappedNovels: Novel[] = (novelsData || []).map((n: any) => ({
        id: n.id,
        title: n.title,
        author: n.author,
        trip: n.trip,
        body: n.body,
        date: n.date,
        // Ensure view_count is treated as a number, handling potential nulls or bigint strings
        viewCount: n.view_count ? Number(n.view_count) : 0
      }));

      const mappedComments: Comment[] = (commentsData || []).map((c: any) => ({
        id: c.id,
        novelId: c.novel_id,
        name: c.name,
        text: c.text,
        date: c.date,
        vote: c.vote
      }));

      setNovels(mappedNovels);
      setComments(mappedComments);
    } catch (err: any) {
      console.error("Supabase Error:", err);
      setErrorMsg("データベースへの接続に失敗しました。オフラインモードで表示します。");
      loadFromLocalStorage(); // Fallback on error
    } finally {
      setIsLoading(false);
    }
  };

  // Sync to LocalStorage only if NOT in Supabase mode (Legacy mode)
  useEffect(() => {
    if (!isSupabaseMode) {
      localStorage.setItem('bunsho_novels_v2', JSON.stringify(novels));
    }
  }, [novels, isSupabaseMode]);

  useEffect(() => {
    if (!isSupabaseMode) {
      localStorage.setItem('bunsho_comments_v2', JSON.stringify(comments));
    }
  }, [comments, isSupabaseMode]);

  const incrementViewCount = async (id: string) => {
    // Optimistic update for UI
    setNovels(prev => prev.map(n => n.id === id ? { ...n, viewCount: n.viewCount + 1 } : n));

    // DB Update
    if (isSupabaseMode && supabase) {
      // We need to find the current count to increment it safely if not using RPC, 
      // but for this simple app, we will just use the optimistic value or re-fetch approach?
      // Best effort: fetch current single novel to get real count, then increment.
      // To save calls, we'll just rely on the mapped update or previous state.
      const currentNovel = novels.find(n => n.id === id);
      if (currentNovel) {
        await supabase
          .from('novels')
          .update({ view_count: currentNovel.viewCount + 1 })
          .eq('id', id);
      }
    }
  };

  const handlePost = async (novel: Novel) => {
    if (isSupabaseMode && supabase) {
      setIsLoading(true);
      const { error } = await supabase.from('novels').insert([{
        id: novel.id,
        title: novel.title,
        author: novel.author,
        trip: novel.trip,
        body: novel.body,
        date: novel.date,
        view_count: novel.viewCount
      }]);
      setIsLoading(false);
      
      if (error) {
        alert('文章の投稿中にエラーが発生しました: ' + error.message);
        return;
      }
      setNovels([novel, ...novels]);
    } else {
      setNovels([novel, ...novels]);
    }
    // Navigate back to list using hash
    window.location.hash = '';
  };

  const handleComment = async (comment: Comment) => {
    if (isSupabaseMode && supabase) {
      const { error } = await supabase.from('comments').insert([{
        id: comment.id,
        novel_id: comment.novelId,
        name: comment.name,
        text: comment.text,
        date: comment.date,
        vote: comment.vote
      }]);

      if (error) {
        alert('コメントの投稿中にエラーが発生しました: ' + error.message);
        return;
      }
      setComments(prev => [...prev, comment]);
    } else {
      setComments(prev => [...prev, comment]);
    }
  };

  const activeNovel = novels.find(n => n.id === activeNovelId);

  return (
    <div className="min-h-screen flex flex-col items-center py-4">
      {/* Main Container - Fixed width for that old school feel */}
      <div className="w-full max-w-[800px] bg-white border border-gray-600 p-2 shadow-lg relative">
        
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
            <div className="text-[#800000] font-bold text-lg animate-pulse">データストアにアクセス中...</div>
          </div>
        )}

        {/* Header Area */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold tracking-wide">
            <a href="#" className="text-[#800000] no-underline hover:text-red-600">アリの穴NEO</a>
          </h1>
          <p className="text-xs mt-1 text-gray-600">
            [ <a href="#">トップ</a> ] 
            [ <a href="#post">新規投稿</a> ] 
            [ <a href="#" onClick={(e) => e.preventDefault()}>検索</a> ]
          </p>
          <div className="mt-2 text-xs text-right text-gray-500">
            管理人: <b>アリOB</b> | モード: {isSupabaseMode ? 'オンライン' : 'オフライン (LocalStorage)'}
            <button 
              onClick={() => setShowHelp(true)} 
              className="ml-2 text-blue-600 underline hover:text-red-600 cursor-pointer"
            >
              [ 設定 / ヘルプ ]
            </button>
          </div>
          {errorMsg && (
             <div className="bg-red-100 text-red-800 text-xs p-1 mt-1 border border-red-300">
               {errorMsg}
             </div>
          )}
        </div>

        <hr className="border-t border-gray-400 mb-4" />

        {/* Dynamic Content Area */}
        {view === 'list' && (
          <NovelList 
            novels={novels} 
            comments={comments}
          />
        )}

        {view === 'post' && (
          <PostForm onPost={handlePost} />
        )}

        {view === 'read' && activeNovel && (
          <NovelReader 
            novel={activeNovel}
            comments={comments.filter(c => c.novelId === activeNovel.id)}
            onComment={handleComment}
          />
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-gray-400 pt-2 text-center text-xs text-gray-600">
          <p>
            アリの穴NEO &copy; 2025-2025 All rights reserved.<br/>
            制作: <a href="#">LegendaryPerlCoder</a><br/>
            稼働環境: React 18 + {isSupabaseMode ? 'Supabase DB' : 'LocalStorage'}
          </p>
          <p className="mt-2">
            総アクセス数: {0 + novels.reduce((acc, n) => acc + n.viewCount, 0)} hits.
          </p>
        </div>
        
        {/* Help Modal for Setup */}
        {showHelp && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowHelp(false)}>
            <div className="bg-[#D4D0C8] border-2 border-white border-b-black border-r-black p-1 max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="bg-[#000080] text-white px-2 py-1 font-bold text-sm flex justify-between items-center">
                <span>システム設定ヘルパー</span>
                <button onClick={() => setShowHelp(false)} className="bg-[#D4D0C8] text-black px-1 border border-gray-500 text-xs font-bold">X</button>
              </div>
              <div className="p-4 text-sm text-black font-sans">
                <p className="mb-2 font-bold">オンラインデータベースの有効化手順:</p>
                
                <div className="mb-3 border border-gray-400 p-2 bg-white">
                  <p className="font-bold text-blue-800 mb-1">手順 1: Supabaseのセットアップ</p>
                  <ul className="list-disc pl-5 text-xs space-y-1">
                    <li><b>supabase.com</b> でプロジェクトを作成</li>
                    <li><code>supabase_schema.sql</code> のSQLをコピー</li>
                    <li>Supabaseの <b>SQL Editor</b> で実行</li>
                    <li><b>Project URL</b> と <b>Anon Public Key</b> を取得</li>
                  </ul>
                </div>

                <div className="mb-3 border border-gray-400 p-2 bg-white">
                  <p className="font-bold text-green-800 mb-1">手順 2A: ローカルでのテスト</p>
                  <p className="text-xs mb-1">ローカルに <code>.env</code> ファイルを作成:</p>
                  <code className="block bg-gray-100 p-1 text-[10px] border border-gray-300">
                    VITE_SUPABASE_URL=...<br/>
                    VITE_SUPABASE_ANON_KEY=...
                  </code>
                </div>

                <div className="mb-3 border border-gray-400 p-2 bg-white">
                  <p className="font-bold text-purple-800 mb-1">手順 2B: インターネット公開 (GitHub)</p>
                  <p className="text-xs mb-1">
                    GitHubの <b>Settings &gt; Secrets and variables &gt; Actions</b> に以下のSecretを追加:
                  </p>
                  <ul className="list-disc pl-5 text-xs font-mono">
                    <li>VITE_SUPABASE_URL</li>
                    <li>VITE_SUPABASE_ANON_KEY</li>
                  </ul>
                </div>
                
                <div className="text-center mt-2">
                  <button onClick={() => setShowHelp(false)} className="border-2 border-black border-t-white border-l-white bg-[#D4D0C8] px-6 py-1 active:border-t-black active:border-l-black font-bold">
                    OK
                  </button>
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