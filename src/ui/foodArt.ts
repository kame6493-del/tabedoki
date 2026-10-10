/**
 * 食材の絵と、期限・置き場所の見た目の決まり(画面から切り離して試せるように、ここは絵を描かない)。
 * 食材の絵は見本(ChatGPT に作らせた UI 参考画像)から切り出した物(scripts/cut_ref_images.py)。
 * 見本に絵の無い食材は、分類ごとの簡単な絵(FoodPic の CatPic)を出す。
 */
import type { IconName } from './icons';

const ART: Record<string, string> = {
  牛乳: 'milk', 卵: 'egg', ヨーグルト: 'yogurt', チーズ: 'cheese', 豆腐: 'tofu', 納豆: 'natto', ハム: 'ham',
  レタス: 'lettuce', キャベツ: 'lettuce', きゅうり: 'cucumber', トマト: 'tomato', にんじん: 'carrot',
  ほうれん草: 'spinach', 小松菜: 'spinach', もやし: 'moyashi', 玉ねぎ: 'onion', バナナ: 'banana',
  食パン: 'bread', ゆで麺: 'udon', 冷凍うどん: 'frozen_udon', アイス: 'icecream',
};

/** 食材名から絵のパス。見本に無い食材は null(分類の絵を出す) */
export function artFor(name: string): string | null {
  const k = ART[name.trim()];
  return k ? `./img/food/${k}.png` : null;
}

export type Tone = 'red' | 'orange' | 'yellow' | 'gray';

/** 一覧の右の札。見本どおり 期限切れ=赤・今日まで=だいだい・2日以内=黄・それ以降=灰 */
export function statusOf(left: number): { label: string; sub?: string; tone: Tone } {
  if (left < 0) return { label: '期限切れ', sub: `${-left}日前`, tone: 'red' };
  if (left === 0) return { label: '今日まで', tone: 'orange' };
  if (left <= 2) return { label: `あと${left}日`, tone: 'yellow' };
  return { label: `あと${left}日`, tone: 'gray' };
}

/** 置き場所の色とアイコン。見本どおり 冷蔵=青・野菜室=緑・冷凍=水色・常温=だいだい。足した置き場所は灰 */
export function placeLook(id: string): { icon: IconName; tone: 'blue' | 'green' | 'sky' | 'orange' | 'gray' } {
  switch (id) {
    case 'fridge': return { icon: 'fridge', tone: 'blue' };
    case 'veg': return { icon: 'leaf', tone: 'green' };
    case 'freezer': return { icon: 'snow', tone: 'sky' };
    case 'pantry': return { icon: 'box', tone: 'orange' };
    default: return { icon: 'box', tone: 'gray' };
  }
}

/** 縦棒グラフの目盛り(0 と、きりのよい3〜4本) */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(Math.round(v));
  if (out[out.length - 1] < max) out.push(Math.round(out[out.length - 1] + step));
  return out;
}

/** 円の書き方(見本の「¥1,280」) */
export function yenMark(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`;
}
