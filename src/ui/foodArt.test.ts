import { describe, expect, it } from 'vitest';
import { builtinPresets } from '../domain/foods';
import { artFor, niceTicks, placeLook, statusOf, yenMark } from './foodArt';

describe('見た目の決まり(見本どおり)', () => {
  it('期限の札: 期限切れ=赤・今日まで=だいだい・2日以内=黄・それ以降=灰', () => {
    expect(statusOf(-2)).toEqual({ label: '期限切れ', sub: '2日前', tone: 'red' });
    expect(statusOf(0)).toEqual({ label: '今日まで', tone: 'orange' });
    expect(statusOf(1)).toEqual({ label: 'あと1日', tone: 'yellow' });
    expect(statusOf(2).tone).toBe('yellow');
    expect(statusOf(3)).toEqual({ label: 'あと3日', tone: 'gray' });
  });

  it('置き場所の色: 冷蔵=青・野菜室=緑・冷凍=水色・常温=だいだい・足した場所=灰', () => {
    expect(placeLook('fridge').tone).toBe('blue');
    expect(placeLook('veg').tone).toBe('green');
    expect(placeLook('freezer').tone).toBe('sky');
    expect(placeLook('pantry').tone).toBe('orange');
    expect(placeLook('pl123').tone).toBe('gray');
  });

  it('食材の絵: 名前で引け、絵のファイルが本当にある。無い食材は null(分類の絵)', () => {
    const files = Object.keys(import.meta.glob('/public/img/food/*.png'));
    const named = builtinPresets().map((p) => p.name).filter((n) => artFor(n));
    expect(named.length).toBeGreaterThanOrEqual(20);
    for (const n of named) {
      const rel = artFor(n)!.replace('./', '/public/');
      expect(files, rel).toContain(rel);
    }
    expect(artFor('鶏もも肉')).toBeNull();
    expect(artFor(' 牛乳 ')).toBe('./img/food/milk.png');
  });

  it('棒グラフの目盛りは最大値を含み、きりがよい', () => {
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(3120)).toEqual([0, 2000, 4000]);
    const t = niceTicks(1280);
    expect(t[0]).toBe(0);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(1280);
    expect(yenMark(1280)).toBe('¥1,280');
  });
});
