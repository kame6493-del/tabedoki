import { useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import type { Ctx } from '../App';
import { APP } from '../domain/config';
import { formatShort } from '../domain/dates';
import { addShop, daysLeft, draftFromPreset, finish, rankedPresets, removeItem, sortByExpiry, undoLog, updateItem, type Draft } from '../domain/logic';
import type { Item, Outcome } from '../domain/types';
import { tap } from '../platform/native';
import { placeLook, statusOf } from './foodArt';
import { Icon } from './icons';
import { DateSheet, FoodPic, Logo, PlacePill, Sheet, StatusPill, Stepper, yen } from './parts';

export function Home({ ctx, openAdd }: { ctx: Ctx; openAdd: (t: Draft[]) => void }) {
  const { data, today } = ctx;
  const [place, setPlace] = useState<string>('all');
  const [open, setOpen] = useState<Item | null>(null);
  const [dateFor, setDateFor] = useState<Item | null>(null);
  const [swiped, setSwiped] = useState<string | null>(null);

  const items = useMemo(() => sortByExpiry(data.items.filter((i) => place === 'all' || i.place === place)), [data.items, place]);
  const near = items.filter((i) => daysLeft(i, today) <= 2);
  const rest = items.filter((i) => daysLeft(i, today) > 2);
  const quick = rankedPresets(data.presets).slice(0, 8);
  const cat = (id: string) => data.cats.find((x) => x.id === id) ?? data.cats[data.cats.length - 1];
  const placeOf = (id: string) => data.places.find((x) => x.id === id);

  const quickAdd = (presetId: string) => {
    const p = data.presets.find((x) => x.id === presetId)!;
    const [added] = ctx.commit([draftFromPreset(p, today)]);
    if (!added) return;
    tap();
    ctx.toast({
      text: `${p.name}を入れました(${formatShort(added.expiry)}まで)`,
      action: { label: '日付を直す', run: () => setDateFor(added) },
      action2: { label: '取り消す', run: () => ctx.setData((cur) => ({ ...cur, items: cur.items.filter((i) => i.id !== added.id) })) },
    });
  };

  const done = (it: Item, outcome: Outcome, qty: number, toShop = false) => {
    ctx.setData((d) => {
      const x = finish(d, it.id, outcome, today, qty);
      return toShop ? addShop(x, it.name, it.presetId) : x;
    });
    setOpen(null);
    setSwiped(null);
    tap();
    ctx.toast({
      text: (outcome === 'used' ? `${it.name}を使い切りました` : `${it.name}を捨てた記録をつけました${it.price ? `(${yen(it.price * qty)})` : ''}`) + (toShop ? '。買い物メモにも入れました' : ''),
      action: toShop ? undefined : { label: '買い物メモへ', run: () => { ctx.setData((d) => addShop(d, it.name, it.presetId)); ctx.toast({ text: `買い物メモに${it.name}を足しました` }); } },
      action2: {
        label: '取り消す', run: () => ctx.setData((d) => {
          const last = [...d.log].reverse().find((l) => l.itemId === it.id);
          return last ? undoLog(d, last.id, it) : d;
        }),
      },
    });
  };

  const row = (it: Item) => {
    const left = daysLeft(it, today);
    const st = statusOf(left);
    return (
      <li key={it.id}>
        <SwipeRow open={swiped === it.id} onOpen={(o) => setSwiped(o ? it.id : null)}
          onUsed={() => done(it, 'used', it.qty)} onWasted={() => done(it, 'wasted', it.qty)}>
          <button className={'item tone-' + st.tone} onClick={() => (swiped ? setSwiped(null) : setOpen(it))}>
            <FoodPic name={it.name} cat={cat(it.cat)} size={52} />
            <span className="item-main">
              <span className="item-name">{it.name}{it.qty > 1 && <small> ×{it.qty}</small>}</span>
              <span className="item-sub"><PlacePill place={placeOf(it.place)} small /><span className={'item-date' + (left <= 2 ? ' hot' : '')}><span className="kind">{it.kind === 'shohi' ? '消費' : '賞味'}</span>{formatShort(it.expiry)}</span></span>
            </span>
            <StatusPill left={left} withSub />
            <Icon name="chevron" size={16} className="chev" />
          </button>
        </SwipeRow>
      </li>
    );
  };

  return (
    <div className="page home">
      <header className="home-head">
        <span className="home-date">{formatShort(today)}</span>
        <Logo height={34} />
        <button className="icon" onClick={() => ctx.go('settings')} aria-label="設定"><Icon name="gear" size={24} /></button>
      </header>

      <section className="quick">
        <div className="quick-head"><h2>ワンタップで入れる</h2><span className="muted small">押すと目安の期限で登録</span></div>
        <div className="quick-row">
          {quick.map((p) => (
            <button key={p.id} className="qchip" onClick={() => quickAdd(p.id)} aria-label={`${p.name}を入れる`}>
              <FoodPic name={p.name} cat={cat(p.cat)} size={44} />
              <span className="qchip-name">{p.name}</span>
              <small>{p.days}日</small>
              <i className="plus-dot"><Icon name="plus" size={13} stroke={3} /></i>
            </button>
          ))}
          <button className="qchip more" onClick={() => openAdd([])}><span className="more-ic"><Icon name="plus" size={22} /></span><span className="qchip-name">ほかの食材</span></button>
        </div>
      </section>

      <div className="places" role="tablist">
        {[{ id: 'all', name: 'すべて' }, ...data.places].map((pl) => {
          const look = pl.id === 'all' ? { icon: 'all' as const, tone: 'all' } : placeLook(pl.id);
          return (
            <button key={pl.id} role="tab" aria-selected={place === pl.id} className={'pl tone-' + look.tone + (place === pl.id ? ' on' : '')} onClick={() => setPlace(pl.id)}>
              <Icon name={look.icon} size={22} /><span>{pl.name}</span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="empty">
          {data.items.length === 0 ? (
            <>
              <img src="./img/grocery_bag.png" alt="" className="empty-art" />
              <p className="empty-lead">冷蔵庫はまだ空です。</p>
              <p>上の「ワンタップで入れる」を押すと、その食材が目安の期限つきで入ります。<br />買い物から帰ったら「食材を追加」で何品でも一度に。</p>
            </>
          ) : <p>ここには何も入っていません。</p>}
        </div>
      ) : (
        <>
          <section className={'list-card' + (near.length ? ' near' : '')}>
            <div className="list-head">
              <Icon name="bell" size={20} />
              <h2>期限が近いもの</h2>
              <i className="count-badge">{near.length}</i>
              <span className="list-cap">{ctx.premium ? `全${data.items.length}品` : `${data.items.length} / ${APP.freeItemLimit}品`}</span>
            </div>
            {near.length ? <ul className="items">{near.map(row)}</ul> : <p className="muted small list-none">2日以内に期限の来る食材はありません。</p>}
          </section>
          {rest.length > 0 && (
            <section className="list-card">
              <div className="list-head plain"><h2>そのほかの食材</h2><span className="list-cap">{rest.length}品</span></div>
              <ul className="items">{rest.map(row)}</ul>
            </section>
          )}
          <p className="muted small swipe-hint">左にずらすと「使い切った」「捨てた」をすぐ記録できます。</p>
        </>
      )}

      <div className="home-actions">
        <button className="home-add" onClick={() => openAdd([])}><Icon name="plus" size={20} stroke={2.4} />食材を追加</button>
        <button className="home-memo" onClick={() => ctx.go('shop')}><Icon name="cart" size={20} />買い物メモ</button>
      </div>

      {open && (
        <ItemSheet
          it={open} ctx={ctx}
          onClose={() => setOpen(null)}
          onDone={done}
          onDate={() => { setDateFor(open); setOpen(null); }}
        />
      )}
      {dateFor && (
        <DateSheet
          title={dateFor.name} name={dateFor.name} cat={cat(dateFor.cat)} value={dateFor.expiry} today={today}
          onClose={() => setDateFor(null)}
          onPick={(d) => { ctx.setData((x) => updateItem(x, dateFor.id, { expiry: d })); setDateFor(null); ctx.toast({ text: `${dateFor.name}の期限を${formatShort(d)}にしました` }); }}
        />
      )}
    </div>
  );
}

/** 見本の「一覧から食材をスワイプして使い切った/捨てた」。左へずらすと2つのボタンが出る */
function SwipeRow(p: { open: boolean; onOpen: (o: boolean) => void; onUsed: () => void; onWasted: () => void; children: ReactNode }) {
  const W = 156;
  const start = useRef<{ x: number; y: number; base: number } | null>(null);
  const [dx, setDx] = useState<number | null>(null);
  const moved = useRef(false);
  const down = (e: RPointerEvent) => { start.current = { x: e.clientX, y: e.clientY, base: p.open ? -W : 0 }; moved.current = false; };
  const move = (e: RPointerEvent) => {
    const s = start.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    if (!moved.current && Math.abs(mx) < 8) return;
    if (!moved.current && Math.abs(e.clientY - s.y) > Math.abs(mx)) { start.current = null; return; }
    moved.current = true;
    setDx(Math.max(-W - 20, Math.min(0, s.base + mx)));
  };
  const up = () => {
    if (start.current && moved.current && dx !== null) p.onOpen(dx < -W / 2);
    start.current = null;
    setDx(null);
  };
  const x = dx ?? (p.open ? -W : 0);
  return (
    <div className={'swipe' + (p.open ? ' open' : '')}>
      <div className="swipe-acts" aria-hidden={!p.open && dx === null}>
        <button className="sw used" onClick={p.onUsed} tabIndex={p.open ? 0 : -1}><Icon name="check" size={22} stroke={2.6} />使い切った</button>
        <button className="sw wasted" onClick={p.onWasted} tabIndex={p.open ? 0 : -1}><Icon name="trash" size={22} />捨てた</button>
      </div>
      <div className="swipe-front" style={{ transform: `translateX(${x}px)`, transition: dx === null ? 'transform .18s ease-out' : 'none' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClickCapture={(e) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false; } }}>
        {p.children}
      </div>
    </div>
  );
}

function ItemSheet(p: { it: Item; ctx: Ctx; onClose: () => void; onDone: (it: Item, o: Outcome, qty: number, toShop?: boolean) => void; onDate: () => void }) {
  const { it, ctx } = p;
  const [qty, setQty] = useState(it.qty);
  const [toShop, setToShop] = useState(false);
  const left = daysLeft(it, ctx.today);
  const cat = ctx.data.cats.find((c) => c.id === it.cat);
  const place = ctx.data.places.find((x) => x.id === it.place);
  return (
    <Sheet title="使い切った・捨てた" onClose={p.onClose} className="item-sheet">
      <div className="is-head">
        <FoodPic name={it.name} cat={cat} size={76} />
        <div className="is-head-main">
          <b className="is-name">{it.name}{it.qty > 1 && <small> ×{it.qty}</small>}</b>
          <span className="is-pills"><PlacePill place={place} /><StatusPill left={left} /></span>
          <span className="muted small">{it.kind === 'shohi' ? '消費期限' : '賞味期限'} {formatShort(it.expiry)}</span>
        </div>
      </div>
      {it.qty > 1 && (
        <div className="is-field">
          <span className="is-label">数量</span>
          <div className="is-qty"><Stepper value={qty} onChange={(n) => setQty(Math.min(it.qty, n))} label="個数" /><span className="muted small">/ {it.qty}個</span></div>
        </div>
      )}
      <div className="is-field">
        <span className="is-label">金額<small>(1個の値段・任意)</small></span>
        <label className="yen-field"><span>¥</span>
          <input type="number" inputMode="numeric" min={0} defaultValue={it.price || ''} placeholder="0" aria-label="値段"
            onBlur={(e) => { const v = Math.max(0, Number(e.target.value) || 0); if (v !== it.price) ctx.setData((d) => updateItem(d, it.id, { price: v })); }} />
        </label>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={toShop} onChange={(e) => setToShop(e.target.checked)} />
        <span><b>買い物メモに入れる</b><small>同じものを買い忘れないように、メモに足します。</small></span>
      </label>
      <div className="is-main">
        <button className="btn big used" onClick={() => p.onDone(it, 'used', qty, toShop)}><Icon name="check" size={22} stroke={2.6} />使い切った</button>
        <button className="btn big wasted" onClick={() => p.onDone(it, 'wasted', qty, toShop)}><Icon name="trash" size={22} />捨てた</button>
      </div>
      <div className="is-sub">
        <button className="btn" onClick={p.onDate}><Icon name="calendar" size={18} />期限を直す</button>
        <button className="btn ghost danger-text" onClick={() => { ctx.setData((d) => removeItem(d, it.id)); p.onClose(); ctx.toast({ text: `${it.name}を消しました(記録には残りません)` }); }}>間違えたので消す</button>
      </div>
      <p className="muted small">「捨てた」を押すと、値段の分が「ムダ金額」として記録されます。</p>
    </Sheet>
  );
}
