import { useEffect, useState, type ReactNode } from 'react';
import { addDays, daysInMonth, diffDays, formatShort, leftLabel, parseYmd, QUICK_DAYS, resolveMonthDay } from '../domain/dates';
import type { Ymd } from '../domain/types';

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

export function TopBar(p: { title: string; onClose?: () => void; right?: ReactNode; closeLabel?: string }) {
  return (
    <header className="topbar">
      {p.onClose ? <button className="icon" onClick={p.onClose} aria-label={p.closeLabel ?? '戻る'}>‹</button> : <span />}
      <h1>{p.title}</h1>
      <div className="topbar-right">{p.right}</div>
    </header>
  );
}

export function Sheet(p: { title?: string; onClose: () => void; children: ReactNode; className?: string }) {
  return (
    <div className="sheet-wrap" onClick={p.onClose}>
      <div className={'sheet ' + (p.className ?? '')} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={p.title}>
        <div className="sheet-grip" />
        {p.title && <h2 className="sheet-title">{p.title}</h2>}
        {p.children}
      </div>
    </div>
  );
}

export function CatDot(p: { color: string }) {
  return <i className="catdot" style={{ background: p.color }} />;
}

/**
 * 日付の早押し。
 * - 「今日」「明日」「3日後」…は1回押せば決まる
 * - 袋の日付を写すときは「月」→「日」の2回で決まる(年は自動)
 */
export function DateSheet(p: { title: string; value: Ymd; today: Ymd; onPick: (d: Ymd) => void; onClose: () => void }) {
  const cur = parseYmd(p.value);
  const [month, setMonth] = useState<number>(cur.getMonth() + 1);
  const base = parseYmd(p.today);
  // 今月から12か月を並べる(先の月が右へ)
  const months = Array.from({ length: 12 }, (_, i) => ((base.getMonth() + i) % 12) + 1);
  const yearOfMonth = parseYmd(resolveMonthDay(month, 1, p.today)).getFullYear();
  const nDays = daysInMonth(yearOfMonth, month);
  const left = diffDays(p.today, p.value);
  return (
    <Sheet title={p.title} onClose={p.onClose} className="date-sheet">
      <p className="date-now">いま: <b>{formatShort(p.value)}</b> <span className="muted">{leftLabel(left)}</span></p>
      <div className="quick-days">
        {QUICK_DAYS.map((q) => (
          <button key={q.label} className="qd" onClick={() => p.onPick(addDays(p.today, q.days))}>{q.label}</button>
        ))}
      </div>
      <p className="date-help">袋の日付を写す: 月 → 日 の順に押す</p>
      <div className="months">
        {months.map((m) => (
          <button key={m} className={'mo' + (m === month ? ' on' : '')} onClick={() => setMonth(m)}>{m}月</button>
        ))}
      </div>
      <div className="days">
        {Array.from({ length: nDays }, (_, i) => i + 1).map((d) => {
          const ymd = resolveMonthDay(month, d, p.today);
          const past = ymd < p.today;
          return (
            <button key={d} className={'dy' + (ymd === p.value ? ' on' : '') + (past ? ' past' : '') + (ymd === p.today ? ' today' : '')} onClick={() => p.onPick(ymd)}>{d}</button>
          );
        })}
      </div>
    </Sheet>
  );
}

export function Stepper(p: { value: number; onChange: (n: number) => void; min?: number; label?: string }) {
  const min = p.min ?? 1;
  return (
    <span className="stepper" aria-label={p.label}>
      <button onClick={() => p.onChange(Math.max(min, p.value - 1))} disabled={p.value <= min} aria-label="減らす">−</button>
      <b>{p.value}</b>
      <button onClick={() => p.onChange(p.value + 1)} aria-label="増やす">＋</button>
    </span>
  );
}

export function yen(n: number) {
  return `${Math.round(n).toLocaleString('ja-JP')}円`;
}
