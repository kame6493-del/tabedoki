import { useState } from 'react';
import { APP, BILLING } from '../domain/config';
import { purchase, restore, type BillingState } from '../platform/billing';
import { Icon } from './icons';
import { TopBar } from './parts';

/** 見本の「完全版にアップグレード」。商品・値段・中身は 1.0 と同じ(買い切り tabedoki_full) */
export function Paywall(p: { billing: BillingState; onClose: () => void; onBought: () => void; setBilling: (b: BillingState) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const price = p.billing.status === 'ready' ? p.billing.price ?? BILLING.displayPrice : BILLING.displayPrice;

  const buy = async () => {
    setBusy(true); setMsg('');
    try {
      if (await purchase(p.billing)) p.onBought();
    } catch (e) {
      setMsg(`購入できませんでした(${(e as Error).message ?? e})`);
    } finally { setBusy(false); }
  };
  const doRestore = async () => {
    setBusy(true); setMsg('');
    try {
      if (await restore()) p.onBought();
      else setMsg('このアカウントでの購入は見つかりませんでした');
    } catch (e) {
      setMsg(`復元できませんでした(${(e as Error).message ?? e})`);
    } finally { setBusy(false); }
  };

  const rows: [string, string, string, string?][] = [
    ['登録できる食材数', `${APP.freeItemLimit}品まで`, '上限なし', 'たくさん登録できます'],
    ['お知らせの日と時刻', '前日の8時', '当日〜1週間前を', 'いくつでも・好きな時刻に'],
    ['分類・置き場所の追加', '標準のみ', '自由に追加して', 'カスタマイズ'],
    ['テーマ', '1種類(フレッシュ)', '4種類から選べる'],
    ['CSV書き出し', '利用不可', '食材データ・記録を', 'CSVで書き出し'],
  ];

  return (
    <div className="page paywall">
      <TopBar title="完全版にアップグレード" onBack={p.onClose} backLabel="閉じる" />
      <section className="pw-hero">
        <img src="./img/crown.png" alt="" className="pw-crown" />
        <p className="pw-lead">タベドキをもっと便利に、<br />ずっと快適に使えます。</p>
      </section>
      <div className="pw-cmp">
        <div className="pw-col free">
          <p className="pw-colhead">無料版</p>
          {rows.map(([k, f]) => <div key={k} className="pw-cell"><small>{k}</small><b>{f}</b></div>)}
        </div>
        <div className="pw-col full">
          <p className="pw-colhead"><img src="./img/crown.png" alt="" />完全版</p>
          {rows.map(([k, , a, b]) => <div key={k} className="pw-cell"><i className="ok"><Icon name="check" size={14} stroke={3.2} /></i><b>{a}</b>{b && <span>{b}</span>}</div>)}
        </div>
      </div>
      <p className="pw-free muted small">無料のままでも、ワンタップ登録・期限の近い順・前日のお知らせ・ムダ管理・家族と共有・バックアップはずっと使えます。広告はありません。</p>
      <div className="pw-cta">
        <p className="pw-once">買い切り</p>
        <p className="pw-price">{price}</p>
        {p.billing.status === 'ready' ? (
          <button className="btn primary wide big" disabled={busy} onClick={buy}>{busy ? '処理中…' : `${price}で完全版にする`}</button>
        ) : (
          <button className="btn wide big" disabled>{p.billing.reason}</button>
        )}
        <p className="muted small center">一度のご購入で、ずっとご利用いただけます。<br />追加の月額料金はかかりません。</p>
        <button className="link" disabled={busy} onClick={doRestore}>以前に買った方はこちら(購入の復元)</button>
        {msg && <p className="err">{msg}</p>}
      </div>
      <p className="muted small">同じストアのアカウントなら、機種変更の後も「購入の復元」で使えます。記録はこの端末の中だけに保存し、外へ送りません。</p>
    </div>
  );
}
