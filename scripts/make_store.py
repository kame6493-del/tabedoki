"""ストア用の素材を作る。python scripts/make_store.py(先に npm run build:e2e)
- store/icon_1024.png(App Store)・store/play/icon_512.png・store/play/feature_1024x500.png
- store/raw/*.png(見本データで撮った画面)→ store/shot_1〜5.png(1290x2796)・store/play/play_shot_1〜5.png(1080x1920)"""
import os
import socket
import subprocess
import sys
import time
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORE = os.path.join(ROOT, "store")
RAW = os.path.join(STORE, "raw")
PLAY = os.path.join(STORE, "play")
for d in (RAW, PLAY):
    os.makedirs(d, exist_ok=True)

BG = (246, 242, 234)
GREEN = (47, 125, 85)
INK = (38, 48, 43)
SUB = (92, 101, 95)
ORANGE = (232, 113, 42)
BOLD = "C:/Windows/Fonts/YuGothB.ttc"
W, H = 1290, 2796


def free_port():
    with socket.socket() as so:
        so.bind(("127.0.0.1", 0))
        return so.getsockname()[1]


def capture():
    port = free_port()
    srv = subprocess.Popen([sys.executable, os.path.join(ROOT, "scripts", "serve.py"), os.path.join(ROOT, "dist-e2e"), str(port)])
    url = f"http://127.0.0.1:{port}/"
    try:
        time.sleep(1.2)
        with sync_playwright() as p:
            b = p.chromium.launch()
            # アイコン
            pg = b.new_page(viewport={"width": 1024, "height": 1024})
            pg.goto(url + "icon.svg")
            pg.screenshot(path=os.path.join(STORE, "icon_1024.png"), clip={"x": 0, "y": 0, "width": 1024, "height": 1024})
            pg.close()

            ctx = b.new_context(viewport={"width": 430, "height": 932}, device_scale_factor=3, locale="ja-JP")
            pg = ctx.new_page()
            wait = lambda: pg.wait_for_timeout(400)
            # 1 ホーム(見本)
            pg.goto(url + "?demo=1&premium=1")
            pg.wait_for_selector(".item")
            wait()
            pg.screenshot(path=os.path.join(RAW, "1_home.png"))
            # 2 まとめて入れる(カゴに5品)
            pg.click(".fab")
            for n in ["牛乳", "卵", "卵", "豚こま肉", "キャベツ", "ヨーグルト"]:
                pg.locator(".tile", has_text=n).first.click()
            wait()
            pg.screenshot(path=os.path.join(RAW, "2_add.png"))
            # 3 日付の早押し
            pg.locator(".tray-row", has_text="豚こま肉").locator(".date-chip").click()
            pg.wait_for_selector(".date-sheet")
            wait()
            pg.screenshot(path=os.path.join(RAW, "3_date.png"))
            pg.click(".qd >> text=3日後")
            pg.click(".tray-bar .btn.primary")
            pg.wait_for_selector(".home")
            # 4 記録
            pg.wait_for_timeout(2800)
            pg.click(".tab >> text=記録")
            pg.wait_for_selector(".log-hero")
            wait()
            pg.screenshot(path=os.path.join(RAW, "4_log.png"))
            # 5 買い物メモ(買えた物にチェック)
            pg.goto(url + "?demo=1&premium=1&bought=1")
            pg.wait_for_selector(".item")
            pg.click(".tab >> text=買い物")
            pg.wait_for_selector(".shop-row")
            wait()
            pg.screenshot(path=os.path.join(RAW, "5_shop.png"))
            b.close()
    finally:
        srv.terminate()


