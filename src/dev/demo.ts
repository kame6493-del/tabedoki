// 画面写真と動作確認のための見本データ(開発ビルドと E2E 用ビルドだけ。製品ビルドには入らない)
import { addDays, today as todayOf } from '../domain/dates';
import { addShop, emptyData, newId, toggleShop } from '../domain/logic';
import type { AppData, Item, LogEntry } from '../domain/types';
import { saveData } from '../platform/storage';

export async function installDemo(params: URLSearchParams) {
  const t = todayOf();
  let d: AppData = emptyData();
  const P = (n: string) => d.presets.find((p) => p.name === n)!;
  const now = new Date().toISOString();
  const batch = newId('b');
  const fridge: [string, number, number?][] = [
    ['ひき肉', 0], ['もやし', 1], ['豆腐', 1], ['牛乳', 2, 1], ['ほうれん草', 2], ['ヨーグルト', 3, 4], ['鶏もも肉', 4],
    ['卵', 9, 1], ['納豆', 5, 3], ['キャベツ', 8], ['にんじん', 12], ['ウインナー', 6], ['チーズ', 18], ['冷凍うどん', 40, 3], ['玉ねぎ', 25, 3], ['ケチャップ', 28],
  ];
  if (params.get('demo') === 'expired') fridge.unshift(['刺身', -1]);
  const items: Item[] = fridge.map(([n, left, qty]) => {
    const p = P(n);
    return { id: newId('i'), name: n, cat: p.cat, place: p.place, expiry: addDays(t, left), kind: p.kind, qty: qty ?? 1, price: p.price, presetId: p.id, addedAt: now, batch, updatedAt: now };
  });
  // 5か月分の記録: 捨てる量が月ごとに減っていく
  const log: LogEntry[] = [];
  const wasteByMonth = [7, 6, 4, 3, 2];
  const pool = ['もやし', 'ほうれん草', '豆腐', '牛乳', '食パン', 'レタス', '鶏むね肉', 'ヨーグルト', 'きゅうり', 'お惣菜'];
  for (let m = 0; m < 5; m++) {
    for (let i = 0; i < 14; i++) {
      const wasted = i < wasteByMonth[m];
      const name = pool[(i * 3 + m) % pool.length];
      const date = addDays(t, -((4 - m) * 30) - (i % 6) - 1);
      log.push({ id: newId('l'), itemId: newId('i'), name, cat: P(name).cat, price: P(name).price, qty: 1, outcome: wasted ? 'wasted' : 'used', date, daysLeft: wasted ? -1 : 1 });
    }
  }
  const presets = d.presets.map((p) => {
    const i = ['牛乳', '卵', '納豆', 'もやし', '豆腐', '鶏もも肉', 'キャベツ', 'ヨーグルト', '豚こま肉', 'バナナ'].indexOf(p.name);
    return i >= 0 ? { ...p, uses: 20 - i } : p;
  });
  d = { ...d, items, log, presets };
  for (const n of ['牛乳', '食パン', 'バナナ', '洗剤']) d = addShop(d, n, d.presets.find((p) => p.name === n)?.id);
  if (params.get('bought') === '1') d = toggleShop(toggleShop(d, d.shop[1].id), d.shop[2].id);
  if (params.get('empty') === '1') d = emptyData();
  await saveData(d);
  if (params.get('premium') === '1') localStorage.setItem('tabedoki.mockFull', '1');
  if (params.get('premium') === '0') localStorage.removeItem('tabedoki.mockFull');
  history.replaceState(null, '', location.pathname);
}
