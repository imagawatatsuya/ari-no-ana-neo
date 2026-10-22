import { pathToFileURL } from 'node:url';

/** Read-only deployment probe: uses the same public list RPC as the browser. */
export async function checkSupabaseAvailability({ url, anonKey, fetchImpl = fetch }) {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase URL and public API key must be configured.');
  let endpoint;
  try {
    const base = new URL(url);
    if (base.protocol !== 'https:' || base.username || base.password) throw new Error();
    endpoint = new URL('/rest/v1/rpc/list_public_novels', base.origin);
  } catch {
    throw new Error('Supabase URL must be a valid HTTPS project URL.');
  }

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_offset: 0, p_limit: 1, p_search: null, p_is_ryuseigai: false }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error('Supabase Data API is unreachable. Check project status, DNS and network connectivity.');
  }
  if (!response.ok) throw new Error(`Supabase list RPC failed (HTTP ${response.status}). Check project status, API key, migrations and RLS.`);
  let rows;
  try { rows = await response.json(); } catch { throw new Error('Supabase list RPC returned invalid JSON.'); }
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row.id !== 'string' || typeof row.title !== 'string')) {
    throw new Error('Supabase list RPC returned an unexpected response.');
  }
  return { sampleCount: rows.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await checkSupabaseAvailability({ url: process.env.VITE_SUPABASE_URL, anonKey: process.env.VITE_SUPABASE_ANON_KEY });
    console.log(`Supabase Data API OK (${result.sampleCount} sampled public works).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
