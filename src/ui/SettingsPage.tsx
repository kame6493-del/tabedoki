import { useRef, useState, type ReactNode } from 'react';
import type { Ctx } from '../App';
import { BILLING } from '../domain/config';
import { itemsCsv, logCsv, makeBackup, makeShareFile, mergeShare, newId, restoreBackup } from '../domain/logic';
import type { Settings } from '../domain/types';
import { MOCK_BILLING, resetMock, type BillingState } from '../platform/billing';
import { shareFile } from '../platform/native';
import { clearData } from '../platform/storage';
import { Sheet, TopBar } from './parts';

const BEFORE = [
  { d: 0, label: '当日' }, { d: 1, label: '前日' }, { d: 2, label: '2日前' }, { d: 3, label: '3日前' }, { d: 5, label: '5日前' }, { d: 7, label: '1週間前' },
];
export const THEMES = [
  { id: 'kitchen', name: 'キッチン' },
  { id: 'mint', name: 'ミント' },
  { id: 'sakura', name: 'さくら' },
  { id: 'night', name: '夜(暗い)' },
];
const COLORS = ['#4f9a52', '#e07a2f', '#c8463d', '#3a7bbf', '#c9a227', '#7a5aa6', '#2f9a96', '#b0623b', '#d0679a', '#5f6b7a'];

export function SettingsPage({ ctx, billing }: { ctx: Ctx; billing: BillingState }) {
  const { data, premium } = ctx;
  const s = ctx.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [addKind, setAddKind] = useState<'cat' | 'place' | null>(null);
  const set = (patch: Partial<Settings>) => ctx.setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const needPro = (run: () => void) => (premium ? run() : ctx.go('paywall'));
  const stamp = ctx.today.replace(/-/g, '');

  const readFile = async (f: File) => {
    try {
      const raw = JSON.parse(await f.text());
      if (raw?.kind === 'backup') {
        if (!confirm('このバックアップで今の記録を置き換えます。よろしいですか?')) return;
        const d = restoreBackup(raw);
        ctx.setData(() => d);
        ctx.toast({ text: `バックアップから戻しました(${d.items.length}品)` });
      } else {
        const r = mergeShare(ctx.data, raw);
        ctx.setData(() => r.data);
        ctx.toast({ text: `取り込みました: 新しく${r.added}品・更新${r.updated}品・消えた品${r.removed}品` });
      }
    } catch (e) {
      ctx.toast({ text: `読み込めませんでした(${(e as Error).message})` });
    }
  };

  return (
    <div className="page settings">
      <TopBar title="設定" />

      {premium ? (
        <section className="pro-card on"><b>完全版をお使いです</b><span className="muted small">ありがとうございます。すべての機能が使えます。</span></section>
      ) : (
        <button className="pro-card" onClick={() => ctx.go('paywall')}>
          <b>完全版 {billing.status === 'ready' && billing.price ? billing.price : BILLING.displayPrice}(買い切り)</b>
          <span>入れておける数の上限なし・通知の日と時刻・分類と置き場所の追加・テーマ・CSV書き出し</span>
        </button>
      )}

      <Group title="期限のお知らせ">
        <Row label="お知らせを出す"><Toggle on={s.notify} onChange={(v) => set({ notify: v })} label="お知らせ" /></Row>
        <Row label="いつ知らせる" pro={!premium}>
          <div className="chips-sel">
            {BEFORE.map((b) => {
              const on = s.notifyDaysBefore.includes(b.d);
              return <button key={b.d} className={'cat' + (on ? ' on' : '')} onClick={() => needPro(() => set({ notifyDaysBefore: on ? s.notifyDaysBefore.filter((x) => x !== b.d) : [...s.notifyDaysBefore, b.d].sort((x, y) => x - y) }))}>{b.label}</button>;
            })}
          </div>
        </Row>
        <Row label="時刻" pro={!premium}>
          {premium ? <input type="time" value={s.notifyTime} onChange={(e) => e.target.value && set({ notifyTime: e.target.value })} className="time" />
            : <button className="btn small" onClick={() => ctx.go('paywall')}>{s.notifyTime}</button>}
        </Row>
        <p className="muted small">同じ朝に期限の来る品は1通にまとめます。使い切った品のお知らせは出ません。</p>
      </Group>

      <Group title="見た目">
        <Row label="文字の大きさ">
          <div className="seg">
            {[{ v: 1, l: '標準' }, { v: 1.12, l: '大' }, { v: 1.25, l: '特大' }].map((f) => <button key={f.v} className={s.fontScale === f.v ? 'on' : ''} onClick={() => set({ fontScale: f.v })}>{f.l}</button>)}
          </div>
        </Row>
        <Row label="テーマ" pro={!premium}>
          <div className="chips-sel">
            {THEMES.map((t) => <button key={t.id} className={'cat theme-' + t.id + (s.theme === t.id ? ' on' : '')} onClick={() => needPro(() => set({ theme: t.id }))}>{t.name}</button>)}
          </div>
        </Row>
      </Group>

      <Group title="食材・分類・置き場所">
        <button className="row-btn" onClick={() => ctx.go('presets')}>食材の目安と値段<span>›</span></button>
        <Row label="分類" pro={!premium}>
          <span className="muted small">{data.cats.length}個</span>
          <button className="btn small" onClick={() => needPro(() => setAddKind('cat'))}>足す</button>
        </Row>
        <Row label="置き場所" pro={!premium}>
          <span className="muted small">{data.places.map((p) => p.name).join('・')}</span>
          <button className="btn small" onClick={() => needPro(() => setAddKind('place'))}>足す</button>
        </Row>
      </Group>

      <Group title="家族と共有(ファイルで渡す)">
        <p className="muted small">サーバーは使いません。共有ファイルを LINE やメール、AirDrop で家族に送り、受け取った人が「受け取る」で読み込むと、冷蔵庫の中身と買い物メモが合わさります(新しい方が残ります)。</p>
        <label className="field block">この端末の名前<input value={data.settings.deviceName} onChange={(e) => set({ deviceName: e.target.value })} placeholder="例: ママのスマホ" /></label>
        <div className="row-acts">
          <button className="btn" onClick={() => shareFile(`タベドキ共有_${stamp}.json`, JSON.stringify(makeShareFile(data)), 'application/json')}>送る</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>受け取る</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ''; }} data-testid="file-in" />
      </Group>

      <Group title="バックアップ(機種変更・もしもの時)">
        <div className="row-acts">
          <button className="btn" onClick={() => shareFile(`タベドキ控え_${stamp}.json`, JSON.stringify(makeBackup(data)), 'application/json')}>保存する</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>戻す</button>
        </div>
        <p className="muted small">記録はこの端末の中だけにあります。機種変更の前に保存してください。</p>
      </Group>

      <Group title="書き出し(表計算ソフト用)">
        <div className="row-acts">
          <button className="btn" onClick={() => needPro(() => void shareFile(`タベドキ_冷蔵庫_${stamp}.csv`, itemsCsv(data, ctx.today), 'text/csv'))}>中身をCSV{!premium && <i className="pro-mark">完全版</i>}</button>
          <button className="btn" onClick={() => needPro(() => void shareFile(`タベドキ_記録_${stamp}.csv`, logCsv(data), 'text/csv'))}>記録をCSV{!premium && <i className="pro-mark">完全版</i>}</button>
        </div>
      </Group>

      <Group title="このアプリについて">
        <button className="row-btn" onClick={() => ctx.go('presets')}>期限の目安の考え方と出典<span>›</span></button>
        <p className="muted small">タベドキはアカウントを作らず、記録を外へ送りません。広告もありません。</p>
        <p className="muted small">バージョン 1.0.0</p>
      </Group>

      {MOCK_BILLING && (
        <Group title="開発用(製品版には出ません)">
          <div className="row-acts">
            <button className="btn small" onClick={() => { resetMock(); location.reload(); }}>完全版を外す</button>
            <button className="btn small danger" onClick={async () => { await clearData(); location.reload(); }}>記録を全部消す</button>
          </div>
        </Group>
      )}

      {addKind && (
        <AddCatSheet kind={addKind} onClose={() => setAddKind(null)} onAdd={(name, color) => {
          ctx.setData((d) => addKind === 'cat'
            ? { ...d, cats: [...d.cats.filter((c) => c.id !== 'other'), { id: newId('c'), name, color }, ...d.cats.filter((c) => c.id === 'other')] }
            : { ...d, places: [...d.places, { id: newId('pl'), name }] });
          setAddKind(null);
          ctx.toast({ text: `「${name}」を足しました` });
        }} />
      )}
    </div>
  );
}

