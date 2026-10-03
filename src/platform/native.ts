import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import type { PlannedNotice } from '../domain/logic';

const native = Capacitor.isNativePlatform();

export function tap() {
  if (!native) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/** 期限のお知らせを全部入れ直す。許可されなかったら false */
export async function syncNotices(list: PlannedNotice[], ask: boolean): Promise<boolean> {
  if (!native) return true;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (!list.length) return true;
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted' && ask) perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return false;
    await LocalNotifications.schedule({
      notifications: list.map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true } })),
    });
    return true;
  } catch (e) {
    console.error('[tabedoki] notices', e);
    return false;
  }
}

/**
 * ファイルを渡す。スマホでは共有シート(LINE・メール・AirDrop など)を出し、ブラウザでは保存する。
 * 戻り値 false = 利用者が閉じた
 */
export async function shareFile(name: string, text: string, mime: string): Promise<boolean> {
  if (native) {
    const r = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: name, files: [r.uri], dialogTitle: name });
      return true;
    } catch (e) {
      if (String((e as Error)?.message ?? e).toLowerCase().includes('cancel')) return false;
      throw e;
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
