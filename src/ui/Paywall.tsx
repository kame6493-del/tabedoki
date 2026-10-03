import { useState } from 'react';
import { APP, BILLING } from '../domain/config';
import { purchase, restore, type BillingState } from '../platform/billing';
import { TopBar } from './parts';

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

  return (
    <div className="page paywall">
      <TopBar title="完全版" onClose={p.onClose} closeLabel="閉じる" />
      <section className="pw-hero">
        <p className="pw-kicker">買い切り・月額なし・広告なし</p>
        <h2>冷蔵庫を、まるごと<br />タベドキに。</h2>
        <p className="muted">無料のままでも、ワンタップ登録・期限の近い順・前日のお知らせ・もったいない額・家族との共有はずっと使えます。</p>
      </section>
      <table className="pw-table">
        <thead><tr><th></th><th>無料</th><th>完全版</th></tr></thead>
        <tbody>
          <tr><td>入れておける数</td><td>{APP.freeItemLimit}品まで</td><td>上限なし</td></tr>
          <tr><td>ワンタップ登録</td><td>○</td><td>○</td></tr>
          <tr><td>期限のお知らせ</td><td>前日8時</td><td>当日〜1週間前を<br />いくつでも・好きな時刻</td></tr>
          <tr><td>分類・置き場所</td><td>既定のみ</td><td>自由に足せる</td></tr>
          <tr><td>テーマ</td><td>キッチン</td><td>4種類</td></tr>
          <tr><td>CSVの書き出し</td><td>—</td><td>○</td></tr>
          <tr><td>家族と共有<br />バックアップ</td><td>○</td><td>○</td></tr>
          <tr><td>広告</td><td>なし</td><td>なし</td></tr>
        </tbody>
      </table>
      <div className="pw-cta">
        {p.billing.status === 'ready' ? (
          <button className="btn primary wide big" disabled={busy} onClick={buy}>{busy ? '処理中…' : `${price} で完全版にする(1回だけ)`}</button>
        ) : (
          <button className="btn wide big" disabled>{p.billing.reason}</button>
        )}
        <button className="link" disabled={busy} onClick={doRestore}>以前に買った方はこちら(購入の復元)</button>
        {msg && <p className="err">{msg}</p>}
      </div>
      <p className="muted small">一度買えば、同じストアのアカウントなら機種変更の後も「購入の復元」で使えます。記録はこの端末の中だけに保存し、外へ送りません。</p>
    </div>
  );
}
