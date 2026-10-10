import { useEffect, useState, type ReactNode } from 'react';
import { addDays, daysInMonth, diffDays, formatShort, leftLabel, parseYmd, QUICK_DAYS, resolveMonthDay } from '../domain/dates';
import type { Category, Place, Ymd } from '../domain/types';
import { artFor, placeLook, statusOf } from './foodArt';
import { Icon } from './icons';

export interface ToastMsg { text: string; action?: { label: string; run: () => void }; action2?: { label: string; run: () => void }; key?: number }

export function Toast(p: { msg: ToastMsg | null; onDone: () => void }) {
  useEffect(() => {
    if (!p.msg) return;
    const t = setTimeout(p.onDone, p.msg.action ? 5000 : 2600);
    return () => clearTimeout(t);
  }, [p.msg, p.onDone]);
  if (!p.msg) return null;
  return (
    <div className="toast" role="status" key={p.msg.key}>
      <button className="toast-text" onClick={p.onDone}>{p.msg.text}</button>
      <span className="toast-acts">
        {p.msg.action2 && <button onClick={() => { p.msg!.action2!.run(); p.onDone(); }}>{p.msg.action2.label}</button>}
        {p.msg.action && <button onClick={() => { p.msg!.action!.run(); p.onDone(); }}>{p.msg.action.label}</button>}
      </span>
    </div>
  );
}

/** 見本の題字(新しいアイコンの下の「タベドキ」を切り出した物) */
export function Logo(p: { height?: number }) {
  return <img className="logo" src="./img/logo.png" alt="タベドキ" style={{ height: p.height ?? 30 }} />;
}

/**
 * 上の帯。onBack=左に「‹」、onClose=右に「×」(見本の「食材を追加」)。
 * 押す所は 44px 四方
 */
export function TopBar(p: { title: string; onBack?: () => void; onClose?: () => void; right?: ReactNode; backLabel?: string; closeLabel?: string }) {
  return (
    <header className="topbar">
      {p.onBack ? <button className="icon back" onClick={p.onBack} aria-label={p.backLabel ?? '戻る'}><Icon name="back" size={24} /></button> : <span />}
      <h1>{p.title}</h1>
      <div className="topbar-right">
        {p.right}
        {p.onClose && <button className="icon close" onClick={p.onClose} aria-label={p.closeLabel ?? '閉じる'}><Icon name="close" size={20} /></button>}
      </div>
    </header>
  );
}

export function Sheet(p: { title?: string; onClose: () => void; children: ReactNode; className?: string }) {
  return (
    <div className="sheet-wrap" onClick={p.onClose}>
      <div className={'sheet ' + (p.className ?? '')} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={p.title}>
        <div className="sheet-grip" />
        {p.title && (
          <div className="sheet-head">
            <h2 className="sheet-title">{p.title}</h2>
            <button className="icon close" onClick={p.onClose} aria-label="閉じる"><Icon name="close" size={20} /></button>
          </div>
        )}
        {p.children}
      </div>
    </div>
  );
}

export function CatDot(p: { color: string }) {
  return <i className="catdot" style={{ background: p.color }} />;
}

