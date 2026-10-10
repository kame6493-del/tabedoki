/**
 * App Review 用の画面録画で流す自動操作。VITE_REVIEW_TOUR=1 で作ったビルドだけで動く(製品版には入らない)。
 * 持ち主が iPhone を持っていないので、CI のシミュレーターでこれを流しながら録画する(.github/workflows/ios-review-video.yml)。
 * 起動 → ワンタップ登録 → 日付を直す → まとめて入れる → 捨てた → 記録 → 買い物メモ → 設定 → 完全版の購入画面。押した所に丸を出す。
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tapMark(el: Element) {
  const r = el.getBoundingClientRect();
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    position: 'fixed', left: `${r.left + r.width / 2 - 22}px`, top: `${r.top + r.height / 2 - 22}px`,
    width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(210,64,42,0.35)',
    border: '2px solid rgba(210,64,42,0.8)', zIndex: '99999', pointerEvents: 'none', transition: 'opacity .6s, transform .6s',
  });
  document.body.appendChild(dot);
  requestAnimationFrame(() => { dot.style.transform = 'scale(1.4)'; dot.style.opacity = '0'; });
  setTimeout(() => dot.remove(), 700);
}

const norm = (s: string) => s.replace(/\s+/g, '');

/** selector に合い、見えていて押せる要素(has を渡すとその文字を含むものだけ) */
async function find(selector: string, has = '', wait = 6000): Promise<HTMLElement | null> {
  const end = Date.now() + wait;
  while (Date.now() < end) {
    const el = [...document.querySelectorAll<HTMLElement>(selector)].find(
      (b) => b.getClientRects().length > 0 && !(b as HTMLButtonElement).disabled && norm(b.innerText).includes(norm(has)),
    );
    if (el) return el;
    await sleep(200);
  }
  return null;
}

async function tap(selector: string, has = '', pause = 1800, wait = 6000) {
  const el = await find(selector, has, wait);
  if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  await sleep(500);
  tapMark(el);
  await sleep(250);
  el.click();
  await sleep(pause);
  return true;
}

async function scrollSlow(to: number, ms = 1600) {
  const from = window.scrollY;
  const steps = 30;
  for (let k = 1; k <= steps; k++) { window.scrollTo(0, from + ((to - from) * k) / steps); await sleep(ms / steps); }
}

/** お知らせ(下の帯)は押すと閉じる。重なって次の操作の邪魔をしないように閉じておく */
async function closeToast() {
  const t = document.querySelector<HTMLElement>('.toast-text');
  if (t) { t.click(); await sleep(600); }
}

export async function runReviewTour() {
  await sleep(3500); // はじめて開いた所(空の冷蔵庫・ワンタップの食材)を見せる
  // ワンタップ登録 → 期限を「明日」に直す
  await tap('.qchip', '牛乳', 2200);
  if (await tap('.toast button, .toast a', '日付を直す', 1800)) await tap('.qd', '明日', 1800);
  await closeToast();
  // まとめて入れる: 卵×2・豆腐・もやし・にんじん
  if (await tap('.home-add', '', 1800)) {
    for (const n of ['卵', '卵', '豆腐', 'もやし', 'にんじん']) await tap('.tile', n, 700, 2000);
    await sleep(1200);
    await tap('.tray-bar .btn.primary', '', 2500);
  }
  await closeToast();
  await sleep(1500);
  // 品を押して「捨てた」→ もったいない額 → 買い物メモへ
  if (await tap('.item', '牛乳', 2000)) {
    await tap('.btn.wasted', '', 2200);
    await tap('.toast button, .toast a', '買い物メモへ', 1500);
  }
  await closeToast();
  // ムダ管理(ムダ金額・使い切り率)
  await tap('.tab', '統計', 2500);
  await scrollSlow(document.body.scrollHeight, 2000); await sleep(1200); await scrollSlow(0, 1000);
  // 買い物メモ
  await tap('.tab', '買い物', 2800);
  // 設定 → 完全版の購入画面
  await tap('.tab', 'その他', 2000);
  await scrollSlow(500, 1600); await sleep(1000); await scrollSlow(0, 1000);
  await tap('.pro-card', '', 3500);
  await scrollSlow(document.body.scrollHeight, 2500);
  await sleep(2500);
  // 購入ボタン(シミュレーターでストアの商品が取れたときだけ押せる)
  await tap('.pw-cta .btn.primary', '', 1000, 10000);
  await sleep(6000);
}
