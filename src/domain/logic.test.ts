import { describe, expect, it } from 'vitest';
import { APP } from './config';
import { addDays, diffDays, formatShort, isValidYmd, leftLabel, resolveMonthDay } from './dates';
import { builtinPresets } from './foods';
import {
  addCustomPreset, addShop, addToTray, boughtToTray, commitTray, counts, daysLeft, emptyData, finish, itemsCsv,
  lastBatch, logCsv, makeShareFile, mergeShare, monthStats, normalize, planNotices, rankedPresets, removeItem,
  sortByExpiry, toggleShop, topWasted, undoLog, urgency, makeBackup, restoreBackup, type Draft,
} from './logic';
import type { AppData } from './types';

const T = '2026-10-03';
const NOW = new Date(2026, 9, 3, 9, 0);
const preset = (d: AppData, name: string) => d.presets.find((p) => p.name === name)!;

function withItems(names: string[], premium = true, t = T, now = NOW) {
  let d = emptyData();
  let tray: Draft[] = [];
  for (const n of names) tray = addToTray(tray, preset(d, n), t);
  d = commitTray(d, tray, premium, now).data;
  return d;
}

describe('日付', () => {
  it('足し算と差', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(diffDays('2026-10-03', '2026-10-10')).toBe(7);
    expect(diffDays('2026-03-01', '2026-02-28')).toBe(-1);
    expect(isValidYmd('2026-02-30')).toBe(false);
    expect(isValidYmd('2026-02-28')).toBe(true);
  });
  it('月と日だけで、今日以降のいちばん近い日になる', () => {
    expect(resolveMonthDay(10, 5, T)).toBe('2026-10-05');
    expect(resolveMonthDay(1, 15, T)).toBe('2027-01-15'); // 年をまたぐ
    expect(resolveMonthDay(9, 30, T)).toBe('2026-09-30'); // 少し前=切れた物の登録
    expect(resolveMonthDay(2, 31, '2026-11-01')).toBe('2027-02-28'); // 無い日は月末にそろえる
  });
  it('表示', () => {
    expect(formatShort('2026-10-03')).toBe('10/3(土)');
    expect(leftLabel(-2)).toBe('2日すぎ');
    expect(leftLabel(0)).toBe('今日まで');
    expect(leftLabel(1)).toBe('明日まで');
    expect(leftLabel(5)).toBe('あと5日');
  });
});

describe('目安の食材', () => {
  it('名前の重複が無く、日数は1日以上', () => {
    const ps = builtinPresets();
    expect(new Set(ps.map((p) => p.name)).size).toBe(ps.length);
    expect(ps.every((p) => p.days >= 1 && p.price >= 0)).toBe(true);
  });
  it('最初の並びは牛乳・卵が先頭', () => {
    const r = rankedPresets(emptyData().presets);
    expect(r.slice(0, 2).map((p) => p.name)).toEqual(['牛乳', '卵']);
  });
  it('登録した回数の多い食材が前に来る', () => {
    let d = emptyData();
    for (let i = 0; i < 2; i++) d = commitTray(d, addToTray([], preset(d, 'もやし'), T), true, NOW).data;
    expect(rankedPresets(d.presets)[0].name).toBe('もやし');
  });
});

