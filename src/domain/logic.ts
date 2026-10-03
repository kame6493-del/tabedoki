import { APP } from './config';
import { addDays, diffDays, isValidYmd, today as todayOf } from './dates';
import { BUILTIN_CATS, BUILTIN_PLACES, builtinPresets } from './foods';
import type { AppData, Item, KigenKind, LogEntry, Outcome, Preset, Settings, ShopEntry, Ymd } from './types';

let seq = 0;
export function newId(prefix = 'i'): string {
  seq = (seq + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${seq.toString(36)}`;
}

export const DEFAULT_SETTINGS: Settings = {
  notify: true,
  notifyTime: APP.freeNotifyTime,
  notifyDaysBefore: [...APP.freeNotifyDays],
  theme: 'kitchen',
  fontScale: 1,
  defaultPlace: 'fridge',
  deviceName: '',
};

export function emptyData(): AppData {
  return {
    version: 1,
    items: [],
    presets: builtinPresets(),
    cats: BUILTIN_CATS.map((c) => ({ ...c })),
    places: BUILTIN_PLACES.map((p) => ({ ...p })),
    log: [],
    shop: [],
    settings: { ...DEFAULT_SETTINGS },
    deleted: [],
  };
}

/** 読み込んだ物を今の形にそろえる(壊れた値は捨てる。足りない組み込みは足す) */
export function normalize(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppData>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const cats = arr<AppData['cats'][number]>(r.cats).filter((c) => c && c.id && c.name);
  for (const c of base.cats) if (!cats.some((x) => x.id === c.id)) cats.push(c);
  const places = arr<AppData['places'][number]>(r.places).filter((p) => p && p.id && p.name);
  for (const p of base.places) if (!places.some((x) => x.id === p.id)) places.push(p);
  const presets = arr<Preset>(r.presets).filter((p) => p && p.id && p.name && Number.isFinite(p.days));
  for (const p of base.presets) if (!presets.some((x) => x.id === p.id)) presets.push(p);
  const items = arr<Item>(r.items).filter((i) => i && i.id && i.name && isValidYmd(i.expiry)).map((i) => ({
    ...i, qty: Math.max(1, Math.round(Number(i.qty) || 1)), price: Math.max(0, Number(i.price) || 0),
    cat: cats.some((c) => c.id === i.cat) ? i.cat : 'other',
    place: places.some((p) => p.id === i.place) ? i.place : 'fridge',
    batch: i.batch || i.id, updatedAt: i.updatedAt || i.addedAt || new Date(0).toISOString(),
  }));
  return {
    version: 1,
    items,
    presets,
    cats,
    places,
    log: arr<LogEntry>(r.log).filter((l) => l && l.id && (l.outcome === 'used' || l.outcome === 'wasted')),
    shop: arr<ShopEntry>(r.shop).filter((s) => s && s.id && s.name),
    settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) },
    deleted: arr<string>(r.deleted).filter((s) => typeof s === 'string').slice(-2000),
    lastBatchArchive: arr<Item>(r.lastBatchArchive).filter((i) => i && i.id && i.batch && isValidYmd(i.expiry)),
  };
}

// ---------- 状態 ----------

export type Urgency = 'expired' | 'today' | 'soon' | 'week' | 'ok';

export function daysLeft(item: Pick<Item, 'expiry'>, t: Ymd): number {
  return diffDays(t, item.expiry);
}

export function urgency(left: number): Urgency {
  if (left < 0) return 'expired';
  if (left === 0) return 'today';
  if (left <= 2) return 'soon';
  if (left <= 7) return 'week';
  return 'ok';
}

/** 期限が近い順。同じ日なら消費期限を先、そのあと名前順 */
export function sortByExpiry(items: Item[]): Item[] {
  return [...items].sort((a, b) =>
    a.expiry < b.expiry ? -1 : a.expiry > b.expiry ? 1
      : a.kind !== b.kind ? (a.kind === 'shohi' ? -1 : 1)
        : a.name.localeCompare(b.name, 'ja'));
}

export function counts(items: Item[], t: Ymd) {
  let expired = 0, today = 0, soon = 0;
  for (const i of items) {
    const u = urgency(daysLeft(i, t));
    if (u === 'expired') expired++;
    else if (u === 'today') today++;
    else if (u === 'soon') soon++;
  }
  return { expired, today, soon, total: items.length };
}

// ---------- 登録 ----------

/** 並びの順: 回数が多い→最近使った */
export function rankedPresets(presets: Preset[]): Preset[] {
  return presets.filter((p) => !p.hidden).sort((a, b) =>
    b.uses - a.uses || (b.lastUsed ?? '').localeCompare(a.lastUsed ?? '') || a.name.localeCompare(b.name, 'ja'));
}

/** 登録の下書き(カゴの1行) */
export interface Draft {
  key: string;
  presetId?: string;
  name: string;
  cat: string;
  place: string;
  kind: KigenKind;
  expiry: Ymd;
  qty: number;
  price: number;
}

export function draftFromPreset(p: Preset, t: Ymd): Draft {
  return { key: newId('d'), presetId: p.id, name: p.name, cat: p.cat, place: p.place, kind: p.kind, expiry: addDays(t, p.days), qty: 1, price: p.price };
}

/** カゴに足す。同じ食材がもう入っていれば個数を1増やす */
export function addToTray(tray: Draft[], p: Preset, t: Ymd): Draft[] {
  const hit = tray.find((d) => d.presetId === p.id);
  if (hit) return tray.map((d) => (d === hit ? { ...d, qty: d.qty + 1 } : d));
  return [...tray, draftFromPreset(p, t)];
}

/** 空いている枠(無料の上限)。Infinity=上限なし */
export function room(data: AppData, premium: boolean): number {
  return premium ? Infinity : Math.max(0, APP.freeItemLimit - data.items.length);
}

/**
 * カゴの中身を冷蔵庫に入れる。入りきらない分は入れずに数を返す。
 * 使った食材の回数を数え、「前回と同じ」のために同じ batch を付ける。
 */
export function commitTray(data: AppData, tray: Draft[], premium: boolean, now = new Date()): { data: AppData; added: Item[]; rejected: number } {
  const iso = now.toISOString();
  const batch = newId('b');
  const free = room(data, premium);
  const ok = tray.slice(0, free === Infinity ? tray.length : free);
  const added: Item[] = ok.map((d) => ({
    id: newId('i'), name: d.name.trim() || '名前なし', cat: d.cat, place: d.place, expiry: d.expiry, kind: d.kind,
    qty: Math.max(1, d.qty), price: Math.max(0, d.price), presetId: d.presetId, addedAt: iso, batch, updatedAt: iso,
  }));
  const used = new Map<string, number>();
  for (const d of ok) if (d.presetId) used.set(d.presetId, (used.get(d.presetId) ?? 0) + 1);
  const presets = data.presets.map((p) => (used.has(p.id) ? { ...p, uses: Math.floor(p.uses) + used.get(p.id)!, lastUsed: iso } : p));
  return { data: { ...data, items: [...data.items, ...added], presets }, added, rejected: tray.length - ok.length };
}

/**
 * 「前回と同じ」: いちばん新しい登録操作で入れた品を、今日の日付で下書きに戻す。
 * 期限は「前回の期限 - 前回の登録日」の日数を今日に足す(前回 牛乳を7日で入れたなら今回も7日)。
 * 記録(使い切った・捨てた)に移った品も対象にするため、品と記録の両方から探す。
 */
export function lastBatch(data: AppData, t: Ymd): Draft[] {
  const all = [...data.items, ...(data.lastBatchArchive ?? [])];
  if (!all.length) return [];
  const latest = all.reduce((a, b) => (a.addedAt > b.addedAt ? a : b));
  return all.filter((i) => i.batch === latest.batch).map((i) => {
    const span = Math.max(0, diffDays(i.addedAt.slice(0, 10), i.expiry));
    return { key: newId('d'), presetId: i.presetId, name: i.name, cat: i.cat, place: i.place, kind: i.kind, expiry: addDays(t, span), qty: i.qty, price: i.price };
  });
}

/** 新しい食材を「よく買う」に足す(手で名前を打った品) */
export function addCustomPreset(data: AppData, p: Omit<Preset, 'id' | 'uses' | 'custom'>): { data: AppData; preset: Preset } {
  const same = data.presets.find((x) => x.name === p.name.trim());
  if (same) {
    const upd = { ...same, ...p, name: same.name, hidden: false };
    return { data: { ...data, presets: data.presets.map((x) => (x.id === same.id ? upd : x)) }, preset: upd };
  }
  const preset: Preset = { ...p, name: p.name.trim(), id: newId('p'), uses: 0, custom: true };
  return { data: { ...data, presets: [...data.presets, preset] }, preset };
}

// ---------- 使い切った・捨てた ----------

/**
 * 品を冷蔵庫から出して記録する。qty を指定すると一部だけ(残りは冷蔵庫に残る)。
 * 値段は1個あたり × 出した数。
 */
export function finish(data: AppData, itemId: string, outcome: Outcome, t: Ymd, qty?: number, now = new Date()): AppData {
  const it = data.items.find((i) => i.id === itemId);
  if (!it) return data;
  const n = Math.min(it.qty, Math.max(1, qty ?? it.qty));
  const entry: LogEntry = {
    id: newId('l'), itemId: it.id, name: it.name, cat: it.cat, price: Math.round(it.price * n), qty: n,
    outcome, date: t, daysLeft: daysLeft(it, t),
  };
  const iso = now.toISOString();
  const rest = it.qty - n;
  const items = rest > 0 ? data.items.map((i) => (i.id === it.id ? { ...i, qty: rest, updatedAt: iso } : i)) : data.items.filter((i) => i.id !== it.id);
  return {
    ...data,
    items,
    log: [...data.log, entry],
    deleted: rest > 0 ? data.deleted : [...data.deleted, it.id],
    lastBatchArchive: rest > 0 ? data.lastBatchArchive : keepArchive(data, it),
  };
}

function keepArchive(data: AppData, it: Item): Item[] {
  // 最後の登録の batch の品だけ控える(それ以外は要らない)
  const latest = [...data.items, ...(data.lastBatchArchive ?? [])].reduce((a, b) => (a.addedAt > b.addedAt ? a : b), it);
  return [...(data.lastBatchArchive ?? []), it].filter((x) => x.batch === latest.batch);
}

export function removeItem(data: AppData, itemId: string): AppData {
  const it = data.items.find((i) => i.id === itemId);
  if (!it) return data;
  return { ...data, items: data.items.filter((i) => i.id !== itemId), deleted: [...data.deleted, itemId] };
}

export function updateItem(data: AppData, itemId: string, patch: Partial<Item>, now = new Date()): AppData {
  return { ...data, items: data.items.map((i) => (i.id === itemId ? { ...i, ...patch, id: i.id, updatedAt: now.toISOString() } : i)) };
}

/** 記録の取り消し(押し間違い)。品は冷蔵庫に戻す */
export function undoLog(data: AppData, logId: string, archived: Item | undefined, now = new Date()): AppData {
  const l = data.log.find((x) => x.id === logId);
  if (!l) return data;
  const log = data.log.filter((x) => x.id !== logId);
  const inFridge = data.items.find((i) => i.id === l.itemId);
  const iso = now.toISOString();
  let items = data.items;
  if (inFridge) items = items.map((i) => (i.id === l.itemId ? { ...i, qty: i.qty + l.qty, updatedAt: iso } : i));
  else if (archived) items = [...items, { ...archived, qty: l.qty, updatedAt: iso }];
  return { ...data, log, items, deleted: data.deleted.filter((d) => d !== l.itemId) };
}

// ---------- 集計 ----------

export interface MonthStats { month: string; used: number; wasted: number; wastedYen: number; usedYen: number; rate: number }

/** 月ごとの使い切り・捨てた数ともったいない額。rate は使い切った割合(0〜1) */
export function monthStats(log: LogEntry[], month: string): MonthStats {
  let used = 0, wasted = 0, wastedYen = 0, usedYen = 0;
  for (const l of log) {
    if (!l.date.startsWith(month)) continue;
    if (l.outcome === 'used') { used += l.qty; usedYen += l.price; } else { wasted += l.qty; wastedYen += l.price; }
  }
  const all = used + wasted;
  return { month, used, wasted, wastedYen, usedYen, rate: all ? used / all : 0 };
}

/** よく捨てる食材(回数の多い順) */
export function topWasted(log: LogEntry[], limit = 5): { name: string; times: number; yen: number }[] {
  const m = new Map<string, { name: string; times: number; yen: number }>();
  for (const l of log) {
    if (l.outcome !== 'wasted') continue;
    const e = m.get(l.name) ?? { name: l.name, times: 0, yen: 0 };
    e.times += l.qty; e.yen += l.price;
    m.set(l.name, e);
  }
  return [...m.values()].sort((a, b) => b.times - a.times || b.yen - a.yen).slice(0, limit);
}

// ---------- 買い物メモ ----------

export function addShop(data: AppData, name: string, presetId?: string, now = new Date()): AppData {
  const n = name.trim();
  if (!n) return data;
  if (data.shop.some((s) => !s.done && s.name === n)) return data;
  const iso = now.toISOString();
  return { ...data, shop: [...data.shop, { id: newId('s'), name: n, presetId, done: false, addedAt: iso, updatedAt: iso }] };
}

export function toggleShop(data: AppData, id: string, now = new Date()): AppData {
  return { ...data, shop: data.shop.map((s) => (s.id === id ? { ...s, done: !s.done, updatedAt: now.toISOString() } : s)) };
}

/** 買えた印の付いた行を消し、その食材を登録の下書きにする(買ってきた物をそのまま冷蔵庫へ) */
export function boughtToTray(data: AppData, t: Ymd): { data: AppData; tray: Draft[] } {
  const done = data.shop.filter((s) => s.done);
  const tray: Draft[] = [];
  for (const s of done) {
    const p = data.presets.find((x) => x.id === s.presetId) ?? data.presets.find((x) => x.name === s.name);
    tray.push(p ? draftFromPreset(p, t) : { key: newId('d'), name: s.name, cat: 'other', place: data.settings.defaultPlace, kind: 'shomi', expiry: addDays(t, 7), qty: 1, price: 0 });
  }
  return { data: { ...data, shop: data.shop.filter((s) => !s.done), deleted: [...data.deleted, ...done.map((s) => s.id)] }, tray };
}

// ---------- 通知の予定 ----------

export interface PlannedNotice { id: number; at: Date; title: string; body: string }

/**
 * 期限の n 日前(notifyDaysBefore の各値)の指定時刻に、その日が期限の品をまとめて1通。
 * 同じ時刻に重なるお知らせは1通にまとめる。過去の時刻と、60日より先は入れない(OS の予約数の上限 64 に収める)。
 */
export function planNotices(items: Item[], s: Pick<Settings, 'notify' | 'notifyTime' | 'notifyDaysBefore'>, now = new Date()): PlannedNotice[] {
  if (!s.notify || !items.length || !s.notifyDaysBefore.length) return [];
  const [hh, mm] = s.notifyTime.split(':').map(Number);
  const t = todayOf(now);
  const byFire = new Map<string, { before: number; items: Item[] }[]>();
  for (const it of items) {
    for (const before of s.notifyDaysBefore) {
      const fireDay = addDays(it.expiry, -before);
      if (diffDays(t, fireDay) > 60) continue;
      const list = byFire.get(fireDay) ?? [];
      const g = list.find((x) => x.before === before) ?? (list.push({ before, items: [] }), list[list.length - 1]);
      g.items.push(it);
      byFire.set(fireDay, list);
    }
  }
  const out: PlannedNotice[] = [];
  for (const [day, groups] of [...byFire.entries()].sort()) {
    const [y, m, d] = day.split('-').map(Number);
    const at = new Date(y, m - 1, d, hh, mm);
    if (at.getTime() <= now.getTime()) continue;
    groups.sort((a, b) => a.before - b.before);
    const parts = groups.map((g) => {
      const names = sortByExpiry(g.items).map((i) => i.name);
      const head = names.slice(0, 3).join('・') + (names.length > 3 ? `ほか${names.length - 3}品` : '');
      const when = g.before === 0 ? '今日まで' : g.before === 1 ? '明日まで' : `${g.before}日後まで`;
      return `${head}が${when}`;
    });
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    out.push({ id: 5000 + out.length, at, title: groups[0].before === 0 ? `今日が期限の食材 ${total}品` : `そろそろ食べ時 ${total}品`, body: parts.join('。') });
    if (out.length >= 60) break;
  }
  return out;
}

// ---------- 家族との共有(ファイル) ----------

export interface ShareFile { app: 'tabedoki'; kind: 'share'; version: 1; exportedAt: string; from: string; items: Item[]; shop: ShopEntry[]; deleted: string[]; presets: Preset[] }

export function makeShareFile(data: AppData, now = new Date()): ShareFile {
  return { app: 'tabedoki', kind: 'share', version: 1, exportedAt: now.toISOString(), from: data.settings.deviceName, items: data.items, shop: data.shop, deleted: data.deleted, presets: data.presets.filter((p) => p.custom) };
}

/**
 * 共有ファイルを取り込む。同じ id は updatedAt の新しい方を残し、どちらかで消した品は消す。
 * 相手が作った食材(custom)は名前が無ければ足す。
 */
export function mergeShare(data: AppData, raw: unknown): { data: AppData; added: number; updated: number; removed: number } {
  const f = raw as Partial<ShareFile>;
  if (!f || f.app !== 'tabedoki' || f.kind !== 'share' || !Array.isArray(f.items)) throw new Error('タベドキの共有ファイルではありません');
  const incoming = normalize({ items: f.items, shop: f.shop ?? [], cats: data.cats, places: data.places });
  const deleted = new Set([...data.deleted, ...(f.deleted ?? [])]);
  const map = new Map(data.items.map((i) => [i.id, i]));
  let added = 0, updated = 0;
  for (const it of incoming.items) {
    if (deleted.has(it.id)) continue;
    const cur = map.get(it.id);
    if (!cur) { map.set(it.id, it); added++; } else if (it.updatedAt > cur.updatedAt) { map.set(it.id, it); updated++; }
  }
  let removed = 0;
  for (const id of [...map.keys()]) if (deleted.has(id)) { map.delete(id); removed++; }
  const shop = new Map(data.shop.map((s) => [s.id, s]));
  for (const s of incoming.shop) {
    if (deleted.has(s.id)) continue;
    const cur = shop.get(s.id);
    if (!cur || s.updatedAt > cur.updatedAt) shop.set(s.id, s);
  }
  for (const id of [...shop.keys()]) if (deleted.has(id)) shop.delete(id);
  let presets = data.presets;
  for (const p of Array.isArray(f.presets) ? f.presets : []) {
    if (p && p.name && !presets.some((x) => x.name === p.name)) presets = [...presets, { ...p, uses: 0, custom: true }];
  }
  return { data: { ...data, items: [...map.values()], shop: [...shop.values()], presets, deleted: [...deleted].slice(-2000) }, added, updated, removed };
}

// ---------- 書き出し(CSV) ----------

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function itemsCsv(data: AppData, t: Ymd): string {
  const cat = (id: string) => data.cats.find((c) => c.id === id)?.name ?? '';
  const place = (id: string) => data.places.find((p) => p.id === id)?.name ?? '';
  const rows = [['名前', '分類', '置き場所', '期限', '期限の種類', '残り日数', '個数', '値段'].join(',')];
  for (const i of sortByExpiry(data.items)) {
    rows.push([i.name, cat(i.cat), place(i.place), i.expiry, i.kind === 'shohi' ? '消費期限' : '賞味期限', daysLeft(i, t), i.qty, i.price].map(csvCell).join(','));
  }
  return '﻿' + rows.join('\r\n') + '\r\n';
}

export function logCsv(data: AppData): string {
  const rows = [['日付', '名前', '結果', '個数', '金額', '記録した日の残り日数'].join(',')];
  for (const l of [...data.log].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([l.date, l.name, l.outcome === 'used' ? '使い切った' : '捨てた', l.qty, l.price, l.daysLeft].map(csvCell).join(','));
  }
  return '﻿' + rows.join('\r\n') + '\r\n';
}

// ---------- バックアップ(機種変更・消えたときの控え) ----------

export function makeBackup(data: AppData, now = new Date()) {
  return { app: 'tabedoki', kind: 'backup', version: 1, exportedAt: now.toISOString(), data };
}

/** バックアップから戻す。中身は normalize を通す */
export function restoreBackup(raw: unknown): AppData {
  const f = raw as { app?: string; kind?: string; data?: unknown };
  if (!f || f.app !== 'tabedoki' || f.kind !== 'backup' || !f.data) throw new Error('タベドキのバックアップではありません');
  return normalize(f.data);
}
