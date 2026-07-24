// History API ルーティング ユーティリティ

/** デプロイ先自動対応: script src からベースパスを検出 */
export const BASE_PATH = (() => {
  const scripts = document.querySelectorAll('script[src*="assets/"]');
  for (const s of scripts) {
    const src = s.getAttribute('src') || '';
    const idx = src.indexOf('assets/');
    if (idx > 0) {
      const base = src.slice(0, idx).replace(/^\.?\//, '');
      return base ? `/${base.replace(/\/$/, '')}` : '';
    }
  }
  return '';
})();

/** ルート遷移（pushState + popstate イベント発火） */
export const navigate = (route: string) => {
  const url = BASE_PATH + (route === '/' ? '/' : route);
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
