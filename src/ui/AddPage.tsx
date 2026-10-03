import { useMemo, useState } from 'react';
import type { Ctx } from '../App';
import { addDays, diffDays, formatShort, leftLabel } from '../domain/dates';
import { addCustomPreset, addToTray, boughtToTray, lastBatch, rankedPresets, type Draft } from '../domain/logic';
import type { KigenKind, Preset } from '../domain/types';
import { tap } from '../platform/native';
import { CatDot, DateSheet, Sheet, Stepper, TopBar } from './parts';

const DAY_CHOICES = [1, 2, 3, 5, 7, 10, 14, 30, 60, 180];

export function AddPage({ ctx, tray, setTray }: { ctx: Ctx; tray: Draft[]; setTray: (f: Draft[] | ((t: Draft[]) => Draft[])) => void }) {
  const { data, today } = ctx;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [newName, setNewName] = useState<string | null>(null);

  const ranked = useMemo(() => rankedPresets(data.presets), [data.presets]);
  const shown = ranked.filter((p) => (cat === 'all' || p.cat === cat) && (!q.trim() || p.name.includes(q.trim())));
  const exact = ranked.some((p) => p.name === q.trim());
  const catOf = (id: string) => data.cats.find((c) => c.id === id) ?? data.cats[data.cats.length - 1];
  const inTray = (pid: string) => tray.find((d) => d.presetId === pid)?.qty ?? 0;
  const last = lastBatch(data, today);
  const boughtN = data.shop.filter((s) => s.done).length;
  const total = tray.length;

  const add = (pid: string) => {
    const p = data.presets.find((x) => x.id === pid)!;
    setTray((t) => addToTray(t, p, today));
    tap();
  };

  const commit = () => {
    const added = ctx.commit(tray);
    if (!added.length) return;
    const rest = tray.slice(added.length);
    setTray(rest);
    if (!rest.length) {
      ctx.toast({ text: `${added.length}品を冷蔵庫に入れました` });
      ctx.go('home');
    }
  };

  const editing = tray.find((d) => d.key === dateKey);

  return (
    <div className="page add">
      <TopBar title="まとめて入れる" onClose={() => ctx.go('home')} closeLabel="閉じる" />

      <div className="add-acts">
        <button className="btn small" disabled={!last.length} onClick={() => { setTray((t) => [...t, ...last]); tap(); }}>
          前回と同じ{last.length ? `(${last.length}品)` : ''}
        </button>
        {boughtN > 0 && (
          <button className="btn small" onClick={() => { const r = boughtToTray(data, today); ctx.setData(() => r.data); setTray((t) => [...t, ...r.tray]); }}>
            買い物メモの買えた物({boughtN})
          </button>
        )}
      </div>

      <div className="search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="食材の名前で探す・新しく作る" enterKeyHint="search" />
        {q && <button className="icon small" onClick={() => setQ('')} aria-label="消す">×</button>}
      </div>

      <div className="cats">
        {[{ id: 'all', name: 'よく買う順', color: 'transparent' }, ...data.cats].map((c) => (
          <button key={c.id} className={'cat' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>
            {c.id !== 'all' && <CatDot color={c.color} />}{c.name}
          </button>
        ))}
      </div>

      <div className="tiles">
        {q.trim() && !exact && (
          <button className="tile new" onClick={() => setNewName(q.trim())}>
            <span className="tile-name">「{q.trim()}」</span><small>を新しく作る</small>
          </button>
        )}
        {shown.map((p) => {
          const n = inTray(p.id);
          return (
            <button key={p.id} className={'tile' + (n ? ' in' : '')} onClick={() => add(p.id)}>
              <CatDot color={catOf(p.cat).color} />
              <span className="tile-name">{p.name}</span>
              <small>{p.days}日</small>
              {n > 0 && <i className="tile-n">{n}</i>}
            </button>
          );
        })}
        {!q.trim() && (
          <button className="tile new" onClick={() => setNewName('')}><span className="tile-name">＋ 新しい食材</span><small>名前を打って作る</small></button>
        )}
      </div>
      <p className="muted small note">日数は買った日からの目安です。袋の期限がわかるときは、カゴの日付を押して直してください。</p>

      <section className={'tray' + (tray.length ? ' open' : '')} aria-label="カゴ">
        {tray.length > 0 && (
          <ul className="tray-list">
            {tray.map((d) => {
              const left = diffDays(today, d.expiry);
              return (
                <li key={d.key} className="tray-row">
                  <span className="tray-name"><CatDot color={catOf(d.cat).color} />{d.name}</span>
                  <button className="date-chip" onClick={() => setDateKey(d.key)} aria-label={`${d.name}の期限を変える`}>
                    {formatShort(d.expiry)}<small>{leftLabel(left)}</small>
                  </button>
                  <Stepper value={d.qty} onChange={(n) => setTray((t) => t.map((x) => (x.key === d.key ? { ...x, qty: n } : x)))} label={`${d.name}の個数`} />
                  <button className="icon small" onClick={() => setTray((t) => t.filter((x) => x.key !== d.key))} aria-label={`${d.name}をカゴから出す`}>×</button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="tray-bar">
          {tray.length ? <button className="link" onClick={() => setTray([])}>空にする</button> : <span className="muted small">押した食材がここに入ります</span>}
          <button className="btn primary big" disabled={!tray.length} onClick={commit}>
            {total ? `${total}品を冷蔵庫に入れる` : '冷蔵庫に入れる'}
          </button>
        </div>
      </section>

      {editing && (
        <DateSheet
          title={`${editing.name}の期限`} value={editing.expiry} today={today}
          onClose={() => setDateKey(null)}
          onPick={(v) => { setTray((t) => t.map((x) => (x.key === editing.key ? { ...x, expiry: v } : x))); setDateKey(null); }}
        />
      )}
      {newName !== null && (
        <NewFoodSheet
          ctx={ctx} initial={newName}
          onClose={() => setNewName(null)}
          onMade={(preset) => {
            setNewName(null); setQ('');
            setTray((t) => addToTray(t, preset, today));
          }}
        />
      )}
    </div>
  );
}

function NewFoodSheet(p: { ctx: Ctx; initial: string; onClose: () => void; onMade: (preset: Preset) => void }) {
  const { ctx } = p;
  const [name, setName] = useState(p.initial);
  const [cat, setCat] = useState('other');
  const [place, setPlace] = useState(ctx.data.settings.defaultPlace);
  const [days, setDays] = useState(7);
  const [kind, setKind] = useState<KigenKind>('shomi');
  const [price, setPrice] = useState('');
  const make = () => {
    const r = addCustomPreset(ctx.data, { name, cat, place, days, kind, price: Math.max(0, Number(price) || 0) });
    ctx.setData(() => r.data); // r.preset の id をカゴでも使うので、同じ計算結果をそのまま保存する
    p.onMade(r.preset);
  };
  return (
    <Sheet title="新しい食材" onClose={p.onClose}>
      <label className="field block">名前<input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 手作りの煮物" autoFocus /></label>
      <p className="field-label">分類</p>
      <div className="chips-sel">
        {ctx.data.cats.map((c) => <button key={c.id} className={'cat' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}><CatDot color={c.color} />{c.name}</button>)}
      </div>
      <p className="field-label">置き場所</p>
      <div className="chips-sel">
        {ctx.data.places.map((pl) => <button key={pl.id} className={'cat' + (place === pl.id ? ' on' : '')} onClick={() => setPlace(pl.id)}>{pl.name}</button>)}
      </div>
      <p className="field-label">買ってから何日くらい?({formatShort(addDays(ctx.today, days))}まで)</p>
      <div className="chips-sel">
        {DAY_CHOICES.map((d) => <button key={d} className={'cat' + (days === d ? ' on' : '')} onClick={() => setDays(d)}>{d}日</button>)}
      </div>
      <div className="row2">
        <div className="seg">
          <button className={kind === 'shomi' ? 'on' : ''} onClick={() => setKind('shomi')}>賞味期限</button>
          <button className={kind === 'shohi' ? 'on' : ''} onClick={() => setKind('shohi')}>消費期限</button>
        </div>
        <label className="field">値段<input type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />円</label>
      </div>
      <button className="btn primary wide big" disabled={!name.trim()} onClick={make}>作ってカゴに入れる</button>
      <p className="muted small">作った食材は次から「よく買う」に並びます。</p>
    </Sheet>
  );
}
