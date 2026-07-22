
// Simulating Perl's localtime formatting
export const formatDate = (isoDate: string): string => {
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekDay = weekDays[d.getDay()];

  // 2005/05/24(火) 12:34 format
  return `${year}/${month}/${day}(${weekDay}) ${hours}:${minutes}`;
};

// Mock tripcode generation
// In Perl this was usually crypt(pass, salt)
export const generateTrip = (nameInput: string): { name: string; trip?: string } => {
  const parts = nameInput.split('#');
  const name = parts[0] || '名無し';
  let trip: string | undefined = undefined;

  if (parts.length > 1 && parts[1]) {
    const pass = parts[1];
    // Simple mock hash for visual consistency
    let hash = 0;
    for (let i = 0; i < pass.length; i++) {
      hash = (hash << 5) - hash + pass.charCodeAt(i);
      hash |= 0;
    }
    const tripSuffix = Math.abs(hash).toString(16).substring(0, 8).toUpperCase();
    trip = `◆${tripSuffix}`;
  }

  return { name, trip };
};

export const calculateScore = (comments: any[]) => {
  if (comments.length === 0) return { total: 0, count: 0, avg: 0 };
  const total = comments.reduce((acc, c) => acc + c.vote, 0);
  const avg = total / comments.length;
  return { total, count: comments.length, avg };
};

/**
 * 半角文字かどうかを判定する
 * - ASCII (0x00-0x7F): 半角
 * - 半角カタカナ (0xFF61-0xFF9F): 半角
 * - 上記以外（全角英数字・日本語・記号等）: 全角
 */
export const isHalfWidth = (ch: string): boolean => {
  const code = ch.charCodeAt(0);
  return (code <= 0x7F) || (code >= 0xFF61 && code <= 0xFF9F);
};

/**
 * 文字列の全角換算マス数を計算する（全角=1、半角=0.5）
 */
export const countFullWidthCells = (text: string): number => {
  let cells = 0;
  for (const ch of text) {
    cells += isHalfWidth(ch) ? 0.5 : 1;
  }
  return cells;
};

/**
 * 本文の文字数をカウントする（小説家になろう/カクヨム準拠）
 * - 改行・空白（半角スペース・全角スペース・タブ）を除外
 * - 全角・半角問わず1文字=1
 */
export const countBodyCharacters = (text: string): number => {
  if (!text) return 0;
  // 改行(\n, \r)、半角スペース、全角スペース、タブを除去
  const stripped = text.replace(/[\n\r \u3000\t]/g, '');
  return stripped.length;
};

/**
 * 400字詰め原稿用紙換算枚数を計算する
 * ルール:
 * - 原稿用紙1枚 = 20マス × 20行 = 400マス
 * - 全角文字 = 1マス、半角文字 = 0.5マス
 * - 改行時、その行の残りマスも消費としてカウントする
 * - 各行の消費マス = ceil(その行の全角換算マス数 / 20) × 20
 * - 空行は1行（20マス）としてカウント
 * - 枚数 = ceil(総消費マス / 400)
 */
export const countManuscriptPages = (text: string): number => {
  if (!text || text.trim().length === 0) return 0;

  const CELLS_PER_LINE = 20;
  const LINES_PER_PAGE = 20;
  const CELLS_PER_PAGE = CELLS_PER_LINE * LINES_PER_PAGE; // 400

  const lines = text.split('\n');
  let totalCells = 0;

  for (const line of lines) {
    if (line.length === 0) {
      // 空行も1行としてカウント
      totalCells += CELLS_PER_LINE;
    } else {
      // 全角換算マス数を計算し、20マス単位に切り上げ
      const lineCells = countFullWidthCells(line);
      totalCells += Math.ceil(lineCells / CELLS_PER_LINE) * CELLS_PER_LINE;
    }
  }

  return Math.ceil(totalCells / CELLS_PER_PAGE);
};

/**
 * 原稿用紙換算枚数の表示文字列を生成する
 * - 本文が空 → 空文字（非表示）
 * - 1枚未満（400マス未満） → 「1枚未満」
 * - 1枚以上 → 「【N 枚】」
 */
export const formatManuscriptPages = (text: string): string => {
  if (!text || text.trim().length === 0) return '';

  const CELLS_PER_LINE = 20;
  const CELLS_PER_PAGE = 400;

  const lines = text.split('\n');
  let totalCells = 0;
  for (const line of lines) {
    if (line.length === 0) {
      totalCells += CELLS_PER_LINE;
    } else {
      const lineCells = countFullWidthCells(line);
      totalCells += Math.ceil(lineCells / CELLS_PER_LINE) * CELLS_PER_LINE;
    }
  }

  if (totalCells < CELLS_PER_PAGE) return '1枚未満';
  return `【${Math.ceil(totalCells / CELLS_PER_PAGE)} 枚】`;
};

// 5段階の星レーティング文字列を生成 (オリジナルの★★★★☆形式)
export const formatStarRating = (comments: any[]): { stars: string; score: string } => {
  const { total, count, avg } = calculateScore(comments);
  if (count === 0) return { stars: '☆☆☆☆☆', score: '(0/0)' };
  // avg is -2 to +2, map to 0-5 stars
  const normalized = Math.round(((avg + 2) / 4) * 5);
  const filled = Math.max(0, Math.min(5, normalized));
  const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);
  const score = `(${total}/${count})`;
  return { stars, score };
};
