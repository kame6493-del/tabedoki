import { useRef, useState } from 'react';
import type { Ctx } from '../App';
import { makeShareFile, mergeShare, restoreBackup } from '../domain/logic';
import type { AppData, Item } from '../domain/types';
import { shareFile } from '../platform/native';
import { Icon } from './icons';
import { FoodPic, Sheet, TopBar } from './parts';

interface Preview { file: string; from: string; at: string; raw: unknown; added: Item[]; removed: Item[]; updated: number; shop: number }

/**
 * 見本の「冷蔵庫を共有」「共有ファイルの取り込み」。
 * サーバーもアカウントも使わない。共有ファイル(JSON)を OS の共有シートで送り、受け取った人が読み込むと合わさる。
 * 見本の「LINEで送る」「メールで送る」は、OS の共有シート(LINE・メールなどを選べる)1つにまとめた。
 */
export function SharePage({ ctx }: { ctx: Ctx }) {
  const { data } = ctx;
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const stamp = ctx.today.replace(/-/g, '');
  const set = (deviceName: string) => ctx.setData((d) => ({ ...d, settings: { ...d.settings, deviceName } }));

  const read = async (f: File) => {
    try {
      const raw = JSON.parse(await f.text());
      if (raw?.kind === 'backup') return restoreFromFile(ctx, raw);
      const r = mergeShare(data, raw);
      const before = new Set(data.items.map((i) => i.id));
      const after = new Set(r.data.items.map((i) => i.id));
      const shopBefore = new Set(data.shop.map((s) => s.id));
      setPreview({
        file: f.name, from: typeof raw.from === 'string' ? raw.from : '', at: typeof raw.exportedAt === 'string' ? raw.exportedAt : '', raw,
        added: r.data.items.filter((i) => !before.has(i.id)), removed: data.items.filter((i) => !after.has(i.id)), updated: r.updated,
        shop: r.data.shop.filter((s) => !shopBefore.has(s.id)).length,
      });
    } catch (e) {
      ctx.toast({ text: `読み込めませんでした(${(e as Error).message})` });
    }
  };

  const apply = () => {
    if (!preview) return;
    const r = mergeShare(data, preview.raw); // 確かめている間に変わっていても、いまの中身に合わせ直す
    ctx.setData(() => r.data);
    setPreview(null);
    ctx.toast({ text: `取り込みました: 新しく${r.added}品・更新${r.updated}品・消えた品${r.removed}品` });
  };

  const catOf = (id: string) => data.cats.find((c) => c.id === id);
  const at = preview?.at ? new Date(preview.at) : null;

  return (
    <div className="page share">
      <TopBar title="冷蔵庫を共有" />
      <img src="./img/share_family.png" alt="" className="share-art" />
      <h2 className="share-lead">冷蔵庫の中身を<br />共有ファイルで送れます</h2>
      <p className="muted center small">LINE やメールでファイルを送るだけ。<br />受け取った人がタベドキで読み込むと、冷蔵庫の中身と買い物メモが合わさります。</p>

      <label className="field block">この端末の名前(相手に表示されます)
        <input value={data.settings.deviceName} onChange={(e) => set(e.target.value)} placeholder="例: ママのスマホ" />
      </label>

      <button className="btn primary wide big share-send" onClick={() => shareFile(`タベドキ共有_${stamp}.json`, JSON.stringify(makeShareFile(data)), 'application/json')}>
        <Icon name="send" size={22} />共有ファイルを送る
      </button>
      <p className="muted small center">送り先(LINE・メールなど)を選ぶ画面が開きます。</p>
      <button className="btn wide big share-recv" onClick={() => fileRef.current?.click()}>
        <Icon name="receive" size={22} />受け取ったファイルを読み込む
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ''; }} data-testid="file-in" />

      <section className="info-card">
        <span className="info-ic"><Icon name="file" size={24} /></span>
        <div>
          <b>アカウント登録なしで使えます</b>
          <p className="muted small">記録はサーバーに送りません。同じ食材は新しく直した方が残り、どちらかで使い切った・消した食材は消えます。</p>
        </div>
      </section>

      {preview && (
        <Sheet title="共有ファイルの取り込み" onClose={() => setPreview(null)} className="merge-sheet">
          <div className="mf-file">
            <span className="mf-ic"><Icon name="file" size={28} /></span>
            <div>
              <b>{preview.file}</b>
              <span className="muted small">{preview.from ? `${preview.from}からの共有ファイル` : '共有ファイル'}{at && !Number.isNaN(at.getTime()) ? `(${at.getMonth() + 1}/${at.getDate()} ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')} に作成)` : ''}</span>
            </div>
          </div>
          <h3 className="mf-lead">家族の冷蔵庫と合わせます</h3>
          <p className="muted small">共有ファイルの食材を、いまの冷蔵庫に合わせます。同じ食材は新しく直した方が残ります。</p>
          <div className="mf-box">
            <p className="mf-title">合わせた後の変化</p>
            <div className="mf-sum">
              <span><b>{preview.added.length}品</b>新しく入る</span>
              <span><b>{preview.updated}品</b>更新</span>
              <span><b>{preview.removed.length}品</b>消える</span>
            </div>
            {preview.added.length > 0 && (
              <ul className="mf-list">
                {preview.added.slice(0, 6).map((i) => <li key={i.id}><FoodPic name={i.name} cat={catOf(i.cat)} size={36} /><span>{i.name}</span><i className="mf-tag add">新しく</i></li>)}
              </ul>
            )}
            {preview.removed.length > 0 && (
              <ul className="mf-list">
                {preview.removed.slice(0, 6).map((i) => <li key={i.id}><FoodPic name={i.name} cat={catOf(i.cat)} size={36} /><span>{i.name}</span><i className="mf-tag del">消える</i></li>)}
              </ul>
            )}
            {preview.shop > 0 && <p className="muted small">買い物メモにも {preview.shop}件 入ります。</p>}
          </div>
          <button className="btn primary wide big" onClick={apply}>この内容で合わせる</button>
          <button className="btn wide" onClick={() => setPreview(null)}>キャンセル</button>
        </Sheet>
      )}
    </div>
  );
}

/** バックアップのファイルを選んだとき(共有の読み込みから選んでも、設定の「戻す」から選んでも同じ) */
export function restoreFromFile(ctx: Ctx, raw: unknown) {
  if (!confirm('このバックアップで今の記録を置き換えます。よろしいですか?')) return;
  const d: AppData = restoreBackup(raw);
  ctx.setData(() => d);
  ctx.toast({ text: `バックアップから戻しました(${d.items.length}品)` });
}