/* 見本に絵の無い食材の、分類ごとの簡単な絵(新しく描いた物) */
const CAT_PIC: Record<string, string> = {
  veg: 'M14.5 4.5c1.5-1.5 3.5-1 4.5 0-1 .3-1.6 1-1.6 1s1.3-.2 2.1.6c-1.4.6-2.6.4-2.6.4L8 17.5c-1.5 1.5-3.6 1.6-4.5.7S3.2 15 4.7 13.5L13 7.6s-.2-1.2.4-2.6c.8.8.6 2.1.6 2.1z',
  fruit: 'M12 7.5c-2-1.6-6.5-1.2-6.5 4 0 4.5 3 8 5 8 .7 0 1-.4 1.5-.4s.8.4 1.5.4c2 0 5-3.5 5-8 0-5.2-4.5-5.6-6.5-4zM12 7.5c0-2 1-3.5 3-4',
  meat: 'M14.8 3.5a5.7 5.7 0 0 1 4 9.8c-1.7 1.7-4.3 2-6.1 1.3L9.5 17.7a1.9 1.9 0 1 1-2.6 2.6 1.9 1.9 0 1 1-2.6-2.6 1.9 1.9 0 1 1 2.6-2.6l3.1-3.2c-.7-1.8-.4-4.4 1.3-6.1a5.6 5.6 0 0 1 3.5-2.3z',
  fish: 'M3 12c3-4.5 7-6 11-4.5 2 .8 3.5 2.4 4.3 3.5L21.5 8v8l-3.2-3c-.8 1.1-2.3 2.7-4.3 3.5C10 18 6 16.5 3 12zM8 11.2h.01',
  dairy: 'M9 3h6v3l2 3v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9l2-3z',
  soy: 'M4 9.5 12 6l8 3.5v7L12 20l-8-3.5zM4 9.5 12 13l8-3.5M12 13v7',
  deli: 'M3.5 9h17v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM3.5 13h17M12 9v11',
  season: 'M10 3h4v3.5l1.5 2V20a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V8.5L10 6.5z',
  drink: 'M6 5h12l-1.5 15a1 1 0 0 1-1 .9h-7a1 1 0 0 1-1-.9zM6.5 9.5h11',
  frozen: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9',
  other: 'M3.5 11h17a8.5 8.5 0 0 1-17 0zM8 7.5c0-1.5 1-2 1-3.5M12 7.5c0-1.5 1-2 1-3.5M16 7.5c0-1.5 1-2 1-3.5',
};
const FILLED = new Set(['veg', 'fruit', 'meat', 'fish', 'dairy', 'season']);

