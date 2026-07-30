// History API ルーティング ユーティリティ

const ROUTE_SEGMENTS = new Set(['read', 'post', 'admin', 'page', 'ryuseigai']);

/** Vite base / script src / pathname からベースパスを正規化 */
export function normalizeBasePath(raw: string): string {
  if (!raw || raw === '/' || raw === './') return '';
  const trimmed = raw.replace(/^\.?\//, '').replace(/\/$/, '');
  return trimmed ? `/${trimmed}` : '';
}

/** ベースパス検出（テスト可能） */
export function detectBasePath(
  viteBaseUrl: string,
  scriptSrcs: string[],
  pathname: string,
): string {
  const fromVite = normalizeBasePath(viteBaseUrl);
  if (fromVite) return fromVite;

  for (const src of scriptSrcs) {
    const idx = src.indexOf('assets/');
    if (idx <= 0) continue;
    const detected = normalizeBasePath(src.slice(0, idx));
    if (detected) return detected;
  }

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0 && !ROUTE_SEGMENTS.has(parts[0])) {
    return `/${parts[0]}`;
  }
  return '';
}

export const BASE_PATH =
  typeof document !== 'undefined'
    ? detectBasePath(
        import.meta.env?.BASE_URL ?? '',
        Array.from(document.querySelectorAll('script[src*="assets/"]')).map(
          (s) => s.getAttribute('src') || '',
        ),
        window.location.pathname,
      )
    : '';

/** ルート遷移（pushState + popstate イベント発火） */
export const navigate = (route: string) => {
  const url = BASE_PATH + (route === '/' ? '/' : route);
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
