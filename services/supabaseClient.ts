import { createClient } from '@supabase/supabase-js';

// 環境変数からSupabaseの接続情報を取得
// vite.config.tsでprocess.envを定義しているため、ここからアクセス可能
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// キーが設定されている場合のみクライアントを作成
// 設定されていない場合はnullとなり、App.tsx側でローカルストレージモードにフォールバックする
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;