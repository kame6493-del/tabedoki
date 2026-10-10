import { useMemo, useState } from 'react';
import type { Ctx } from '../App';
import { addDays, diffDays, formatShort, leftLabel, parseYmd } from '../domain/dates';
import { addCustomPreset, addToTray, boughtToTray, lastBatch, lastBatchDate, rankedPresets, type Draft } from '../domain/logic';
import type { KigenKind, Preset } from '../domain/types';
import { tap } from '../platform/native';
import { Icon } from './icons';
import { CatDot, DateSheet, FoodPic, PlacePill, Sheet, Stepper, Toggle, TopBar } from './parts';

const DAY_CHOICES = [1, 2, 3, 5, 7, 10, 14, 30, 60, 180];
const WD = ['日', '月', '火', '水', '木', '金', '土'];
type Tab = 'often' | 'tray' | 'last';

/**
 * 食材を追加(見本の「食材を追加」「まとめて入れる」「前回と同じ」)。
 * 手数: ほかの食材1品 = 追加を開く → 食材 → 追加 の3タップ。前回と同じ = 開く → 前回と同じ → 入れる の3タップ。
 */
export function AddPage({ ctx, tray, setTray }: { ctx: Ctx; tray: Draft[]; setTray: (f: Draft[] | ((t: Draft[]) => Draft[])) => void }) {
  const { data, today } = ctx;
  const [tab, setTab] = useState<Tab>(tray.length > 1 ? 'tray' : 'often');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [newName, setNewName] = useState<string | null>(null);

  const ranked = useMemo(() => rankedPresets(data.presets), [data.presets]);
  const shown = ranked.filter((p) => (cat === 'all' || p.cat === cat) && (!q.trim() || p.name.includes(q.trim())));
  const exact = ranked.some((p) => p.name === q.trim());
  const catOf = (id: string) => data.cats.find((c) => c.id === id) ?? data.cats[data.cats.length - 1];
  const placeOf = (id: string) => data.places.find((x) => x.id === id);
  const inTray = (pid: string) => tray.find((d) => d.presetId === pid)?.qty ?? 0;
  const boughtN = data.shop.filter((s) => s.done).length;
  const total = tray.length;

  const add = (pid: string) => {
    const p = data.presets.find((x) => x.id === pid)!;
    setTray((t) => addToTray(t, p, today));
    tap();
  };

  /** 下書きを冷蔵庫へ。入りきらなかった分はカゴに残す */
  const commitList = (list: Draft[], others: Draft[]) => {
    const added = ctx.commit(list);
    const left = [...list.slice(added.length), ...others];
    setTray(left);
    if (!added.length) return;
    if (!left.length) {
      ctx.toast({ text: `${added.length}品を冷蔵庫に入れました` });
      ctx.go('home');
    } else setTab('tray');
  };

  const editing = tray.find((d) => d.key === dateKey);

  return (
    <div className="page add">
      <TopBar title="食材を追加" onClose={() => ctx.go('home')} closeLabel="閉じる" />

      <div className="add-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'often'} className={tab === 'often' ? 'on' : ''} onClick={() => setTab('often')}><Icon name="calendar" size={22} /><span>よく使う食材</span></button>
        <button role="tab" aria-selected={tab === 'tray'} className={tab === 'tray' ? 'on' : ''} onClick={() => setTab('tray')}><Icon name="list" size={22} /><span>まとめて入れる</span>{total > 0 && <i className="tab-n">{total}</i>}</button>
        <button role="tab" aria-selected={tab === 'last'} className={tab === 'last' ? 'on' : ''} onClick={() => setTab('last')}><Icon name="clock" size={22} /><span>前回と同じ</span></button>
      </div>

      {tab === 'often' && (
        <>
          <div className="search">
            <Icon name="search" size={20} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="食材の名前で探す・新しく作る" enterKeyHint="search" />
            {q && <button className="icon small" onClick={() => setQ('')} aria-label="消す"><Icon name="close" size={16} /></button>}
          </div>

          <div className="cats">
            {[{ id: 'all', name: 'よく買う順', color: 'transparent' }, ...data.cats].map((c) => (
              <button key={c.id} className={'cat' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>
                {c.id !== 'all' && <CatDot color={c.color} />}{c.name}
              </button>
            ))}
          </div>

          {boughtN > 0 && (
            <button className="bought-btn" onClick={() => { const r = boughtToTray(data, today); ctx.setData(() => r.data); setTray((t) => [...t, ...r.tray]); setTab('tray'); }}>
              <Icon name="basket" size={20} />買い物メモの買えた物({boughtN})をカゴへ<Icon name="chevron" size={16} />
            </button>
          )}

          <div className="tiles">
            {q.trim() && !exact && (
              <button className="tile new" onClick={() => setNewName(q.trim())}>
                <span className="new-ic"><Icon name="plus" size={26} /></span>
                <span className="tile-name">「{q.trim()}」</span><small>を新しく作る</small>
              </button>
            )}
            {shown.map((p) => {
              const n = inTray(p.id);
              return (
                <button key={p.id} className={'tile' + (n ? ' in' : '')} onClick={() => add(p.id)} aria-label={`${p.name}をカゴに入れる`}>
                  <FoodPic name={p.name} cat={catOf(p.cat)} size={64} />
                  <span className="tile-name">{p.name}</span>
                  <small>{p.days}日</small>
                  {n > 0 ? <i className="tile-n">{n}</i> : <i className="tile-plus"><Icon name="plus" size={16} stroke={3} /></i>}
                </button>
              );
            })}
            {!q.trim() && (
              <button className="tile new" onClick={() => setNewName('')}><span className="new-ic"><Icon name="plus" size={26} /></span><span className="tile-name">新しい食材</span><small>名前を打って作る</small></button>
            )}
          </div>
          <p className="muted small note">日数は買った日からの目安です。袋の期限がわかるときは「まとめて入れる」で日付を押して直せます。</p>

          <div className="tray-bar">
            <button className="tray-peek" onClick={() => setTab('tray')} disabled={!total}>
              <Icon name="basket" size={20} /><span>{total ? `カゴ ${total}品` : 'カゴは空'}</span>
            </button>
            <button className="btn primary big" disabled={!total} onClick={() => commitList(tray, [])}>
              <Icon name="plus" size={20} stroke={2.6} />{total ? `この内容で追加(${total}品)` : 'この内容で追加'}
            </button>
          </div>
        </>
      )}

      {tab === 'tray' && (
        <>
          <p className="muted small lead">買った食材をまとめて追加できます。日付を押すと期限を直せます。</p>
          {tray.length === 0 ? (
            <div className="empty small-empty"><p>カゴは空です。「よく使う食材」で押した食材がここに入ります。</p></div>
          ) : (
            <ul className="tray-list">
              {tray.map((d) => {
                const left = diffDays(today, d.expiry);
                return (
                  <li key={d.key} className="tray-row">
                    <FoodPic name={d.name} cat={catOf(d.cat)} size={56} />
                    <div className="tray-main">
                      <span className="tray-name">{d.name}</span>
                      <PlacePill place={placeOf(d.place)} small />
                      <Stepper value={d.qty} onChange={(n) => setTray((t) => t.map((x) => (x.key === d.key ? { ...x, qty: n } : x)))} label={`${d.name}の個数`} />
                    </div>
                    <button className="date-chip" onClick={() => setDateKey(d.key)} aria-label={`${d.name}の期限を変える`}>
                      <small>{d.kind === 'shohi' ? '消費期限' : '賞味期限'}</small>
                      <b>{formatShort(d.expiry)}</b>
                      <small>{leftLabel(left)}</small>
                    </button>
                    <button className="icon small tray-x" onClick={() => setTray((t) => t.filter((x) => x.key !== d.key))} aria-label={`${d.name}をカゴから出す`}><Icon name="close" size={16} /></button>
                  </li>
                );
              })}
            </ul>
          )}
          <button className="btn wide soft" onClick={() => setTab('often')}><Icon name="plus" size={18} stroke={2.4} />食材を追加</button>
          {tray.length > 0 && <button className="link center" onClick={() => setTray([])}>カゴを空にする</button>}
          <div className="tray-bar">
            <button className="btn primary big wide" disabled={!total} onClick={() => commitList(tray, [])}>
              {total ? `まとめて追加(${total}件)` : 'まとめて追加'}
            </button>
          </div>
        </>
      )}

      {tab === 'last' && <LastTab ctx={ctx} onCommit={(list) => commitList(list, tray)} />}

      {editing && (
        <DateSheet
          title={editing.name} name={editing.name} cat={catOf(editing.cat)} value={editing.expiry} today={today}
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

function LastTab({ ctx, onCommit }: { ctx: Ctx; onCommit: (list: Draft[]) => void }) {
  const { data, today } = ctx;
  const last = useMemo(() => lastBatch(data, today), [data, today]);
  const [off, setOff] = useState<Set<number>>(new Set());
  const day = lastBatchDate(data);
  const catOf = (id: string) => data.cats.find((c) => c.id === id) ?? data.cats[data.cats.length - 1];
  const placeOf = (id: string) => data.places.find((x) => x.id === id);
  const picked = last.filter((_, i) => !off.has(i));
  if (!last.length) {
    return <div className="empty small-empty"><Icon name="clock" size={36} /><p>まだ登録がありません。<br />一度入れると、次からここで同じ内容をまとめて入れられます。</p></div>;
  }
  const d = day ? parseYmd(day) : null;
  return (
    <>
      <p className="muted small lead">前回まとめて入れた内容から選んで、今日の日付で入れます(期限までの日数は前回と同じ)。</p>
      <div className="last-card">
        <Icon name="basket" size={30} />
        <div><span>前回の登録</span><b>{d ? `${d.getMonth() + 1}月${d.getDate()}日(${WD[d.getDay()]})` : ''}</b></div>
        <span className="last-n">{last.length}件</span>
      </div>
      <ul className="last-list">
        {last.map((x, i) => (
          <li key={x.key} className="last-row">
            <FoodPic name={x.name} cat={catOf(x.cat)} size={44} />
            <span className="last-name">{x.name}{x.qty > 1 && <small> ×{x.qty}</small>}</span>
            <PlacePill place={placeOf(x.place)} small />
            <Toggle on={!off.has(i)} label={`${x.name}を入れる`} onChange={(v) => setOff((s) => { const n = new Set(s); if (v) n.delete(i); else n.add(i); return n; })} />
          </li>
        ))}
      </ul>
      <p className="last-sel">選択中 <b>{picked.length}件</b></p>
      <div className="tray-bar">
        <button className="btn primary big wide" disabled={!picked.length} onClick={() => onCommit(picked)}>この内容で入れる</button>
      </div>
    </>
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
      <p className="muted small">作った食材は次から「よく使う食材」に並びます。</p>
    </Sheet>
  );
}
