import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { APP } from './domain/config';
import { today as todayOf } from './domain/dates';
import { commitTray, planNotices, type Draft } from './domain/logic';
import type { AppData, Item, Settings } from './domain/types';
import { loadBilling, type BillingState } from './platform/billing';
import { syncNotices } from './platform/native';
import { loadData, saveData } from './platform/storage';
import { AddPage } from './ui/AddPage';
import { Home } from './ui/Home';
import { LogPage } from './ui/LogPage';
import { Paywall } from './ui/Paywall';
import { PresetsPage } from './ui/PresetsPage';
import { SettingsPage } from './ui/SettingsPage';
import { ShopPage } from './ui/ShopPage';
import { Toast, type ToastMsg } from './ui/parts';

export type Page = 'home' | 'add' | 'shop' | 'log' | 'settings' | 'paywall' | 'presets';

export interface Ctx {
  data: AppData;
  setData: (f: (d: AppData) => AppData) => void;
  premium: boolean;
  today: string;
  go: (p: Page) => void;
  toast: (t: ToastMsg) => void;
  /** 下書きを冷蔵庫に入れる。入りきらなければ完全版へ案内 */
  commit: (tray: Draft[]) => Item[];
  settings: Settings; // 無料のときは無料の範囲に丸めた設定
}

/** 無料で使える範囲に丸める(買ったあとに外すと元の設定に戻る) */
export function effectiveSettings(s: Settings, premium: boolean): Settings {
  if (premium) return s;
  return { ...s, notifyDaysBefore: [...APP.freeNotifyDays], notifyTime: APP.freeNotifyTime, theme: 'kitchen' };
}

export default function App() {
  const [data, setDataRaw] = useState<AppData | null>(null);
  const [billing, setBilling] = useState<BillingState>({ status: 'unavailable', reason: '確認中…' });
  const [page, setPage] = useState<Page>('home');
  const [back, setBack] = useState<Page>('home');
  const [tray, setTray] = useState<Draft[]>([]);
  const [toastMsg, setToastMsg] = useState<ToastMsg | null>(null);
  const [day, setDay] = useState(todayOf());
  const [error, setError] = useState('');
  const asked = useRef(false);

  useEffect(() => {
    loadData().then(setDataRaw).catch((e) => setError(String(e)));
    loadBilling().then(setBilling);
    const onVis = () => { if (!document.hidden) setDay(todayOf()); };
    document.addEventListener('visibilitychange', onVis);
    const sub = CapApp.addListener('appStateChange', (s) => { if (s.isActive) setDay(todayOf()); }).catch(() => null);
    return () => { document.removeEventListener('visibilitychange', onVis); sub.then((h) => h?.remove()); };
  }, []);

  const premium = billing.status === 'ready' && billing.premium;
  const settings = useMemo(() => (data ? effectiveSettings(data.settings, premium) : null), [data, premium]);

  // 保存と通知の入れ直し(書き込みは storage 側で順番に流れる)
  useEffect(() => { if (data) void saveData(data); }, [data]);
  const noticeKey = data && settings ? JSON.stringify([data.items.map((i) => [i.name, i.expiry]), settings.notify, settings.notifyTime, settings.notifyDaysBefore]) : '';
  useEffect(() => {
    if (!data || !settings) return;
    const t = setTimeout(() => {
      const ask = data.items.length > 0 && !asked.current;
      if (ask) asked.current = true;
      void syncNotices(planNotices(data.items, settings), ask);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeKey]);

  const setData = useCallback((f: (d: AppData) => AppData) => setDataRaw((d) => (d ? f(d) : d)), []);
  const toast = useCallback((t: ToastMsg) => setToastMsg({ ...t, key: Date.now() }), []);
  const go = useCallback((p: Page) => {
    setPage((cur) => {
      if (p === 'paywall' || p === 'presets') setBack(cur);
      return p;
    });
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const theme = settings?.theme ?? 'kitchen';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('--fs', String(settings?.fontScale ?? 1));
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#f6f2ea');
  }, [settings?.theme, settings?.fontScale]);

  if (error) return <div className="fatal">記録を読み込めませんでした。アプリを開き直してください。<br />({error})</div>;
  if (!data || !settings) return <div className="splash">タベドキ</div>;

  const commit = (t: Draft[]) => {
    const r = commitTray(data, t, premium);
    setDataRaw(r.data);
    if (r.rejected) {
      toast({ text: `無料版で入れておけるのは${APP.freeItemLimit}品までです。${r.rejected}品はカゴに残しました`, action: { label: '完全版を見る', run: () => go('paywall') } });
    }
    return r.added;
  };

  const ctx: Ctx = { data, setData, premium, today: day, go, toast, commit, settings };

  return (
    <div className="app">
      {page === 'home' && <Home ctx={ctx} openAdd={(t) => { setTray(t); go('add'); }} />}
      {page === 'add' && <AddPage ctx={ctx} tray={tray} setTray={setTray} />}
      {page === 'shop' && <ShopPage ctx={ctx} openAdd={(t) => { setTray(t); go('add'); }} />}
      {page === 'log' && <LogPage ctx={ctx} />}
      {page === 'settings' && <SettingsPage ctx={ctx} billing={billing} />}
      {page === 'presets' && <PresetsPage ctx={ctx} onClose={() => go(back)} />}
      {page === 'paywall' && (
        <Paywall
          billing={billing} setBilling={setBilling}
          onClose={() => go(back === 'paywall' ? 'home' : back)}
          onBought={() => { setBilling((b) => (b.status === 'ready' ? { ...b, premium: true } : { status: 'ready', premium: true, price: null })); toast({ text: '完全版になりました。ありがとうございます' }); go(back === 'paywall' ? 'home' : back); }}
        />
      )}
      {(page === 'home' || page === 'shop' || page === 'log' || page === 'settings') && <TabBar page={page} go={go} shopCount={data.shop.filter((s) => !s.done).length} />}
      <Toast msg={toastMsg} onDone={() => setToastMsg(null)} />
    </div>
  );
}

function TabBar(p: { page: Page; go: (p: Page) => void; shopCount: number }) {
  const tabs: { id: Page; label: string; icon: string }[] = [
    { id: 'home', label: '冷蔵庫', icon: 'M5 3h14v18H5zM5 10h14M8 6v2M8 13v3' },
    { id: 'shop', label: '買い物', icon: 'M4 6h16l-2 9H6zM6 15l-1 4h14M9 21a1 1 0 1 0 0-.01M17 21a1 1 0 1 0 0-.01' },
    { id: 'log', label: '記録', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
    { id: 'settings', label: '設定', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4' },
  ];
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <button key={t.id} className={'tab' + (p.page === t.id ? ' on' : '')} onClick={() => p.go(t.id)} aria-label={t.label}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
          <span>{t.label}</span>
          {t.id === 'shop' && p.shopCount > 0 && <i className="badge">{p.shopCount}</i>}
        </button>
      ))}
    </nav>
  );
}
