import { useState } from 'react';
import type { Ctx } from '../App';
import { formatShort, parseYmd } from '../domain/dates';
import { monthStats, topWasted } from '../domain/logic';
import { niceTicks, yenMark } from './foodArt';
import { Icon } from './icons';
import { FoodPic, TopBar, yen } from './parts';

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 見本の「ムダ管理」。月別のムダ(棒グラフ)と食材別。見本の「理由別」は捨てた理由を記録していないので置かない */
export function LogPage({ ctx }: { ctx: Ctx }) {
  const { data, today } = ctx;
  const t = parseYmd(today);
  const months = Array.from({ length: 6 }, (_, i) => monthKey(new Date(t.getFullYear(), t.getMonth() - 5 + i, 1)));
  const stats = months.map((m) => monthStats(data.log, m));
  const [sel, setSel] = useState(5);
  const [tab, setTab] = useState<'month' | 'food'>('month');
  const cur = stats[sel];
  const prev = sel > 0 ? stats[sel - 1] : null;
  const maxYen = Math.max(...stats.map((s) => s.wastedYen));
  const ticks = niceTicks(maxYen);
  const top = ticks[ticks.length - 1] || 1;
  const worst = topWasted(data.log.filter((l) => l.date >= `${months[3]}-01`));
  const worstMax = Math.max(1, ...worst.map((w) => w.yen));
  const byFood = topWasted(data.log, 30);
  const byFoodMax = Math.max(1, ...byFood.map((w) => w.yen));
  const recent = [...data.log].reverse().slice(0, 30);
  const catOfName = (n: string) => { const c = data.log.find((l) => l.name === n)?.cat; return data.cats.find((x) => x.id === c); };
  const [y, m] = months[sel].split('-').map(Number);
  const isThis = sel === 5;
  const diff = prev ? cur.wastedYen - prev.wastedYen : 0;

  return (
    <div className="page log">
      <TopBar title="ムダ管理" />
      <div className="seg-tabs">
        <button className={tab === 'month' ? 'on' : ''} onClick={() => setTab('month')}>月別のムダ</button>
        <button className={tab === 'food' ? 'on' : ''} onClick={() => setTab('food')}>食材別</button>
      </div>

      {tab === 'month' && (
        <>
          <div className="month-nav">
            <button className="icon small" disabled={sel === 0} onClick={() => setSel(sel - 1)} aria-label="前の月"><Icon name="back" size={18} /></button>
            <b>{y}年{m}月</b>
            <button className="icon small" disabled={sel === 5} onClick={() => setSel(sel + 1)} aria-label="次の月"><Icon name="chevron" size={18} /></button>
          </div>

          <section className="log-hero">
            <img src="./img/coin.png" alt="" className="coin" />
            <div className="log-hero-main">
              <p className="log-label">{isThis ? '今月のムダ金額' : `${m}月のムダ金額`}</p>
              <p className="log-yen"><b>{yenMark(cur.wastedYen)}</b></p>
            </div>
            {prev && prev.used + prev.wasted > 0 && (
              <p className={'log-cmp' + (diff > 0 ? ' up' : '')}>
                <i><Icon name={diff > 0 ? 'up' : 'down'} size={13} stroke={3} /></i>
                {diff < 0 ? <>先月より <b>{yen(-diff)}</b> 減りました!</> : diff > 0 ? <>先月より <b>{yen(diff)}</b> 増えました</> : <>先月と同じです</>}
              </p>
            )}
            <p className="log-sub">
              捨てた {cur.wasted}品 ・ 使い切った {cur.used}品
              {cur.used + cur.wasted > 0 && <> ・ 使い切り率 <b>{Math.round(cur.rate * 100)}%</b></>}
            </p>
          </section>

          <section className="card">
            <h2>月ごとのムダ金額</h2>
            <div className="vchart">
              <div className="vaxis">{[...ticks].reverse().map((v) => <span key={v}>{v.toLocaleString('ja-JP')}</span>)}</div>
              <div className="vplot">
                {ticks.map((v) => <i key={v} className="vgrid" style={{ bottom: `${(v / top) * 100}%` }} />)}
                {stats.map((s, i) => (
                  <button key={s.month} className={'vcol' + (i === sel ? ' on' : '')} onClick={() => setSel(i)} aria-label={`${Number(s.month.slice(5))}月 ${yen(s.wastedYen)}`}>
                    <span className="vval">{s.wastedYen ? s.wastedYen.toLocaleString('ja-JP') : '0'}</span>
                    <span className="vbar" style={{ height: `${(s.wastedYen / top) * 100}%` }} />
                    <span className="vm">{Number(s.month.slice(5))}月</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><h2>よく捨てる食材</h2><span className="muted small">3か月</span></div>
            {worst.length === 0 ? <p className="muted">まだありません。捨てた記録がつくと、買う量を見直す食材がわかります。</p> : (
              <ol className="worst">
                {worst.map((w, i) => (
                  <li key={w.name}>
                    {i < 3 ? <img src={`./img/rank${i + 1}.png`} alt={`${i + 1}位`} className="rank" /> : <span className="rank num">{i + 1}</span>}
                    <FoodPic name={w.name} cat={catOfName(w.name)} size={44} />
                    <span className="worst-main">
                      <b>{w.name}</b>
                      <span className="muted small">{w.times}回 ・ {yenMark(w.yen)}</span>
                      <span className="worst-bar"><i style={{ width: `${(w.yen / worstMax) * 100}%` }} /></span>
                    </span>
                  </li>
                ))}
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
        </>
      )}

      {tab === 'food' && (
        <section className="card">
          <div className="card-head"><h2>捨てた食材(これまで)</h2><span className="muted small">捨てた回数の多い順</span></div>
          {byFood.length === 0 ? <p className="muted">まだありません。</p> : (
            <ol className="worst">
              {byFood.map((w, i) => (
                <li key={w.name}>
                  {i < 3 ? <img src={`./img/rank${i + 1}.png`} alt={`${i + 1}位`} className="rank" /> : <span className="rank num">{i + 1}</span>}
                  <FoodPic name={w.name} cat={catOfName(w.name)} size={44} />
                  <span className="worst-main">
                    <b>{w.name}</b>
                    <span className="muted small">{w.times}回 ・ {yenMark(w.yen)}</span>
                    <span className="worst-bar"><i style={{ width: `${(w.yen / byFoodMax) * 100}%` }} /></span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      <p className="muted small">金額は登録した値段からの計算です。食材の値段は「その他 → 食材の目安と値段」で変えられます。</p>
    </div>
  );
}
