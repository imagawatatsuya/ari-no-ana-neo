// History API ルーティング ユーティリティ

import type { ViewMode } from './types';

const ROUTE_SEGMENTS = new Set(['read', 'post', 'admin', 'page', 'ryuseigai']);

export type ParsedRoute = {
  view: ViewMode;
  activeNovelId: string | null;
  page: number | null;
};

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

/** 旧hash URLをHistory API URLへ変換するパスを返す */
export function getLegacyHashPath(hash: string, basePath: string): string | null {
  if (!hash || hash === '#' || hash === '#main-content') return null;
  return basePath + '/' + hash.slice(1);
}

/** ベースパスを除いたpathnameをアプリのルート状態へ変換する */
export function parseRoute(pathname: string, basePath: string): ParsedRoute {
  let path = pathname;
  if (basePath && path.startsWith(basePath)) {
    path = path.slice(basePath.length) || '/';
  }

  if (path.startsWith('/ryuseigai/read/')) {
    return {
      view: 'ryuseigai-read',
      activeNovelId: path.replace('/ryuseigai/read/', ''),
      page: null,
    };
  }
  if (path === '/ryuseigai') {
    return { view: 'ryuseigai', activeNovelId: null, page: null };
  }
  if (path.startsWith('/read/')) {
    return {
      view: 'read',
      activeNovelId: path.replace('/read/', ''),
      page: null,
    };
  }
  if (path === '/post') {
    return { view: 'post', activeNovelId: null, page: null };
  }
  if (path === '/admin') {
    return { view: 'admin', activeNovelId: null, page: null };
  }
  if (path.startsWith('/page/')) {
    const pageNum = parseInt(path.replace('/page/', ''), 10);
    return {
      view: 'list',
      activeNovelId: null,
      page: isNaN(pageNum) ? 1 : Math.max(1, pageNum),
    };
  }
  return { view: 'list', activeNovelId: null, page: 1 };
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
