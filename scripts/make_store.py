"""Google Play 用のストア素材を 1.1.0 の見た目で作る。python scripts/make_store.py(先に npm run build:e2e と scripts/make_native_assets.py)
- store/play/icon_512.png          … 新しいアイコン(store/icon_1024.png)
- store/play/feature_1024x500.png  … フィーチャー グラフィック(見本の野菜の絵・題字・アイコン)
- store/play/play_shot_1〜6.png    … 1080x1920。見本データで撮った画面(store/raw/play_*.png)に見出しを付ける
値段・「無料」は写さない(完全版の画面・設定の完全版の帯は撮らない)。Android に無い機能(iPhone だけの物)も写さない。
1.0 の素材は store/_old_2026-10-10/ に退避してある。iOS は出し直さないので App Store 用の shot_*.png は作らない。
"""
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
IMG = os.path.join(ROOT, "public", "img")
for d in (RAW, PLAY):
    os.makedirs(d, exist_ok=True)

BG = (238, 247, 241)
GREEN = (30, 148, 87)
DEEP = (14, 120, 65)
INK = (31, 42, 36)
BOLD = "C:/Windows/Fonts/YuGothB.ttc"
W, H = 1080, 1920


def free_port():
    with socket.socket() as so:
        so.bind(("127.0.0.1", 0))
        return so.getsockname()[1]


def capture():
    port = free_port()
    srv = subprocess.Popen([sys.executable, os.path.join(ROOT, "scripts", "serve.py"), os.path.join(ROOT, "dist-e2e"), str(port)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}/"
    try:
        time.sleep(1.2)
        with sync_playwright() as p:
            b = p.chromium.launch()
            ctx = b.new_context(viewport={"width": 412, "height": 846}, device_scale_factor=2.5, locale="ja-JP", accept_downloads=True)
            pg = ctx.new_page()
            wait = lambda: pg.wait_for_timeout(450)
            shot = lambda n: (wait(), pg.screenshot(path=os.path.join(RAW, f"play_{n}.png")))
            # 完全版にしておく(設定・ホームに値段が出ないように)
            pg.goto(url + "?demo=1&premium=1")
            pg.wait_for_selector(".item")
            shot("1_home")
            pg.click(".home-add")
            for n in ["牛乳", "卵", "卵", "ヨーグルト", "トマト"]:
                pg.locator(".tile", has_text=n).first.click()
            shot("2_add")
            pg.click(".add-tabs button >> text=まとめて入れる")
            pg.locator(".tray-row", has_text="ヨーグルト").locator(".date-chip").click()
            pg.wait_for_selector(".date-sheet")
            shot("3_date")
            pg.click(".date-sheet .close")
            pg.click(".topbar .close")
            pg.locator(".item", has_text="ほうれん草").click()
            pg.wait_for_selector(".item-sheet")
            shot("4_item")
            pg.click(".item-sheet .close")
            pg.click(".tab >> text=統計")
            pg.wait_for_selector(".log-hero")
            shot("5_log")
            pg.goto(url + "?demo=1&premium=1&bought=1")
            pg.wait_for_selector(".item")
            pg.click(".tab >> text=共有")
            pg.wait_for_selector(".share")
            shot("6_share")
            b.close()
    finally:
        srv.terminate()


def centered(d, y, text, font, fill, w=W):
    bb = d.textbbox((0, 0), text, font=font)
    d.text(((w - (bb[2] - bb[0])) // 2 - bb[0], y), text, font=font, fill=fill)


def compose(n, raw, title, sub):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # 上の見出し(見本と同じ緑の太字)
    f1 = ImageFont.truetype(BOLD, 86)
    f2 = ImageFont.truetype(BOLD, 38)
    y = 92
    for ln in title.split("\n"):
        centered(d, y, ln, f1, DEEP)
        y += 112
    centered(d, y + 14, sub, f2, (86, 97, 91))
    top = y + 100
    shot = Image.open(raw).convert("RGB")
    sw = 820
    sh = round(shot.height * sw / shot.width)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    maxh = H - top + 40
    shot = shot.crop((0, 0, sw, min(sh, maxh)))
    sh = shot.height
    x = (W - sw) // 2
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x - 8, top + 18, x + sw + 8, top + sh + 40], radius=70, fill=(20, 60, 40, 80))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    img.paste(shadow, (0, 0), shadow)
    fr = Image.new("L", (W, H), 0)
    ImageDraw.Draw(fr).rounded_rectangle([x - 16, top - 16, x + sw + 16, top + sh + 80], radius=76, fill=255)
    img.paste(Image.new("RGB", (W, H), (34, 40, 37)), (0, 0), fr)
    m = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, sw - 1, sh + 80], radius=62, fill=255)
    img.paste(shot, (x, top), m)
    img.save(os.path.join(PLAY, f"play_shot_{n}.png"))


