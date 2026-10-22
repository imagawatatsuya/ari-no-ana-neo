import { pathToFileURL } from 'node:url';

export async function checkSecurity({ url, anonKey, fetchImpl = fetch }) {
  let endpoint;
  try {
    const base = new URL(url);
    if (base.protocol !== 'https:' || base.username || base.password || !anonKey?.trim()) throw new Error();
    endpoint = new URL('/rest/v1/rpc/security_health', base.origin);
  } catch { throw new Error('A valid HTTPS Supabase URL and public API key are required.'); }
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(15_000),
    });
  } catch { throw new Error('Security verification is unreachable; deployment stopped.'); }
  if (!response.ok) throw new Error(`Security verification failed (HTTP ${response.status}); apply required migrations and inspect DB permissions.`);
  let result;
  try { result = await response.json(); } catch { throw new Error('Invalid security verification response; deployment stopped.'); }
  if (result !== true) throw new Error('DB security baseline is missing or changed; deployment stopped.');
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await checkSecurity({ url: process.env.VITE_SUPABASE_URL, anonKey: process.env.VITE_SUPABASE_ANON_KEY });
    console.log('DB security baseline OK.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