describe('登録', () => {
  it('ワンタップ: 目安日数で期限が入る', () => {
    const d = withItems(['牛乳']);
    expect(d.items).toHaveLength(1);
    expect(d.items[0].expiry).toBe(addDays(T, 7));
    expect(d.items[0].kind).toBe('shomi');
  });
  it('同じ食材を2回押すと個数が2になる(1行のまま)', () => {
    let tray = addToTray([], preset(emptyData(), '卵'), T);
    tray = addToTray(tray, preset(emptyData(), '卵'), T);
    expect(tray).toHaveLength(1);
    expect(tray[0].qty).toBe(2);
  });
  it('まとめ登録は同じ batch になる', () => {
    const d = withItems(['牛乳', '卵', '豆腐']);
    expect(new Set(d.items.map((i) => i.batch)).size).toBe(1);
  });
  it('無料は上限まで。超えた分は入れずに数を返す', () => {
    let d = emptyData();
    const tray: Draft[] = [];
    const ps = d.presets.slice(0, APP.freeItemLimit + 3);
    for (const p of ps) tray.push({ ...addToTray([], p, T)[0] });
    const r = commitTray(d, tray, false, NOW);
    expect(r.data.items).toHaveLength(APP.freeItemLimit);
    expect(r.rejected).toBe(3);
    d = r.data;
    const r2 = commitTray(d, addToTray([], preset(d, '牛乳'), T), false, NOW);
    expect(r2.rejected).toBe(1);
    const r3 = commitTray(d, addToTray([], preset(d, '牛乳'), T), true, NOW);
    expect(r3.rejected).toBe(0);
  });
  it('前回と同じ: 前回の日数のまま今日から数え直す', () => {
    let d = emptyData();
    const tray = addToTray(addToTray([], preset(d, '牛乳'), '2026-09-20'), preset(d, '卵'), '2026-09-20');
    tray[0] = { ...tray[0], expiry: '2026-09-30' }; // 手で10日にした
    d = commitTray(d, tray, true, new Date(2026, 8, 20, 9)).data;
    d = commitTray(d, addToTray([], preset(d, '納豆'), '2026-09-25'), true, new Date(2026, 8, 25, 9)).data;
    // いちばん新しいのは納豆だけの登録
    expect(lastBatch(d, T).map((x) => x.name)).toEqual(['納豆']);
    // 納豆を使い切っても「前回と同じ」で出てくる
    d = finish(d, d.items.find((i) => i.name === '納豆')!.id, 'used', T);
    const lb = lastBatch(d, T);
    expect(lb.map((x) => x.name)).toEqual(['納豆']);
    expect(lb[0].expiry).toBe(addDays(T, 7));
  });
  it('前回と同じ: 手で直した日数を引き継ぐ', () => {
    let d = emptyData();
    const tray = addToTray(addToTray([], preset(d, '牛乳'), '2026-09-20'), preset(d, '卵'), '2026-09-20');
    tray[0] = { ...tray[0], expiry: '2026-09-30' };
    d = commitTray(d, tray, true, new Date(2026, 8, 20, 9)).data;
    const lb = lastBatch(d, T);
    expect(lb.find((x) => x.name === '牛乳')!.expiry).toBe(addDays(T, 10));
    expect(lb.find((x) => x.name === '卵')!.expiry).toBe(addDays(T, 14));
  });
  it('手で作った食材は「よく買う」に入り、同じ名前は上書き', () => {
    let d = emptyData();
    const r = addCustomPreset(d, { name: ' 手作りプリン ', cat: 'deli', place: 'fridge', days: 2, kind: 'shohi', price: 0 });
    d = r.data;
    expect(r.preset.name).toBe('手作りプリン');
    const r2 = addCustomPreset(d, { name: '手作りプリン', cat: 'deli', place: 'fridge', days: 3, kind: 'shohi', price: 0 });
    expect(r2.data.presets.filter((p) => p.name === '手作りプリン')).toHaveLength(1);
    expect(r2.preset.days).toBe(3);
  });
});

describe('一覧と状態', () => {
  it('期限が近い順。同じ日は消費期限が先', () => {
    const d = withItems(['卵', '牛乳', 'ひき肉', '刺身']);
    const s = sortByExpiry(d.items).map((i) => i.name);
    expect(s[0] === '刺身' || s[0] === 'ひき肉').toBe(true);
    expect(s.slice(-2)).toEqual(['牛乳', '卵']);
  });
  it('残り日数の区分', () => {
    expect(urgency(-1)).toBe('expired');
    expect(urgency(0)).toBe('today');
    expect(urgency(2)).toBe('soon');
    expect(urgency(5)).toBe('week');
    expect(urgency(8)).toBe('ok');
    const d = withItems(['もやし', 'ひき肉', '卵']);
    const c = counts(d.items, addDays(T, 1));
    expect(c).toEqual({ expired: 0, today: 1, soon: 1, total: 3 });
    expect(daysLeft(d.items.find((i) => i.name === '卵')!, T)).toBe(14);
  });
});

