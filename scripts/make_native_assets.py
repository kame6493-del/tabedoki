"""Android と iOS のアイコン・起動画面を public/icon.svg から作る。python scripts/make_native_assets.py
(npx cap add の後に1回。ファイルの大きさは今あるものに合わせる)"""
import glob
import os
import re
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
IOS = os.path.join(ROOT, "ios", "App", "App", "Assets.xcassets")
TMP = os.path.join(ROOT, "store", "raw")
os.makedirs(TMP, exist_ok=True)
svg = open(os.path.join(ROOT, "public", "icon.svg"), encoding="utf-8").read()
inner = re.sub(r'<rect width="1024" height="1024" fill="#2f7d55"/>', "", svg.split(">", 1)[1].rsplit("</svg>", 1)[0])
# 丸や角丸に切られても欠けないよう、絵を中央 60% に縮める(アダプティブアイコンの安全域)
fg_svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g transform="translate(205 205) scale(0.6)">{inner}</g></svg>'
# 起動画面: 生成りの地に、アイコンを小さく
splash_svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#f6f2ea"/><g transform="translate(362 362) scale(0.293)"><rect width="1024" height="1024" rx="220" fill="#2f7d55"/>{inner}</g></svg>'


def render(markup, path, transparent=False):
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1024, "height": 1024})
        pg.set_content(f'<html><body style="margin:0;background:transparent">{markup.replace("<svg ", "<svg width=1024 height=1024 ", 1)}</body></html>')
        pg.screenshot(path=path, omit_background=transparent, clip={"x": 0, "y": 0, "width": 1024, "height": 1024})
        b.close()


full = os.path.join(ROOT, "store", "icon_1024.png")
fg = os.path.join(TMP, "_fg.png")
sp = os.path.join(TMP, "_splash.png")
render(fg_svg, fg, transparent=True)
render(splash_svg, sp)
full_im = Image.open(full).convert("RGB")
fg_im = Image.open(fg).convert("RGBA")
sp_im = Image.open(sp).convert("RGB")

# Android ランチャー
for f in glob.glob(os.path.join(RES, "mipmap-*", "*.png")):
    size = Image.open(f).size
    name = os.path.basename(f)
    if name == "ic_launcher_foreground.png":
        fg_im.resize(size, Image.LANCZOS).save(f)
    elif name == "ic_launcher_round.png":
        im = full_im.resize(size, Image.LANCZOS).convert("RGBA")
        m = Image.new("L", size, 0)
        from PIL import ImageDraw
        ImageDraw.Draw(m).ellipse([0, 0, size[0] - 1, size[1] - 1], fill=255)
        im.putalpha(m)
        im.save(f)
    else:
        full_im.resize(size, Image.LANCZOS).save(f)
open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w", encoding="utf-8").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2F7D55</color>\n</resources>\n')


def cover(im, size):
    w, h = size
    s = max(w / im.width, h / im.height)
    r = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l, t = (r.width - w) // 2, (r.height - h) // 2
    return r.crop((l, t, l + w, t + h))


def splash_for(size):
    # 地の色で埋め、短い辺の 40% にアイコン入りの絵を置く
    w, h = size
    bg = Image.new("RGB", size, (246, 242, 234))
    side = round(min(w, h) * 1.0)
    im = sp_im.resize((side, side), Image.LANCZOS)
    bg.paste(im, ((w - side) // 2, (h - side) // 2))
    return bg


for f in glob.glob(os.path.join(RES, "drawable*", "splash.png")):
    splash_for(Image.open(f).size).save(f)

# 通知の小さいアイコン(白一色の時計)
open(os.path.join(RES, "drawable", "ic_stat_tabedoki.xml"), "w", encoding="utf-8").write('''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF" android:pathData="M12,2A10,10 0 1,0 12,22A10,10 0 1,0 12,2ZM12,4.5A7.5,7.5 0 1,1 12,19.5A7.5,7.5 0 1,1 12,4.5ZM11,7L11,12.6L15.2,15.1L16,13.8L12.6,11.8L12.6,7Z"/>
</vector>
''')

# iOS アイコン(透明なし 1024)と起動画面
for f in glob.glob(os.path.join(IOS, "AppIcon.appiconset", "*.png")):
    full_im.resize(Image.open(f).size, Image.LANCZOS).save(f)
for f in glob.glob(os.path.join(IOS, "Splash.imageset", "*.png")):
    splash_for(Image.open(f).size).save(f)
os.remove(fg)
os.remove(sp)
print("ok")
