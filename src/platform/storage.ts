import { Preferences } from '@capacitor/preferences';
import type { AppData } from '../domain/types';
import { emptyData, normalize } from '../domain/logic';
import { APP } from '../domain/config';

const KEY = APP.storageKey;
const BACKUP_KEY = `${KEY}.prev`;

/**
 * 端末内に保存する。アカウントもサーバーも使わない。
 * Preferences はネイティブでは UserDefaults / SharedPreferences に書く(WebView の localStorage は OS に消されることがある)。
 */
export async function loadData(): Promise<AppData> {
  const { value } = await Preferences.get({ key: KEY });
  if (!value) return emptyData();
  try {
    return normalize(JSON.parse(value));
  } catch {
    const prev = await Preferences.get({ key: BACKUP_KEY });
    try {
      return prev.value ? normalize(JSON.parse(prev.value)) : emptyData();
    } catch {
      return emptyData();
    }
  }
}

let chain: Promise<void> = Promise.resolve();

/** 書き込みは順番に1本ずつ。前回の保存を控えに残してから上書きする */
export function saveData(data: AppData): Promise<void> {
  const json = JSON.stringify(data);
  chain = chain.then(async () => {
    const cur = await Preferences.get({ key: KEY });
    if (cur.value) await Preferences.set({ key: BACKUP_KEY, value: cur.value });
    await Preferences.set({ key: KEY, value: json });
  }).catch((e) => console.error('[tabedoki] save failed', e));
  return chain;
}

export async function clearData(): Promise<void> {
  await Preferences.remove({ key: KEY });
  await Preferences.remove({ key: BACKUP_KEY });
}