describe('使い切った・捨てた', () => {
  it('捨てた額が記録され、品は消える', () => {
    let d = withItems(['牛乳']);
    const id = d.items[0].id;
    d = finish(d, id, 'wasted', '2026-10-12');
    expect(d.items).toHaveLength(0);
    expect(d.log[0]).toMatchObject({ outcome: 'wasted', price: 230, daysLeft: -2 });
    expect(d.deleted).toContain(id);
  });
  it('一部だけ使い切ると残りは冷蔵庫に残る', () => {
    let d = emptyData();
    let tray = addToTray([], preset(d, '卵'), T);
    tray = addToTray(tray, preset(d, '卵'), T);
    tray = addToTray(tray, preset(d, '卵'), T);
    d = commitTray(d, tray, true, NOW).data;
    d = finish(d, d.items[0].id, 'used', T, 1);
    expect(d.items[0].qty).toBe(2);
    expect(d.log[0].qty).toBe(1);
  });
  it('取り消すと冷蔵庫に戻る', () => {
    let d = withItems(['牛乳']);
    const it0 = d.items[0];
    d = finish(d, it0.id, 'wasted', T);
    d = undoLog(d, d.log[0].id, it0);
    expect(d.items.map((i) => i.name)).toEqual(['牛乳']);
    expect(d.log).toHaveLength(0);
    expect(d.deleted).not.toContain(it0.id);
  });
  it('月の集計ともったいない額', () => {
    let d = withItems(['牛乳', '卵', '豆腐']);
    const [a, b, c] = d.items;
    d = finish(d, a.id, 'used', '2026-10-05');
    d = finish(d, b.id, 'wasted', '2026-10-20');
    d = finish(d, c.id, 'wasted', '2026-11-01');
    const m = monthStats(d.log, '2026-10');
    expect(m).toMatchObject({ used: 1, wasted: 1, usedYen: 230, wastedYen: 280 });
    expect(m.rate).toBeCloseTo(0.5);
    expect(topWasted(d.log)[0].name).toBe('卵');
  });
  it('消すと記録には残らない', () => {
    let d = withItems(['牛乳']);
    d = removeItem(d, d.items[0].id);
    expect(d.items).toHaveLength(0);
    expect(d.log).toHaveLength(0);
  });
});

describe('買い物メモ', () => {
  it('同じ名前は重ねない。買えた物はそのまま登録の下書きになる', () => {
    let d = emptyData();
    d = addShop(d, '牛乳', preset(d, '牛乳').id);
    d = addShop(d, '牛乳');
    d = addShop(d, 'トイレットペーパー');
    expect(d.shop).toHaveLength(2);
    d = toggleShop(d, d.shop[0].id);
    d = toggleShop(d, d.shop[1].id);
    const r = boughtToTray(d, T);
    expect(r.data.shop).toHaveLength(0);
    expect(r.tray.map((x) => x.name)).toEqual(['牛乳', 'トイレットペーパー']);
    expect(r.tray[0].expiry).toBe(addDays(T, 7));
    expect(r.tray[1].cat).toBe('other');
  });
});

describe('通知', () => {
  it('前日の朝8時に、その翌日が期限の品をまとめて1通', () => {
    const d = withItems(['もやし', 'ひき肉']); // もやし 10/5, ひき肉 10/4
    const n = planNotices(d.items, { notify: true, notifyTime: '08:00', notifyDaysBefore: [1] }, NOW);
    expect(n).toHaveLength(1); // 10/3 08:00 は過ぎているので ひき肉の分は無い
    expect(n[0].at).toEqual(new Date(2026, 9, 4, 8, 0));
    expect(n[0].body).toBe('もやしが明日まで');
  });
  it('当日と前日を両方選ぶと同じ朝に1通へまとめる', () => {
    const d = withItems(['もやし', 'ひき肉']);
    const n = planNotices(d.items, { notify: true, notifyTime: '08:00', notifyDaysBefore: [0, 1] }, NOW);
    const oct4 = n.find((x) => x.at.getDate() === 4)!;
    expect(oct4.body).toBe('ひき肉が今日まで。もやしが明日まで');
    expect(oct4.title).toBe('今日が期限の食材 2品');
  });
  it('切ったら何も予約しない。4品以上は「ほか」でまとめる', () => {
    const d = withItems(['牛乳', 'ハム', 'ベーコン', '納豆']);
    expect(planNotices(d.items, { notify: false, notifyTime: '08:00', notifyDaysBefore: [1] }, NOW)).toEqual([]);
    const n = planNotices(d.items, { notify: true, notifyTime: '19:30', notifyDaysBefore: [1] }, NOW);
    expect(n[0].body).toMatch(/ほか1品が明日まで$/);
    expect(n[0].at.getHours()).toBe(19);
  });
});

