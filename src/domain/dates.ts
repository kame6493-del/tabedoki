import type { Ymd } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toYmd(d: Date): Ymd {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseYmd(s: Ymd): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(now: Date = new Date()): Ymd {
  return toYmd(now);
}

export function addDays(s: Ymd, n: number): Ymd {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return toYmd(d);
}

/** a から b まで何日か(b が後なら正)。夏時間のある地域でもずれないよう正午で比べる */
export function diffDays(a: Ymd, b: Ymd): number {
  const x = parseYmd(a); x.setHours(12);
  const y = parseYmd(b); y.setHours(12);
  return Math.round((y.getTime() - x.getTime()) / 86400000);
}

export function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toYmd(parseYmd(s)) === s;
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

/**
 * 月と日だけ押したときの日付。今日以降でいちばん近いその月日にする
 * (袋の「26.10.05」を見て 10月→5日 と押すだけで済むように。年はほぼ必ず今年か来年)。
 * 今日より前の月日は、3か月以内の過去なら今年(切れた物の登録)、それより前なら来年とみなす。
 */
export function resolveMonthDay(month1: number, day: number, base: Ymd): Ymd {
  const t = parseYmd(base);
  const y = t.getFullYear();
  const clampDay = (yy: number) => Math.min(day, daysInMonth(yy, month1));
  const thisYear = toYmd(new Date(y, month1 - 1, clampDay(y)));
  const back = diffDays(thisYear, base); // 正なら thisYear は過去
  if (back <= 0) return thisYear;
  if (back <= 92) return thisYear;
  return toYmd(new Date(y + 1, month1 - 1, clampDay(y + 1)));
}

/** 日付の早押しボタン */
export const QUICK_DAYS: { label: string; days: number }[] = [
  { label: '今日', days: 0 },
  { label: '明日', days: 1 },
  { label: '3日後', days: 3 },
  { label: '1週間', days: 7 },
  { label: '2週間', days: 14 },
  { label: '1か月', days: 30 },
];

const WD = ['日', '月', '火', '水', '木', '金', '土'];

export function formatShort(s: Ymd): string {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`;
}

/** 残り日数の言い方 */
export function leftLabel(left: number): string {
  if (left < 0) return `${-left}日すぎ`;
  if (left === 0) return '今日まで';
  if (left === 1) return '明日まで';
  return `あと${left}日`;
}
