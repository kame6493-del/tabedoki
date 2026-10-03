import { Capacitor } from '@capacitor/core';
import { Purchases, type PurchasesPackage } from '@revenuecat/purchases-capacitor';

import { BILLING } from '../domain/config';

/**
 * 課金は RevenueCat。商品は買い切り(非消耗型) BILLING.productId を1つ、entitlement は BILLING.entitlement。
 * 公開APIキーが空のあいだは「購入は準備中です」を出して、課金は一切走らない(落ちない)。
 */
export type BillingState =
  | { status: 'unavailable'; reason: string }
  | { status: 'ready'; premium: boolean; price: string | null; pkg?: PurchasesPackage };

const platform = Capacitor.getPlatform();
const key = platform === 'ios' ? BILLING.revenuecat.ios : platform === 'android' ? BILLING.revenuecat.android : '';
/**
 * 画面確認用の疑似購入。ブラウザの開発ビルド(vite dev)と、E2E 用の書き出し(--mode e2e)だけ。
 * 製品ビルド(npm run build)では false に固定され、疑似購入のコードごと消える。
 */
export const MOCK_BILLING = (import.meta.env.DEV || import.meta.env.MODE === 'e2e') && !Capacitor.isNativePlatform();
const MOCK_KEY = 'tabedoki.mockFull';

let configured = false;
async function ensure() {
  if (configured) return;
  await Purchases.configure({ apiKey: key });
  configured = true;
}

export async function loadBilling(): Promise<BillingState> {
  if (MOCK_BILLING) return { status: 'ready', premium: localStorage.getItem(MOCK_KEY) === '1', price: BILLING.displayPrice };
  if (!key) return { status: 'unavailable', reason: '購入は準備中です' };
  try {
    await ensure();
    const [{ customerInfo }, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
    const pkg = offerings.current?.availablePackages.find((p) => p.product.identifier === BILLING.productId) ?? offerings.current?.availablePackages[0];
    return { status: 'ready', premium: BILLING.entitlement in customerInfo.entitlements.active, price: pkg?.product.priceString ?? null, pkg };
  } catch (e) {
    console.error('[tabedoki] billing', e);
    return { status: 'unavailable', reason: 'ストアに接続できませんでした' };
  }
}

/** true=有効になった / false=キャンセル。失敗は例外 */
export async function purchase(state: BillingState): Promise<boolean> {
  if (MOCK_BILLING) {
    localStorage.setItem(MOCK_KEY, '1');
    return true;
  }
  if (state.status !== 'ready' || !state.pkg) throw new Error('この商品は購入できません');
  await ensure();
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: state.pkg });
    return BILLING.entitlement in customerInfo.entitlements.active;
  } catch (e) {
    if ((e as { userCancelled?: boolean })?.userCancelled) return false;
    throw e;
  }
}

export async function restore(): Promise<boolean> {
  if (MOCK_BILLING) return localStorage.getItem(MOCK_KEY) === '1';
  if (!key) return false;
  await ensure();
  const { customerInfo } = await Purchases.restorePurchases();
  return BILLING.entitlement in customerInfo.entitlements.active;
}

/** 開発用: 疑似購入を取り消す(製品ビルドでは何もしない) */
export function resetMock() {
  if (MOCK_BILLING) localStorage.removeItem(MOCK_KEY);
}
