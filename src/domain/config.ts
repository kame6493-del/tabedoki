/**
 * 課金とアプリの決まりごとを1か所にまとめる。
 * RevenueCat の公開APIキーはまだ無いので空。空のあいだ購入ボタンは「購入は準備中です」になり、課金は走らない。
 */
export const BILLING = {
  revenuecat: { ios: 'appl_KMMXwCWIuiyKzMlkYkwBrqvlyvS', android: 'goog_uxIXkYLJCcNzwrszatYxbeEKHpF' },
  /** RevenueCat の entitlement 名 */
  entitlement: 'full',
  /** App Store / Google Play の商品ID(非消耗型・買い切り) */
  productId: 'tabedoki_full',
  /** 画面に出す目安の値段(ストアから値段が取れたらそちらを出す) */
  displayPrice: '¥500',
};

export const APP = {
  name: 'タベドキ',
  /** 画面に出す版(android/app/build.gradle の versionName と同じにする) */
  version: '1.1.0',
  /** 無料で同時に入れておける品の数 */
  freeItemLimit: 30,
  /** 無料で使える通知の設定(前日の朝8時) */
  freeNotifyDays: [1],
  freeNotifyTime: '08:00',
  storageKey: 'tabedoki.v1',
};
