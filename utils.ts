
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
