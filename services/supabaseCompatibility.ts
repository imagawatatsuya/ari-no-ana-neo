import type { AuthorIndentMode } from '../types';

export type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

/**
 * PostgREST returns PGRST204 when its schema cache does not know a column.
 * Keep the check narrow so constraint, RLS, and network errors are not retried.
 */
export const isMissingAuthorIndentColumnError = (
  error: SupabaseErrorLike | null | undefined,
): boolean => {
  if (!error) return false;

  const message = String(error.message ?? '').toLowerCase();
  if (!message.includes('author_indent_mode')) return false;

  return error.code === 'PGRST204'
    || message.includes('schema cache')
    || message.includes('column');
};

type NovelInsertClient = {
  insert: (rows: Record<string, unknown>[]) => PromiseLike<{ error: SupabaseErrorLike | null }>;
};

export const insertNovelWithAuthorIndentFallback = async (
  client: NovelInsertClient,
  payload: Record<string, unknown>,
  authorIndentMode: AuthorIndentMode,
): Promise<{ error: SupabaseErrorLike | null; notice?: string }> => {
  let { error } = await client.insert([payload]);

  if (error && isMissingAuthorIndentColumnError(error)) {
    const legacyPayload = Object.fromEntries(
      Object.entries(payload).filter(([key]) => key !== 'author_indent_mode'),
    );
    const legacyResult = await client.insert([legacyPayload]);
    error = legacyResult.error;
    if (!error && authorIndentMode === 'jisage') {
      return {
        error: null,
        notice: '投稿は完了しましたが、サーバーが字下げ設定に未対応です。管理者がSupabaseのマイグレーションを適用すると、次回から設定が保存されます。',
      };
    }
  }

  return { error };
};
