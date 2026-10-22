export function contentSecurityPolicy(supabaseUrl = '', development = false, testHttp = false) {
  const connections = ["'self'"];
  if (supabaseUrl) {
    const url = new URL(supabaseUrl);
    if (!['https:', ...(development || testHttp ? ['http:'] : [])].includes(url.protocol) || url.username || url.password) {
      throw new Error('Unsafe Supabase URL in security policy');
    }
    connections.push(url.origin, url.origin.replace(/^http/, 'ws'));
  }
  if (development) connections.push('ws://localhost:*', 'ws://127.0.0.1:*');
  return [
    "default-src 'none'", `script-src 'self'${development ? " 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
    `connect-src ${connections.join(' ')}`, "base-uri 'none'", "object-src 'none'",
    "form-action 'none'", "frame-src 'none'", "worker-src 'none'", "manifest-src 'self'",
  ].join('; ');
}
