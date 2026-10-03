import { useState } from 'react';
import type { Ctx } from '../App';
import { addShop, boughtToTray, rankedPresets, toggleShop, type Draft } from '../domain/logic';
import { tap } from '../platform/native';
import { TopBar } from './parts';

export function ShopPage({ ctx, openAdd }: { ctx: Ctx; openAdd: (t: Draft[]) => void }) {
  const { data } = ctx;
  const [name, setName] = useState('');
  const todo = data.shop.filter((s) => !s.done);
  const done = data.shop.filter((s) => s.done);
  // 最近使い切った・捨てた食材(まだ冷蔵庫に無い物)を候補に出す
  const recent = [...new Set([...data.log].reverse().map((l) => l.name))]
    .filter((n) => !data.items.some((i) => i.name === n) && !todo.some((s) => s.name === n)).slice(0, 8);
  const presetId = (n: string) => rankedPresets(data.presets).find((p) => p.name === n)?.id;

  const add = (n: string) => {
    if (!n.trim()) return;
    ctx.setData((d) => addShop(d, n, presetId(n.trim())));
    setName('');
    tap();
  };

  return (
    <div className="page shop">
      <TopBar title="買い物メモ" />
      <form className="shop-add" onSubmit={(e) => { e.preventDefault(); add(name); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="買う物を書く" enterKeyHint="done" />
        <button className="btn primary" disabled={!name.trim()}>足す</button>
      </form>

      {recent.length > 0 && (
        <section className="recent">
          <p className="muted small">最近なくなった食材</p>
          <div className="quick-row wrap">
            {recent.map((n) => <button key={n} className="qchip" onClick={() => add(n)}>＋ {n}</button>)}
          </div>
        </section>
      )}

      {data.shop.length === 0 ? (
        <div className="empty"><p>買う物はまだありません。</p><p>冷蔵庫の品を「使い切った」「捨てた」にすると、ここへ送れます。</p></div>
      ) : (
        <ul className="shop-list">
          {[...todo, ...done].map((s) => (
            <li key={s.id}>
              <button className={'shop-row' + (s.done ? ' done' : '')} onClick={() => { ctx.setData((d) => toggleShop(d, s.id)); tap(); }} aria-pressed={s.done}>
                <span className="check" aria-hidden>{s.done ? '✓' : ''}</span>
                <span>{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <div className="shop-foot">
          <button className="btn primary wide big" onClick={() => { const r = boughtToTray(data, ctx.today); ctx.setData(() => r.data); openAdd(r.tray); }}>
            買えた{done.length}品を冷蔵庫に入れる
          </button>
          <button className="link" onClick={() => ctx.setData((d) => ({ ...d, shop: d.shop.filter((s) => !s.done), deleted: [...d.deleted, ...done.map((s) => s.id)] }))}>買えた物を消すだけ</button>
        </div>
      )}
    </div>
  );
}