def centered(d, y, text, font, fill):
    bb = d.textbbox((0, 0), text, font=font)
    d.text(((W - (bb[2] - bb[0])) // 2 - bb[0], y), text, font=font, fill=fill)
    return bb[3] - bb[1]


def compose(n, raw, title, sub):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # 上に緑の帯と見出し
    d.rectangle([0, 0, W, 640], fill=GREEN)
    f1 = ImageFont.truetype(BOLD, 112)
    f2 = ImageFont.truetype(BOLD, 50)
    y = 150
    for ln in title.split("\n"):
        centered(d, y, ln, f1, (255, 255, 255))
        y += 150
    centered(d, y + 20, sub, f2, (214, 236, 222))
    top = 700
    shot = Image.open(raw).convert("RGB")
    sw = 1050
    sh = int(shot.height * sw / shot.width)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    maxh = H - top - 70
    if sh > maxh:
        shot = shot.crop((0, 0, sw, maxh))
        sh = maxh
    x = (W - sw) // 2
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x + 4, top + 16, x + sw + 4, top + sh + 16], radius=60, fill=(40, 50, 30, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    img.paste(shadow, (0, 0), shadow)
    frame = Image.new("RGB", (sw + 20, sh + 20), INK)
    fm = Image.new("L", (sw + 20, sh + 20), 0)
    ImageDraw.Draw(fm).rounded_rectangle([0, 0, sw + 19, sh + 19], radius=66, fill=255)
    img.paste(frame, (x - 10, top - 10), fm)
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], radius=58, fill=255)
    img.paste(shot, (x, top), mask)
    img.save(os.path.join(STORE, f"shot_{n}.png"))
    # Play 用 1080x1920(9:16)。縦を合わせて左右を地の色で埋める
    pw = round(W * 1920 / H)
    small = img.resize((pw, 1920), Image.LANCZOS)
    bg = Image.new("RGB", (1080, 1920), BG)
    bg.paste(small, ((1080 - pw) // 2, 0))
    ImageDraw.Draw(bg).rectangle([0, 0, 1080, round(640 * 1920 / H)], fill=GREEN)
    bg.paste(small, ((1080 - pw) // 2, 0))
    bg.save(os.path.join(PLAY, f"play_shot_{n}.png"))


def play_assets():
    icon = Image.open(os.path.join(STORE, "icon_1024.png")).convert("RGB")
    icon.resize((512, 512), Image.LANCZOS).save(os.path.join(PLAY, "icon_512.png"))
    fw, fh = 1024, 500
    fg = Image.new("RGB", (fw, fh), GREEN)
    d = ImageDraw.Draw(fg)
    f1 = ImageFont.truetype(BOLD, 64)
    f2 = ImageFont.truetype(BOLD, 30)
    d.text((70, 120), "冷蔵庫の食べ時、", font=f1, fill=(255, 255, 255))
    d.text((70, 206), "ワンタップで。", font=f1, fill=(255, 255, 255))
    d.text((72, 320), "タベドキ  賞味期限と冷蔵庫の管理", font=f2, fill=(214, 236, 222))
    d.text((72, 366), "よく買う食材は1タップ・まとめて登録・期限前にお知らせ", font=ImageFont.truetype(BOLD, 22), fill=(214, 236, 222))
    ic = icon.resize((300, 300), Image.LANCZOS)
    m = Image.new("L", ic.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, 299, 299], radius=66, fill=255)
    fg.paste(ic, (fw - 360, 100), m)
    fg.save(os.path.join(PLAY, "feature_1024x500.png"))


if __name__ == "__main__":
    if "--compose-only" not in sys.argv:
        capture()
    compose(1, os.path.join(RAW, "1_home.png"), "期限の近い順に、\nひと目で。", "今日まで・2日以内を色で分けて並べます")
    compose(2, os.path.join(RAW, "2_add.png"), "買い物の後は、\n押すだけ登録。", "よく買う食材は目安の期限つきで1タップ")
    compose(3, os.path.join(RAW, "3_date.png"), "袋の日付は\n月→日の2タップ。", "年は自動。今日・明日・1週間は1タップ")
    compose(4, os.path.join(RAW, "4_log.png"), "捨てた額が、\n見えると減る。", "使い切った・捨てたを記録して月ごとに")
    compose(5, os.path.join(RAW, "5_shop.png"), "なくなった物は\n買い物メモへ。", "買えた物はそのまま冷蔵庫に入れられます")
    play_assets()
    print("ok")
