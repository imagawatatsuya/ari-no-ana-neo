
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

const JST_TIMEZONE = 'Asia/Tokyo';
const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * `formatDate` との差分:
 * - `formatDate` は「分まで」の既存表示(例: 2005/05/24(火) 12:34)を維持するための汎用フォーマット。
 * - この関数は JST 固定・秒付き・`日本時刻` サフィックス付きの表示専用。
 */
export const formatDateWithWeekdayAndSecondsJST = (isoDate: string): string => {
  const date = new Date(isoDate);
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: JST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const hours = part('hour');
  const minutes = part('minute');
  const seconds = part('second');
  const weekdayNumber = new Intl.DateTimeFormat('en-US', {
    timeZone: JST_TIMEZONE,
    weekday: 'short',
  }).formatToParts(date).find((p) => p.type === 'weekday')?.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = WEEKDAYS_JA[weekdayMap[weekdayNumber || 'Sun']];

  return `${year}/${month}/${day}(${weekday}) ${hours}:${minutes}:${seconds} 日本時刻`;
};

/**
 * 現在時刻(Date)を JST(+09:00) の ISO 文字列へ変換する。
 * 戻り値は `YYYY-MM-DDTHH:mm:ss+09:00` で固定。
 */
export const toJSTISOString = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: JST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}+09:00`;
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
