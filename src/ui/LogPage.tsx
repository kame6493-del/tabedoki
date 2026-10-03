import type { Ctx } from '../App';
import { formatShort, parseYmd } from '../domain/dates';
import { monthStats, topWasted } from '../domain/logic';
import { TopBar, yen } from './parts';

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function LogPage({ ctx }: { ctx: Ctx }) {
  const { data, today } = ctx;
  const t = parseYmd(today);
  const months = Array.from({ length: 6 }, (_, i) => monthKey(new Date(t.getFullYear(), t.getMonth() - 5 + i, 1)));
  const stats = months.map((m) => monthStats(data.log, m));
  const cur = stats[5];
  const prev = stats[4];
  const maxYen = Math.max(1, ...stats.map((s) => s.wastedYen));
  const worst = topWasted(data.log.filter((l) => l.date >= `${months[3]}-01`));
  const recent = [...data.log].reverse().slice(0, 30);

  return (
    <div className="page log">
      <TopBar title="記録" />
      <section className="log-hero">
        <p className="log-label">{t.getMonth() + 1}月のもったいない額</p>
        <p className="log-yen"><b>{yen(cur.wastedYen)}</b></p>
        <p className="log-sub">
          捨てた {cur.wasted}品 ・ 使い切った {cur.used}品
          {cur.used + cur.wasted > 0 && <> ・ 使い切り率 <b>{Math.round(cur.rate * 100)}%</b></>}
        </p>
        {prev.used + prev.wasted > 0 && (
          <p className="log-cmp">先月は {yen(prev.wastedYen)}{cur.wastedYen < prev.wastedYen ? `。${yen(prev.wastedYen - cur.wastedYen)}減っています` : ''}</p>
        )}
      </section>

      <section className="card">
        <h2>月ごとのもったいない額</h2>
        <ul className="bars">
          {stats.map((s) => (
            <li key={s.month}>
              <span className="bar-m">{Number(s.month.slice(5))}月</span>
              <span className="bar-track"><span className="bar" style={{ width: `${(s.wastedYen / maxYen) * 100}%` }} /></span>
              <span className="bar-v">{yen(s.wastedYen)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>よく捨てている食材(3か月)</h2>
        {worst.length === 0 ? <p className="muted">まだありません。捨てた記録がつくと、買う量を見直す食材がわかります。</p> : (
          <ol className="worst">
            {worst.map((w) => <li key={w.name}><span>{w.name}</span><span className="muted">{w.times}回 ・ {yen(w.yen)}</span></li>)}
          </ol>
        )}
      </section>

      <section className="card">
        <h2>最近の記録</h2>
        {recent.length === 0 ? <p className="muted">冷蔵庫の品を押して「使い切った」「捨てた」を選ぶと、ここに残ります。</p> : (
          <ul className="recent-log">
            {recent.map((l) => (
              <li key={l.id}>
                <span className="muted small">{formatShort(l.date)}</span>
                <span>{l.name}{l.qty > 1 ? ` ×${l.qty}` : ''}</span>
                <span className={'tag ' + l.outcome}>{l.outcome === 'used' ? '使い切った' : `捨てた ${l.price ? yen(l.price) : ''}`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="muted small">金額は登録した値段からの計算です。食材の値段は「設定 → 食材の目安と値段」で変えられます。</p>
    </div>
  );
}
