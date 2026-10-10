import { useRef, useState, type ReactNode } from 'react';
import type { Ctx } from '../App';
import { APP, BILLING } from '../domain/config';
import { itemsCsv, logCsv, makeBackup, newId } from '../domain/logic';
import type { Settings } from '../domain/types';
import { MOCK_BILLING, resetMock, type BillingState } from '../platform/billing';
import { shareFile } from '../platform/native';
import { clearData } from '../platform/storage';
import { placeLook } from './foodArt';
import { Icon } from './icons';
import { CatDot, ListRow, Logo, Sheet, Toggle, TopBar } from './parts';
import { restoreFromFile } from './SharePage';

const BEFORE = [
  { d: 0, label: '当日' }, { d: 1, label: '前日' }, { d: 2, label: '2日前' }, { d: 3, label: '3日前' }, { d: 5, label: '5日前' }, { d: 7, label: '1週間前' },
];
/** テーマ(見本の「テーマ設定」)。id は保存データに入る。古い id は logic.normalizeTheme で読み替える */
export const THEMES = [
  { id: 'fresh', name: 'フレッシュ', sub: 'やさしくて見やすい定番のテーマ' },
  { id: 'cream', name: 'クリーム', sub: 'あたたかくやさしいナチュラルなテーマ' },
  { id: 'dark', name: 'ダーク', sub: '落ち着いたシックなテーマ' },
  { id: 'blue', name: 'キッチンブルー', sub: 'すっきり爽やかなクールなテーマ' },
];
const COLORS = ['#4f9a52', '#e07a2f', '#c8463d', '#3a7bbf', '#c9a227', '#7a5aa6', '#2f9a96', '#b0623b', '#d0679a', '#5f6b7a'];

const ic = (name: Parameters<typeof Icon>[0]['name'], tone: string) => <i className={'set-ic tone-' + tone}><Icon name={name} size={20} /></i>;

