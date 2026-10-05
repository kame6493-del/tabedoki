"""録画用の自動操作(src/dev/reviewTour.ts)が最後まで進むかを手元のブラウザで確かめる。
先に録画用ビルドを作る: VITE_REVIEW_TOUR=1 npx vite build --outDir <一時フォルダ>
python scripts/check_review_tour.py <一時フォルダ> [録画の置き場所]
→ 通った画面の見出しを秒ごとに出し、購入画面に着いた秒数を出す。録画(webm)は指定した場所に残す(リポジトリには入れない)"""
import os
import subprocess
import sys
import time
import socket
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.environ.get("TEMP", "/tmp"), "tabedoki_review_tour")
os.makedirs(OUT, exist_ok=True)

with socket.socket() as so:
    so.bind(("127.0.0.1", 0))
    PORT = so.getsockname()[1]
srv = subprocess.Popen([sys.executable, os.path.join(ROOT, "scripts", "serve.py"), DIST, str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
errors = []
reached = None
try:
    time.sleep(1.2)
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 393, "height": 852}, device_scale_factor=2, locale="ja-JP",
                            record_video_dir=OUT, record_video_size={"width": 393, "height": 852})
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.goto(f"http://127.0.0.1:{PORT}/")
        seen = []
        t0 = time.time()
        while time.time() - t0 < 140:
            txt = pg.evaluate("document.body.innerText.slice(0,70).replace(/\\s+/g,' ')")
            if not seen or seen[-1] != txt:
                seen.append(txt)
                print(round(time.time() - t0), txt)
            if reached is None and pg.locator(".paywall").count():
                reached = round(time.time() - t0)
            if reached is not None and time.time() - t0 > reached + 20:
                break
            time.sleep(1)
        names = pg.evaluate("[...document.querySelectorAll('.item .item-name')].map(e=>e.innerText)")
        path = pg.video.path()
        ctx.close()
        b.close()
        dst = os.path.join(OUT, "review_tour_check.webm")
        os.replace(path, dst)
finally:
    srv.terminate()
print("errors:", errors)
print("paywall reached at", reached, "s / video", dst)
sys.exit(0 if reached else 1)