def feature():
    fw, fh = 1024, 500
    fg = Image.new("RGB", (fw, fh), (246, 251, 247))
    d = ImageDraw.Draw(fg)
    veg = Image.open(os.path.join(RAW, "veggies.png")).convert("RGBA")
    s = 430 / veg.height
    veg = veg.resize((round(veg.width * s), 430), Image.LANCZOS)
    # 切り出した絵の左と下の縁をぼかして地になじませる
    from PIL import ImageChops
    g = Image.new("L", veg.size, 255)
    gp = g.load()
    for yy in range(veg.height):
        for xx in range(veg.width):
            a = min(1.0, xx / 140) * min(1.0, (veg.height - 1 - yy) / 110)
            gp[xx, yy] = round(255 * a)
    veg.putalpha(ImageChops.multiply(veg.getchannel("A"), g))
    fg.paste(veg, (fw - veg.width, 0), veg)
    icon = Image.open(os.path.join(STORE, "icon_1024.png")).convert("RGB").resize((150, 150), Image.LANCZOS)
    m = Image.new("L", icon.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, 149, 149], radius=34, fill=255)
    sh = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([60, 70, 214, 224], radius=36, fill=(20, 60, 40, 60))
    sh = sh.filter(ImageFilter.GaussianBlur(10))
    fg.paste(sh, (0, 0), sh)
    fg.paste(icon, (60, 64), m)
    logo = Image.open(os.path.join(IMG, "logo.png")).convert("RGBA")
    lw = 360
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    fg.paste(logo, (238, 84), logo)
    f1 = ImageFont.truetype(BOLD, 50)
    f2 = ImageFont.truetype(BOLD, 26)
    d.text((62, 262), "冷蔵庫の食べ時、", font=f1, fill=DEEP)
    d.text((62, 330), "ワンタップで。", font=f1, fill=DEEP)
    d.text((64, 418), "よく買う食材は1タップ登録・期限の近い順・ムダ金額", font=f2, fill=(86, 97, 91))
    fg.save(os.path.join(PLAY, "feature_1024x500.png"))


if __name__ == "__main__":
    if "--compose-only" not in sys.argv:
        capture()
    Image.open(os.path.join(STORE, "icon_1024.png")).convert("RGB").resize((512, 512), Image.LANCZOS).save(os.path.join(PLAY, "icon_512.png"))
    compose(1, os.path.join(RAW, "play_1_home.png"), "期限の近い順に、\nひと目で。", "期限切れ・今日まで・あと2日を色の札で")
    compose(2, os.path.join(RAW, "play_2_add.png"), "よく買う食材は\nワンタップ登録。", "目安の期限つきで、押すだけで入ります")
    compose(3, os.path.join(RAW, "play_3_date.png"), "袋の日付は\n月→日の2タップ。", "年は自動。今日・明日・1週間は1タップ")
    compose(4, os.path.join(RAW, "play_4_item.png"), "使い切った・捨てたを\nかんたん記録。", "左にずらすだけでも記録できます")
    compose(5, os.path.join(RAW, "play_5_log.png"), "ムダ金額が\n見えると減る。", "月ごとのムダと、よく捨てる食材")
    compose(6, os.path.join(RAW, "play_6_share.png"), "共有ファイルで\n家族と合わせる。", "アカウント登録なし。LINE やメールで送るだけ")
    feature()
    print("ok")