export function SettingsPage({ ctx, billing }: { ctx: Ctx; billing: BillingState }) {
  const { data, premium } = ctx;
  const s = ctx.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<'notify' | 'csv' | 'backup' | 'about' | null>(null);
  const set = (patch: Partial<Settings>) => ctx.setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const needPro = (run: () => void) => (premium ? run() : ctx.go('paywall'));
  const stamp = ctx.today.replace(/-/g, '');
  const themeName = THEMES.find((t) => t.id === s.theme)?.name ?? 'フレッシュ';
  const daysText = s.notifyDaysBefore.map((d) => BEFORE.find((b) => b.d === d)?.label ?? `${d}日前`).join('・') || 'なし';

  const readFile = async (f: File) => {
    try {
      const raw = JSON.parse(await f.text());
      if (raw?.kind !== 'backup') throw new Error('バックアップのファイルではありません。家族の共有ファイルは「共有」から読み込みます');
      restoreFromFile(ctx, raw);
    } catch (e) {
      ctx.toast({ text: `読み込めませんでした(${(e as Error).message})` });
    }
  };

  return (
    <div className="page settings">
      <div className="set-head"><Logo height={30} /></div>
      <TopBar title="設定" />

      {premium ? (
        <section className="pro-card on"><img src="./img/crown.png" alt="" /><div><b>完全版をお使いです</b><span className="small">ありがとうございます。すべての機能が使えます。</span></div></section>
      ) : (
        <button className="pro-card" onClick={() => ctx.go('paywall')}>
          <img src="./img/crown.png" alt="" />
          <div>
            <b>完全版 {billing.status === 'ready' && billing.price ? billing.price : BILLING.displayPrice}(買い切り)</b>
            <span className="small">入れておける数の上限なし・通知の日と時刻・分類と置き場所の追加・テーマ・CSV書き出し</span>
          </div>
          <Icon name="chevron" size={18} />
        </button>
      )}

      <Group title="お知らせの設定">
        <ListRow icon={ic('bell', 'red')} label="お知らせ" value={s.notify ? 'オン' : 'オフ'}>
          <Toggle on={s.notify} onChange={(v) => set({ notify: v })} label="お知らせ" />
        </ListRow>
        <ListRow icon={ic('clock', 'blue')} label="お知らせの日と時刻" value={`${daysText} ${s.notifyTime}`} pro={!premium} onClick={() => setSheet('notify')} />
      </Group>

      <Group title="カスタマイズ">
        <ListRow icon={ic('tag', 'green')} label="分類" sub={`食材の種類 ${data.cats.length}個`} pro={!premium} onClick={() => ctx.go('custom')} />
        <ListRow icon={ic('box', 'orange')} label="置き場所" sub={data.places.map((p) => p.name).join('・')} pro={!premium} onClick={() => ctx.go('custom')} />
        <ListRow icon={ic('palette', 'pink')} label="テーマ" sub="見た目をカスタマイズ" value={themeName} pro={!premium} onClick={() => ctx.go('custom')} />
        <ListRow icon={ic('text', 'gray')} label="文字の大きさ">
          <div className="seg">
            {[{ v: 1, l: '標準' }, { v: 1.12, l: '大' }, { v: 1.25, l: '特大' }].map((f) => <button key={f.v} className={s.fontScale === f.v ? 'on' : ''} onClick={() => set({ fontScale: f.v })}>{f.l}</button>)}
          </div>
        </ListRow>
        <ListRow icon={ic('list', 'green')} label="食材の目安と値段" sub="日数・値段・ワンタップに出すか" onClick={() => ctx.go('presets')} />
      </Group>

      <Group title="データ管理">
        <ListRow icon={ic('doc', 'blue')} label="CSV書き出し" sub="食材データ・記録を出力" pro={!premium} onClick={() => needPro(() => setSheet('csv'))} />
        <ListRow icon={ic('cloud', 'blue')} label="バックアップ" sub="機種変更時・もしもの時の控え" onClick={() => setSheet('backup')} />
        <ListRow icon={ic('share', 'green')} label="家族と共有" sub="共有ファイルを送る・読み込む" onClick={() => ctx.go('share')} />
      </Group>

      <Group title="その他">
        <ListRow icon={ic('info', 'blue')} label="このアプリについて" sub={`バージョン ${APP.version}`} onClick={() => setSheet('about')} />
      </Group>

      {MOCK_BILLING && (
        <Group title="開発用(製品版には出ません)">
          <div className="row-acts">
            <button className="btn small" onClick={() => { resetMock(); location.reload(); }}>完全版を外す</button>
            <button className="btn small danger" onClick={async () => { await clearData(); location.reload(); }}>記録を全部消す</button>
          </div>
        </Group>
      )}

      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ''; }} data-testid="backup-in" />

      {sheet === 'notify' && (
        <Sheet title="お知らせの日と時刻" onClose={() => setSheet(null)}>
          <p className="field-label">いつ知らせる{!premium && <i className="pro-mark">完全版</i>}</p>
          <div className="chips-sel">
            {BEFORE.map((b) => {
              const on = s.notifyDaysBefore.includes(b.d);
              return <button key={b.d} className={'cat' + (on ? ' on' : '')} onClick={() => needPro(() => set({ notifyDaysBefore: on ? s.notifyDaysBefore.filter((x) => x !== b.d) : [...s.notifyDaysBefore, b.d].sort((x, y) => x - y) }))}>{b.label}</button>;
            })}
          </div>
          <p className="field-label">時刻{!premium && <i className="pro-mark">完全版</i>}</p>
          {premium ? <input type="time" value={s.notifyTime} onChange={(e) => e.target.value && set({ notifyTime: e.target.value })} className="time" aria-label="時刻" />
            : <button className="btn" onClick={() => ctx.go('paywall')}>{s.notifyTime}</button>}
          <p className="muted small">同じ朝に期限の来る品は1通にまとめます。使い切った品のお知らせは出ません。{!premium && '無料版は前日の8時です。'}</p>
        </Sheet>
      )}
      {sheet === 'csv' && (
        <Sheet title="CSV書き出し" onClose={() => setSheet(null)}>
          <p className="muted small">表計算ソフトで開けるファイルにします。</p>
          <div className="row-acts col">
            <button className="btn big" onClick={() => void shareFile(`タベドキ_冷蔵庫_${stamp}.csv`, itemsCsv(data, ctx.today), 'text/csv')}><Icon name="doc" size={20} />冷蔵庫の中身をCSV</button>
            <button className="btn big" onClick={() => void shareFile(`タベドキ_記録_${stamp}.csv`, logCsv(data), 'text/csv')}><Icon name="doc" size={20} />使い切った・捨てた記録をCSV</button>
          </div>
        </Sheet>
      )}
      {sheet === 'backup' && (
        <Sheet title="バックアップ" onClose={() => setSheet(null)}>
          <p className="muted small">記録はこの端末の中だけにあります。機種変更の前に保存してください。</p>
          <div className="row-acts col">
            <button className="btn big" onClick={() => shareFile(`タベドキ控え_${stamp}.json`, JSON.stringify(makeBackup(data)), 'application/json')}><Icon name="send" size={20} />保存する</button>
            <button className="btn big" onClick={() => fileRef.current?.click()}><Icon name="receive" size={20} />戻す</button>
          </div>
        </Sheet>
      )}
      {sheet === 'about' && (
        <Sheet title="このアプリについて" onClose={() => setSheet(null)}>
          <div className="about-head"><img src="./icon.png" alt="" /><div><b>タベドキ</b><span className="muted small">バージョン {APP.version}</span></div></div>
          <p className="small">タベドキはアカウントを作らず、記録を外へ送りません。広告もありません。</p>
          <button className="list-row" onClick={() => { setSheet(null); ctx.go('presets'); }}><span className="lr-main"><span className="lr-label">期限の目安の考え方と出典</span></span><Icon name="chevron" size={18} className="lr-chev" /></button>
        </Sheet>
      )}
    </div>
  );
}