describe('家族との共有ファイル', () => {
  it('相手の新しい品を足し、新しい方を残し、消した品は消す', () => {
    const mine = withItems(['牛乳', '卵']);
    // 相手は同じ品を受け取ったあと、牛乳の期限を直し、卵を使い切り、豆腐を足した
    let theirs: AppData = JSON.parse(JSON.stringify(mine));
    const milk = theirs.items.find((i) => i.name === '牛乳')!;
    theirs = { ...theirs, items: theirs.items.map((i) => (i.id === milk.id ? { ...i, expiry: '2026-10-20', updatedAt: '2026-10-04T00:00:00.000Z' } : i)) };
    theirs = finish(theirs, theirs.items.find((i) => i.name === '卵')!.id, 'used', T);
    theirs = commitTray(theirs, addToTray([], preset(theirs, '豆腐'), T), true, NOW).data;
    const file = JSON.parse(JSON.stringify(makeShareFile(theirs)));
    const r = mergeShare(mine, file);
    expect(r.data.items.map((i) => i.name).sort()).toEqual(['牛乳', '豆腐'].sort());
    expect(r.data.items.find((i) => i.name === '牛乳')!.expiry).toBe('2026-10-20');
    expect(r).toMatchObject({ added: 1, updated: 1, removed: 1 });
    // 同じファイルをもう一度読んでも増えない
    const r2 = mergeShare(r.data, file);
    expect(r2.data.items).toHaveLength(2);
    expect(r2.added).toBe(0);
  });
  it('違うファイルは断る', () => {
    expect(() => mergeShare(emptyData(), { hello: 1 })).toThrow('タベドキの共有ファイルではありません');
  });
});

describe('保存と書き出し', () => {
  it('壊れた値を捨てて読み直せる', () => {
    const d = normalize({ items: [{ id: 'x', name: '牛乳', expiry: '2026-13-01' }, { id: 'y', name: '卵', expiry: '2026-10-10', qty: '3', cat: 'nai' }], settings: { notifyTime: '07:00' } });
    expect(d.items).toHaveLength(1);
    expect(d.items[0]).toMatchObject({ qty: 3, cat: 'other', place: 'fridge' });
    expect(d.settings.notifyTime).toBe('07:00');
    expect(d.settings.notify).toBe(true);
    expect(d.presets.length).toBe(builtinPresets().length);
    expect(normalize(null).items).toEqual([]);
    expect(normalize('壊れた').items).toEqual([]);
  });
  it('JSON に通しても同じ', () => {
    const d = withItems(['牛乳', '卵']);
    expect(normalize(JSON.parse(JSON.stringify(d)))).toEqual(normalize(d));
  });
  it('CSV は Excel で文字化けしない(BOM)・カンマを含む名前を囲む', () => {
    let d = withItems(['牛乳']);
    d = { ...d, items: [...d.items, { ...d.items[0], id: 'z', name: 'チーズ,スライス' }] };
    const csv = itemsCsv(d, T);
    expect(csv.startsWith('﻿名前,分類')).toBe(true);
    expect(csv).toContain('"チーズ,スライス"');
    expect(csv).toContain('牛乳,卵・乳製品,冷蔵,2026-10-10,賞味期限,7,1,230');
    d = finish(d, 'z', 'wasted', T);
    expect(logCsv(d)).toContain('2026-10-03,"チーズ,スライス",捨てた,1,230,7');
  });
});

describe('バックアップ', () => {
  it('書き出して戻すと同じ', () => {
    let d = withItems(['牛乳', '卵']);
    d = finish(d, d.items[0].id, 'wasted', T);
    const back = restoreBackup(JSON.parse(JSON.stringify(makeBackup(d))));
    expect(back).toEqual(normalize(d));
    expect(() => restoreBackup(makeShareFile(d))).toThrow('タベドキのバックアップではありません');
  });
});
