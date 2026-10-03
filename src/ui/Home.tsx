import { useMemo, useState } from 'react';
import type { Ctx } from '../App';
import { APP } from '../domain/config';
import { formatShort, leftLabel } from '../domain/dates';
import { addShop, counts, daysLeft, draftFromPreset, finish, rankedPresets, removeItem, sortByExpiry, undoLog, updateItem, urgency, type Draft, type Urgency } from '../domain/logic';
import type { Item, Outcome } from '../domain/types';
import { tap } from '../platform/native';
import { CatDot, DateSheet, Sheet, Stepper, yen } from './parts';

const SECTIONS: { id: Urgency; label: string }[] = [
  { id: 'expired', label: '期限が過ぎた' },
  { id: 'today', label: '今日まで' },
  { id: 'soon', label: '2日以内' },
  { id: 'week', label: '1週間以内' },
  { id: 'ok', label: 'まだ大丈夫' },
];

export function Home({ ctx, openAdd }: { ctx: Ctx; openAdd: (t: Draft[]) => void }) {
  const { data, today } = ctx;
  const [place, setPlace] = useState<string>('all');
  const [open, setOpen] = useState<Item | null>(null);
  const [dateFor, setDateFor] = useState<Item | null>(null);

  const items = useMemo(() => sortByExpiry(data.items.filter((i) => place === 'all' || i.place === place)), [data.items, place]);
  const c = counts(data.items, today);
  const quick = rankedPresets(data.presets).slice(0, 8);
  const cat = (id: string) => data.cats.find((x) => x.id === id) ?? data.cats[data.cats.length - 1];
  const placeName = (id: string) => data.places.find((x) => x.id === id)?.name ?? '';

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

  const done = (it: Item, outcome: Outcome, qty: number) => {
    ctx.setData((d) => finish(d, it.id, outcome, today, qty));
    setOpen(null);
    tap();
    ctx.toast({
      text: outcome === 'used' ? `${it.name}を使い切りました` : `${it.name}を捨てた記録をつけました${it.price ? `(${yen(it.price * qty)})` : ''}`,
      action: { label: '買い物メモへ', run: () => { ctx.setData((d) => addShop(d, it.name, it.presetId)); ctx.toast({ text: `買い物メモに${it.name}を足しました` }); } },
      action2: {
        label: '取り消す', run: () => ctx.setData((d) => {
          const last = [...d.log].reverse().find((l) => l.itemId === it.id);
          return last ? undoLog(d, last.id, it) : d;
        }),
      },
    });
  };

  let lastSection: Urgency | null = null;

  return (
    <div className="page home">
      <header className="home-head">
        <div className="brand"><span className="brand-name">タベドキ</span><span className="brand-sub">{formatShort(today)}</span></div>
        <button className="btn small ghost" onClick={() => ctx.go('presets')}>食材の目安</button>
      </header>

      <section className="summary" aria-label="今の冷蔵庫">
        <div className={'sum expired' + (c.expired ? ' hot' : '')}><b>{c.expired}</b><span>期限切れ</span></div>
        <div className={'sum today' + (c.today ? ' hot' : '')}><b>{c.today}</b><span>今日まで</span></div>
        <div className={'sum soon' + (c.soon ? ' hot' : '')}><b>{c.soon}</b><span>2日以内</span></div>
        <div className="sum total"><b>{c.total}</b><span>{ctx.premium ? '入っている' : `/ ${APP.freeItemLimit}品`}</span></div>
      </section>

      <section className="quick">
        <div className="quick-head"><h2>ワンタップで入れる</h2><span className="muted small">押すと目安の期限で登録</span></div>
        <div className="quick-row">
          {quick.map((p) => (
            <button key={p.id} className="qchip" onClick={() => quickAdd(p.id)}>
              <CatDot color={cat(p.cat).color} />{p.name}<small>{p.days}日</small>
            </button>
          ))}
          <button className="qchip more" onClick={() => openAdd([])}>ほかの食材…</button>
        </div>
      </section>

      <div className="places" role="tablist">
        {[{ id: 'all', name: 'すべて' }, ...data.places].map((pl) => {
          const n = pl.id === 'all' ? data.items.length : data.items.filter((i) => i.place === pl.id).length;
          return <button key={pl.id} role="tab" className={'pl' + (place === pl.id ? ' on' : '')} onClick={() => setPlace(pl.id)}>{pl.name}<small>{n}</small></button>;
        })}
      </div>

      {items.length === 0 ? (
        <div className="empty">
          {data.items.length === 0 ? (
            <>
              <p className="empty-lead">冷蔵庫はまだ空です。</p>
              <p>上の「ワンタップで入れる」を押すと、その食材が目安の期限つきで入ります。<br />買い物から帰ったら「まとめて入れる」で何品でも一度に。</p>
            </>
          ) : <p>ここには何も入っていません。</p>}
        </div>
      ) : (
        <ul className="items">
          {items.map((it) => {
            const left = daysLeft(it, today);
            const u = urgency(left);
            const head = u !== lastSection ? SECTIONS.find((s) => s.id === u)!.label : null;
            lastSection = u;
            return (
              <li key={it.id}>
                {head && <h3 className={'sec sec-' + u}>{head}</h3>}
                <button className={'item u-' + u} onClick={() => setOpen(it)}>
                  <CatDot color={cat(it.cat).color} />
                  <span className="item-main">
                    <span className="item-name">{it.name}{it.qty > 1 && <small> ×{it.qty}</small>}</span>
                    <span className="item-sub">{placeName(it.place)} ・ {it.kind === 'shohi' ? '消費期限' : '賞味期限'} {formatShort(it.expiry)}</span>
                  </span>
                  <span className="left">{leftLabel(left)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button className="fab" onClick={() => openAdd([])}><span>＋</span>まとめて入れる</button>

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
          title={`${dateFor.name}の期限`} value={dateFor.expiry} today={today}
          onClose={() => setDateFor(null)}
          onPick={(d) => { ctx.setData((x) => updateItem(x, dateFor.id, { expiry: d })); setDateFor(null); ctx.toast({ text: `${dateFor.name}の期限を${formatShort(d)}にしました` }); }}
        />
      )}
    </div>
  );
}

function ItemSheet(p: { it: Item; ctx: Ctx; onClose: () => void; onDone: (it: Item, o: Outcome, qty: number) => void; onDate: () => void }) {
  const { it, ctx } = p;
  const [qty, setQty] = useState(it.qty);
  const left = daysLeft(it, ctx.today);
  return (
    <Sheet title={it.name} onClose={p.onClose}>
      <p className="is-when">
        <span className={'left big u-' + urgency(left)}>{leftLabel(left)}</span>
        <span className="muted">{it.kind === 'shohi' ? '消費期限' : '賞味期限'} {formatShort(it.expiry)}</span>
      </p>
      {it.qty > 1 && (
        <div className="is-qty">
          <span>いくつ?</span>
          <Stepper value={qty} onChange={(n) => setQty(Math.min(it.qty, n))} label="個数" />
          <span className="muted small">/ {it.qty}個</span>
        </div>
      )}
      <div className="is-main">
        <button className="btn big used" onClick={() => p.onDone(it, 'used', qty)}>使い切った</button>
        <button className="btn big wasted" onClick={() => p.onDone(it, 'wasted', qty)}>捨てた</button>
      </div>
      <div className="is-sub">
        <button className="btn" onClick={p.onDate}>期限を直す</button>
        <button className="btn" onClick={() => { ctx.setData((d) => addShop(d, it.name, it.presetId)); ctx.toast({ text: `買い物メモに${it.name}を足しました` }); p.onClose(); }}>買い物メモへ</button>
      </div>
      <div className="is-sub">
        <label className="field">値段
          <input type="number" inputMode="numeric" min={0} defaultValue={it.price || ''} placeholder="0"
            onBlur={(e) => { const v = Math.max(0, Number(e.target.value) || 0); if (v !== it.price) ctx.setData((d) => updateItem(d, it.id, { price: v })); }} />円
        </label>
        <button className="btn ghost danger-text" onClick={() => { ctx.setData((d) => removeItem(d, it.id)); p.onClose(); ctx.toast({ text: `${it.name}を消しました(記録には残りません)` }); }}>間違えたので消す</button>
      </div>
      <p className="muted small">「捨てた」を押すと、値段の分が「もったいない額」として記録されます。</p>
    </Sheet>
  );
}
