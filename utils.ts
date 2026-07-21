
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
 * 400字詰め原稿用紙換算枚数を計算する
 * ルール:
 * - 原稿用紙1枚 = 20字 × 20行 = 400字
 * - 改行時、その行の残りマスも消費としてカウントする
 * - 各行の消費マス = ceil(その行の文字数 / 20) × 20
 * - 空行は1行（20マス）としてカウント
 * - 枚数 = ceil(総消費マス / 400)
 */
export const countManuscriptPages = (text: string): number => {
  if (!text || text.trim().length === 0) return 0;

  const CHARS_PER_LINE = 20;
  const LINES_PER_PAGE = 20;
  const CHARS_PER_PAGE = CHARS_PER_LINE * LINES_PER_PAGE; // 400

  const lines = text.split('\n');
  let totalCells = 0;

  for (const line of lines) {
    if (line.length === 0) {
      // 空行も1行としてカウント
      totalCells += CHARS_PER_LINE;
    } else {
      // 改行で残ったマスも消費としてカウント（20字単位に切り上げ）
      totalCells += Math.ceil(line.length / CHARS_PER_LINE) * CHARS_PER_LINE;
    }
  }

  return Math.ceil(totalCells / CHARS_PER_PAGE);
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