function AddCatSheet(p: { kind: 'cat' | 'place'; onClose: () => void; onAdd: (name: string, color: string) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  return (
    <Sheet title={p.kind === 'cat' ? '分類を足す' : '置き場所を足す'} onClose={p.onClose}>
      <label className="field block">名前<input value={name} onChange={(e) => setName(e.target.value)} placeholder={p.kind === 'cat' ? '例: お菓子' : '例: 2台目の冷凍庫'} autoFocus /></label>
      {p.kind === 'cat' && (
        <div className="colors">{COLORS.map((c) => <button key={c} className={'color' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}</div>
      )}
      <button className="btn primary wide big" disabled={!name.trim()} onClick={() => p.onAdd(name.trim(), color)}>足す</button>
    </Sheet>
  );
}

function Group(p: { title: string; children: ReactNode }) {
  return <section className="group"><h2>{p.title}</h2>{p.children}</section>;
}

function Row(p: { label: string; children: ReactNode; pro?: boolean }) {
  return <div className="row"><span className="row-label">{p.label}{p.pro && <i className="pro-mark">完全版</i>}</span><span className="row-ctl">{p.children}</span></div>;
}

function Toggle(p: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={p.on} aria-label={p.label} className={'toggle' + (p.on ? ' on' : '')} onClick={() => p.onChange(!p.on)}><i /></button>;
}