export function FoodPic(p: { name: string; cat?: Category; size?: number; className?: string }) {
  const s = p.size ?? 52;
  const src = artFor(p.name);
  if (src) return <span className={'food-pic ' + (p.className ?? '')} style={{ width: s, height: s }}><img src={src} alt="" loading="lazy" /></span>;
  const id = p.cat && CAT_PIC[p.cat.id] ? p.cat.id : 'other';
  const color = p.cat?.color ?? '#7d8088';
  const fill = FILLED.has(id);
  return (
    <span className={'food-pic cat-pic ' + (p.className ?? '')} style={{ width: s, height: s, background: `color-mix(in srgb, ${color} 14%, var(--card))` }}>
      <svg viewBox="0 0 24 24" width={s * 0.58} height={s * 0.58} fill={fill ? color : 'none'} stroke={fill ? 'none' : color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={CAT_PIC[id]} />
      </svg>
    </span>
  );
}

export function PlacePill(p: { place?: Place; small?: boolean }) {
  if (!p.place) return null;
  const look = placeLook(p.place.id);
  return <span className={'place-pill tone-' + look.tone + (p.small ? ' small' : '')}><Icon name={look.icon} size={p.small ? 12 : 13} stroke={2.2} />{p.place.name}</span>;
}

export function StatusPill(p: { left: number; withSub?: boolean }) {
  const st = statusOf(p.left);
  return (
    <span className="status">
      <span className={'status-pill tone-' + st.tone}>{st.label}</span>
      {p.withSub && st.sub && <small>{st.sub}</small>}
    </span>
  );
}

export function Toggle(p: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={p.on} aria-label={p.label} className={'toggle' + (p.on ? ' on' : '')} onClick={() => p.onChange(!p.on)}><i /></button>;
}

/**
 * 日付を設定(見本の「日付を設定」)。
 * - 「今日」「明日」「3日後」…は1回押せば決まる
 * - 袋の日付を写すときは「月」→「日」の2回で決まる(年は自動)。見本の「この日付で決定」は置かない(2回で決まるように)
 */
export function DateSheet(p: { title: string; value: Ymd; today: Ymd; onPick: (d: Ymd) => void; onClose: () => void; name?: string; cat?: Category }) {
  const cur = parseYmd(p.value);
  const [month, setMonth] = useState<number>(cur.getMonth() + 1);
  const base = parseYmd(p.today);
  // 今月から12か月を並べる(先の月が後ろへ)
  const months = Array.from({ length: 12 }, (_, i) => ((base.getMonth() + i) % 12) + 1);
  const yearOfMonth = parseYmd(resolveMonthDay(month, 1, p.today)).getFullYear();
  const nDays = daysInMonth(yearOfMonth, month);
  const left = diffDays(p.today, p.value);
  return (
    <Sheet title="日付を設定" onClose={p.onClose} className="date-sheet">
      {p.name && (
        <div className="ds-item">
          <FoodPic name={p.name} cat={p.cat} size={56} />
          <b>{p.title}</b>
        </div>
      )}
      <div className="ds-now">
        <span>いまの期限</span>
        <b>{formatShort(p.value)}</b>
        <StatusPill left={left} />
      </div>
      <div className="quick-days">
        {QUICK_DAYS.map((q) => (
          <button key={q.label} className="qd" onClick={() => p.onPick(addDays(p.today, q.days))}>{q.label}</button>
        ))}
      </div>
      <div className="ds-bag"><Icon name="barcode" size={18} />袋・パックの日付を使う</div>
      <p className="ds-col">月</p>
      <div className="months">
        {months.map((m) => (
          <button key={m} className={'mo' + (m === month ? ' on' : '')} onClick={() => setMonth(m)}>{m}月</button>
        ))}
      </div>
      <p className="ds-col">日</p>
      <div className="days">
        {Array.from({ length: nDays }, (_, i) => i + 1).map((d) => {
          const ymd = resolveMonthDay(month, d, p.today);
          const past = ymd < p.today;
          return (
            <button key={d} className={'dy' + (ymd === p.value ? ' on' : '') + (past ? ' past' : '') + (ymd === p.today ? ' today' : '')} onClick={() => p.onPick(ymd)}>{d}</button>
          );
        })}
      </div>
      <div className="hint yellow"><Icon name="bulb" size={18} /><span>月と日だけタップすればOK!<br />年は自動で設定されます。</span></div>
      <p className="muted small">※日数の目安はタベドキ独自の値です。袋や箱の期限の表示が優先です。({leftLabel(left)})</p>
    </Sheet>
  );
}

export function Stepper(p: { value: number; onChange: (n: number) => void; min?: number; label?: string }) {
  const min = p.min ?? 1;
  return (
    <span className="stepper" aria-label={p.label}>
      <button onClick={() => p.onChange(Math.max(min, p.value - 1))} disabled={p.value <= min} aria-label="減らす"><Icon name="minus" size={16} stroke={2.4} /></button>
      <b>{p.value}</b>
      <button onClick={() => p.onChange(p.value + 1)} aria-label="増やす"><Icon name="plus" size={16} stroke={2.4} /></button>
    </span>
  );
}

export function yen(n: number) {
  return `${Math.round(n).toLocaleString('ja-JP')}円`;
}

/** 設定などの一行(左にアイコン、右に値と「›」) */
export function ListRow(p: { icon?: ReactNode; label: string; sub?: string; value?: ReactNode; onClick?: () => void; pro?: boolean; children?: ReactNode; className?: string }) {
  const inner = (
    <>
      {p.icon && <span className="lr-icon">{p.icon}</span>}
      <span className="lr-main"><span className="lr-label">{p.label}{p.pro && <i className="pro-mark">完全版</i>}</span>{p.sub && <span className="lr-sub">{p.sub}</span>}</span>
      {p.value !== undefined && <span className="lr-value">{p.value}</span>}
      {p.children}
      {p.onClick && <Icon name="chevron" size={18} className="lr-chev" />}
    </>
  );
  return p.onClick
    ? <button className={'list-row ' + (p.className ?? '')} onClick={p.onClick}>{inner}</button>
    : <div className={'list-row ' + (p.className ?? '')}>{inner}</div>;
}
