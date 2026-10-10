"""Google Play 用のストア素材を 1.1.0 の見た目で作る。python scripts/make_store.py(先に npm run build:e2e と scripts/make_native_assets.py)
- store/play/icon_512.png          … 新しいアイコン(store/icon_1024.png)
- store/play/feature_1024x500.png  … フィーチャー グラフィック(見本の野菜の絵・題字・アイコン)
- store/play/play_shot_1〜6.png    … 1080x1920。見本データで撮った画面(store/raw/play_*.png)に見出しを付ける
値段・「無料」は写さない(完全版の画面・設定の完全版の帯は撮らない)。Android に無い機能(iPhone だけの物)も写さない。
1.0 の素材は store/_old_2026-10-10/ に退避してある。
2026-10-10 持ち主「Claude 特有の背景をなくして」: 淡い緑の無地をやめ、アプリの濃い緑の地に、野菜の写真(store/raw/veggies.png)を
ぼかして上に敷く。見出しは白の HG創英角ゴシックUB。前の版は store/_cream_backup_2026-10-10/ に退避。iOS は出し直さないので App Store 用の shot_*.png は作らない。
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

LEAF = (16, 104, 58)      # 地の濃い緑
LEAF2 = (9, 72, 40)
WHITE = (255, 255, 255)
SUBG = (205, 240, 218)
GREEN = (30, 148, 87)
DEEP = (14, 120, 65)
INK = (31, 42, 36)
BOLD = "C:/Windows/Fonts/HGRSGU.TTC"
SUBF = "C:/Windows/Fonts/meiryob.ttc"
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


def leaf_bg(w, h, band):
    """濃い緑の縦グラデーションに、野菜の写真をぼかして上 band px に敷く(下へ溶かす)"""
    img = Image.new("RGB", (w, h), LEAF)
    d = ImageDraw.Draw(img)
    for yy in range(h):
        t = yy / h
        d.line([(0, yy), (w, yy)], fill=tuple(round(LEAF[i] + (LEAF2[i] - LEAF[i]) * t) for i in range(3)))
    if band <= 0:
        return img
    veg = Image.open(os.path.join(RAW, "veggies.png")).convert("RGB")
    s = max(w / veg.width, band / veg.height)
    veg = veg.resize((round(veg.width * s) + 1, round(veg.height * s) + 1), Image.LANCZOS)
    veg = veg.crop(((veg.width - w) // 2, 0, (veg.width - w) // 2 + w, band)).filter(ImageFilter.GaussianBlur(w / 90))
    veg = Image.blend(veg, Image.new("RGB", veg.size, LEAF2), 0.55)
    m = Image.new("L", veg.size, 255)
    mp = ImageDraw.Draw(m)
    for yy in range(band):
        t = yy / band
        mp.line([(0, yy), (w, yy)], fill=round(255 * min(1.0, (1 - t) / 0.45)))
    img.paste(veg, (0, 0), m)
    return img


def compose(n, raw, title, sub):
    img = leaf_bg(W, H, 560)
    d = ImageDraw.Draw(img)
    # 上の見出し(白の HG創英角ゴシックUB)
    f1 = ImageFont.truetype(BOLD, 86)
    f2 = ImageFont.truetype(SUBF, 36)
    y = 92
    for ln in title.split("\n"):
        centered(d, y, ln, f1, WHITE)
        y += 112
    centered(d, y + 14, sub, f2, SUBG)
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
    ImageDraw.Draw(shadow).rounded_rectangle([x - 8, top + 18, x + sw + 8, top + sh + 40], radius=70, fill=(0, 20, 8, 120))
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
    fg = leaf_bg(fw, fh, 0)
    d = ImageDraw.Draw(fg)
    # 野菜の写真は右に角丸の写真として置く(縁を溶かすと白い縁が浮くため)
    veg = Image.open(os.path.join(RAW, "veggies.png")).convert("RGB")
    cw, chh = 330, 420
    s = max(cw / veg.width, chh / veg.height)
    veg = veg.resize((round(veg.width * s) + 1, round(veg.height * s) + 1), Image.LANCZOS)
    veg = veg.crop((veg.width - cw, veg.height - chh, veg.width, veg.height))
    vx, vy = fw - cw - 40, 40
    sh0 = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    ImageDraw.Draw(sh0).rounded_rectangle([vx, vy + 10, vx + cw, vy + chh + 10], radius=30, fill=(0, 20, 8, 130))
    sh0 = sh0.filter(ImageFilter.GaussianBlur(14))
    fg.paste(sh0, (0, 0), sh0)
    vm = Image.new("L", (cw, chh), 0)
    ImageDraw.Draw(vm).rounded_rectangle([0, 0, cw - 1, chh - 1], radius=30, fill=255)
    fg.paste(veg, (vx, vy), vm)
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
    wl = Image.new("RGBA", logo.size, WHITE + (0,))
    wl.putalpha(logo.getchannel("A"))
    fg.paste(wl, (238, 84), wl)
    f1 = ImageFont.truetype(BOLD, 50)
    f2 = ImageFont.truetype(SUBF, 21)
    d.text((62, 262), "冷蔵庫の食べ時、", font=f1, fill=WHITE)
    d.text((62, 330), "ワンタップで。", font=f1, fill=WHITE)
    d.text((64, 420), "よく買う食材は1タップ登録・期限の近い順・ムダ金額", font=f2, fill=SUBG)
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
