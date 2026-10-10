import { useState } from 'react';
import type { Ctx } from '../App';
import { addShop, boughtToTray, daysLeft, rankedPresets, toggleShop, type Draft } from '../domain/logic';
import { tap } from '../platform/native';
import { statusOf } from './foodArt';
import { Icon } from './icons';
import { FoodPic, TopBar } from './parts';

type Filter = 'all' | 'food' | 'hand';

/** 見本の「買い物メモ」。食材から(冷蔵庫の品・記録から送った物)と手入力で分けて見られる */
export function ShopPage({ ctx, openAdd }: { ctx: Ctx; openAdd: (t: Draft[]) => void }) {
  const { data, today } = ctx;
  const [name, setName] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const todo = data.shop.filter((s) => !s.done);
  const done = data.shop.filter((s) => s.done);
  // 最近使い切った・捨てた食材(まだ冷蔵庫に無い物)を候補に出す
  const recent = [...new Set([...data.log].reverse().map((l) => l.name))]
    .filter((n) => !data.items.some((i) => i.name === n) && !todo.some((s) => s.name === n)).slice(0, 8);
  const presetId = (n: string) => rankedPresets(data.presets).find((p) => p.name === n)?.id;
  const presetOf = (s: { presetId?: string; name: string }) => data.presets.find((p) => p.id === s.presetId) ?? data.presets.find((p) => p.name === s.name);
  const catOf = (id?: string) => data.cats.find((c) => c.id === id);
  const all = [...todo, ...done];
  const fromFood = all.filter((s) => !!presetOf(s));
  const shown = filter === 'all' ? all : filter === 'food' ? fromFood : all.filter((s) => !presetOf(s));

  const add = (n: string) => {
    if (!n.trim()) return;
    ctx.setData((d) => addShop(d, n, presetId(n.trim())));
    setName('');
    tap();
  };

  /** 行の下の一言: 冷蔵庫にまだある=残り日数 / 記録にある=なくなりました */
  const note = (n: string, fromFood: boolean) => {
    const inFridge = data.items.filter((i) => i.name === n).sort((a, b) => a.expiry.localeCompare(b.expiry))[0];
    if (inFridge) {
      const st = statusOf(daysLeft(inFridge, today));
      return <span className={'shop-note tone-' + st.tone}>冷蔵庫に残り・{st.label}</span>;
    }
    if (data.log.some((l) => l.name === n)) return <span className="shop-note gone">なくなりました</span>;
    return <span className="shop-note">{fromFood ? '食材から' : '手入力'}</span>;
  };

  return (
    <div className="page shop">
      <TopBar title="買い物メモ" />
      <div className="shop-filters">
        {([['all', 'すべて', all.length], ['food', '食材から', fromFood.length], ['hand', '手入力', all.length - fromFood.length]] as const).map(([id, label, n]) => (
          <button key={id} className={'sf' + (filter === id ? ' on' : '')} onClick={() => setFilter(id)}>{label}<i>{n}</i></button>
        ))}
      </div>
      <div className="hint yellow"><Icon name="bulb" size={18} /><span>使い切った・捨てた食材は、冷蔵庫の画面からここへ送れます。</span></div>

      {recent.length > 0 && (
        <section className="recent">
          <p className="sec-label">最近なくなった食材</p>
          <div className="quick-row wrap">
            {recent.map((n) => (
              <button key={n} className="rchip" onClick={() => add(n)}>
                <FoodPic name={n} cat={catOf(presetOf({ name: n })?.cat)} size={28} /><span>{n}</span><Icon name="plus" size={14} stroke={2.6} />
              </button>
            ))}
          </div>
        </section>
      )}

      {data.shop.length === 0 ? (
        <div className="empty"><img src="./img/grocery_bag.png" alt="" className="empty-art" /><p>買う物はまだありません。</p><p className="small">冷蔵庫の品を「使い切った」「捨てた」にすると、ここへ送れます。</p></div>
      ) : (
        <ul className="shop-list">
          {shown.map((s) => (
            <li key={s.id}>
              <button className={'shop-row' + (s.done ? ' done' : '')} onClick={() => { ctx.setData((d) => toggleShop(d, s.id)); tap(); }} aria-pressed={s.done}>
                <span className="check" aria-hidden>{s.done && <Icon name="check" size={16} stroke={3} />}</span>
                <FoodPic name={s.name} cat={catOf(presetOf(s)?.cat)} size={44} />
                <span className="shop-main"><span className="shop-name">{s.name}</span>{note(s.name, !!presetOf(s))}</span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="muted small list-none">ここには何もありません。</li>}
        </ul>
      )}

      <form className="shop-add" onSubmit={(e) => { e.preventDefault(); add(name); }}>
        <Icon name="plus" size={20} stroke={2.4} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="手入力で食材を追加" enterKeyHint="done" aria-label="買う物" />
        <button className="btn primary small" disabled={!name.trim()}>足す</button>
      </form>

      {done.length > 0 && (
        <section className="shop-done">
          <img src="./img/basket_done.png" alt="" />
          <b>買い物おつかれさまでした!</b>
          <span className="muted small">買えた食材を冷蔵庫に追加しましょう。</span>
          <button className="btn primary wide big" onClick={() => { const r = boughtToTray(data, ctx.today); ctx.setData(() => r.data); openAdd(r.tray); }}>
            買えた{done.length}品を冷蔵庫に入れる
          </button>
          <button className="btn wide" onClick={() => ctx.setData((d) => ({ ...d, shop: d.shop.filter((s) => !s.done), deleted: [...d.deleted, ...done.map((s) => s.id)] }))}>買えた物を消すだけ</button>
        </section>
      )}
    </div>
  );
}