/** 見本の「テーマ設定」(テーマ・分類の編集・置き場所の編集)。どれも完全版 */
export function CustomPage({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { data, premium } = ctx;
  const s = ctx.settings;
  const [addKind, setAddKind] = useState<'cat' | 'place' | null>(null);
  const needPro = (run: () => void) => (premium ? run() : ctx.go('paywall'));
  return (
    <div className="page custom">
      <TopBar title="テーマ設定" onBack={onClose} />
      {!premium && <p className="hint green small-hint"><Icon name="info" size={18} /><span>テーマの切り替えと、分類・置き場所を足すのは完全版の機能です。無料版はフレッシュのテーマです。</span></p>}
      <div className="themes">
        {THEMES.map((t) => (
          <button key={t.id} className={'theme-card theme-' + t.id + (s.theme === t.id ? ' on' : '')} onClick={() => needPro(() => ctx.setData((d) => ({ ...d, settings: { ...d.settings, theme: t.id } })))} aria-pressed={s.theme === t.id}>
            <span className="tp">
              <b>タベドキ</b>
              <span className="tp-row"><i className="d1" /><i className="d2" /><i className="d3" /></span>
              <span className="tp-line"><i /><i /></span>
              <span className="tp-line"><i /><i /></span>
            </span>
            <span className="tc-name"><span className="radio" />{t.name}</span>
            <small>{t.sub}</small>
          </button>
        ))}
      </div>

      <section className="card">
        <div className="card-head"><h2>分類の編集</h2><button className="btn small soft" onClick={() => needPro(() => setAddKind('cat'))}><Icon name="plus" size={16} stroke={2.6} />追加</button></div>
        <div className="chip-grid">
          {data.cats.map((c) => <span key={c.id} className="chip"><CatDot color={c.color} />{c.name}</span>)}
        </div>
      </section>
      <section className="card">
        <div className="card-head"><h2>置き場所の編集</h2><button className="btn small soft" onClick={() => needPro(() => setAddKind('place'))}><Icon name="plus" size={16} stroke={2.6} />追加</button></div>
        <div className="chip-grid places-grid">
          {data.places.map((p) => { const l = placeLook(p.id); return <span key={p.id} className={'chip place tone-' + l.tone}><Icon name={l.icon} size={20} />{p.name}</span>; })}
        </div>
      </section>

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
  return <section className="group"><h2>{p.title}</h2><div className="group-body">{p.children}</div></section>;
}
