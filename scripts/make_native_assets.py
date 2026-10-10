"""アイコン・起動画面を新しいアイコン(store/icon_source_1024.png)から作る。python scripts/make_native_assets.py
元の絵: 持ち主が ChatGPT で作った「緑の冷蔵庫と予定表、下にタベドキ」(Downloads/tabedoki_ref_1_1254x1254.png を正方形にした物)。
- store/icon_1024.png       … 縁に焼き込まれた角丸の影を白で平らにした 1024(不透明。App Store・Play・iOS AppIcon の元)
- Android 適応アイコン      … 背景=絵の地と同じ白一色、前景=絵を縮めて中央に(丸く切られても主役が欠けない大きさ)
- Android 旧アイコン・丸    … ic_launcher / ic_launcher_round
- 起動画面(Android・iOS)  … 白の地に絵を小さく
- public/icon.png           … アプリ内(起動中の表示・このアプリについて)とブラウザのタブ
- docs/icon_check.png       … 丸・角丸・しずく・スクワークルで切った見え方と安全域(66dp の円)を並べた確認用
"""
import glob
import json
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
IOS = os.path.join(ROOT, "ios", "App", "App", "Assets.xcassets")
DOCS = os.path.join(ROOT, "docs")
os.makedirs(DOCS, exist_ok=True)

CARD = (252, 253, 252)  # 絵の地の白
BG_HEX = "#FCFDFC"
# 前景で絵を置く大きさ(108dp の層に対する割合)。主役のいちばん外(下の「タベドキ」の角)が
# 72dp の見える円の内側に入り、66dp の安全域にもほぼ収まる値を、docs/icon_check.png を見て決めた
FG_SCALE = 0.54


def clean_icon():
    src = Image.open(os.path.join(ROOT, "store", "icon_source_1024.png")).convert("RGB").resize((1024, 1024), Image.LANCZOS)
    w, h = src.size
    # 縁 0〜60px と、角丸(半径 200)の外側にある「色の無い明るい画素」= 焼き込まれた影を地の白にする
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([60, 60, w - 61, h - 61], radius=150, fill=255)
    px, mp = src.load(), mask.load()
    for y in range(h):
        for x in range(w):
            if mp[x, y]:
                continue
            r, g, b = px[x, y]
            if max(r, g, b) - min(r, g, b) < 14 and min(r, g, b) > 200:
                px[x, y] = CARD
    return src


def fg_layer(icon, size):
    lay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s = round(size * FG_SCALE)
    im = icon.resize((s, s), Image.LANCZOS).convert("RGBA")
    # 絵の外枠(白い四角)は背景と同じ白なので、そのまま置いても境目は見えない
    lay.paste(im, ((size - s) // 2, (size - s) // 2), im)
    return lay


def adaptive_preview(icon, shape, size=432):
    """背景+前景を重ね、見える 72dp の範囲を切り出して、形で切る"""
    full = Image.new("RGBA", (size, size), CARD + (255,))
    full.alpha_composite(fg_layer(icon, size))
    vis = round(size * 72 / 108)
    o = (size - vis) // 2
    v = full.crop((o, o, o + vis, o + vis))
    m = Image.new("L", (vis, vis), 0)
    d = ImageDraw.Draw(m)
    if shape == "circle":
        d.ellipse([0, 0, vis - 1, vis - 1], fill=255)
    elif shape == "rounded":
        d.rounded_rectangle([0, 0, vis - 1, vis - 1], radius=round(vis * 0.16), fill=255)
    elif shape == "squircle":
        d.rounded_rectangle([0, 0, vis - 1, vis - 1], radius=round(vis * 0.36), fill=255)
    elif shape == "teardrop":
        d.rounded_rectangle([0, 0, vis - 1, vis - 1], radius=round(vis * 0.5), fill=255)
        d.rectangle([vis // 2, vis // 2, vis - 1, vis - 1], fill=255)
    out = Image.new("RGBA", (vis, vis), (0, 0, 0, 0))
    out.paste(v, (0, 0), m)
    if shape == "safe":
        out = v.copy()
        dd = ImageDraw.Draw(out)
        r66 = vis * 66 / 72 / 2
        c = vis / 2
        dd.ellipse([c - r66, c - r66, c + r66, c + r66], outline=(220, 40, 40, 255), width=3)
    return out


def check_sheet(icon):
    shapes = [("circle", "丸"), ("squircle", "スクワークル"), ("rounded", "角丸"), ("teardrop", "しずく"), ("safe", "赤い円=安全域66dp")]
    tiles = [adaptive_preview(icon, s) for s, _ in shapes]
    w = sum(t.width for t in tiles) + 40 * (len(tiles) + 1)
    sheet = Image.new("RGB", (w, 420), (60, 70, 66))
    d = ImageDraw.Draw(sheet)
    f = ImageFont.truetype("C:/Windows/Fonts/YuGothB.ttc", 22)
    x = 40
    for t, (_, label) in zip(tiles, shapes):
        sheet.paste(t, (x, 40), t)
        d.text((x, 350), label, font=f, fill=(255, 255, 255))
        x += t.width + 40
    sheet.save(os.path.join(DOCS, "icon_check.png"))


def splash(icon, size):
    w, h = size
    bg = Image.new("RGB", size, CARD)
    side = round(min(w, h) * 0.42)
    im = icon.resize((side, side), Image.LANCZOS)
    bg.paste(im, ((w - side) // 2, (h - side) // 2))
    return bg


if __name__ == "__main__":
    icon = clean_icon()
    icon.save(os.path.join(ROOT, "store", "icon_1024.png"))
    icon.resize((192, 192), Image.LANCZOS).save(os.path.join(ROOT, "public", "icon.png"), optimize=True)
    icon.resize((512, 512), Image.LANCZOS).save(os.path.join(ROOT, "public", "icon-512.png"), optimize=True)

    for f in glob.glob(os.path.join(RES, "mipmap-*", "*.png")):
        size = Image.open(f).size
        name = os.path.basename(f)
        if name == "ic_launcher_foreground.png":
            fg_layer(icon, size[0]).save(f)
        elif name == "ic_launcher_round.png":
            # 丸に切っても下の字が欠けないよう、白い丸の中に少し縮めて置く
            can = Image.new("RGBA", size, (0, 0, 0, 0))
            m = Image.new("L", size, 0)
            ImageDraw.Draw(m).ellipse([0, 0, size[0] - 1, size[1] - 1], fill=255)
            disk = Image.new("RGBA", size, CARD + (255,))
            can.paste(disk, (0, 0), m)
            s = round(size[0] * 0.80)
            im = icon.resize((s, s), Image.LANCZOS).convert("RGBA")
            can.alpha_composite(im, ((size[0] - s) // 2, (size[1] - s) // 2))
            can.putalpha(m)
            can.save(f)
        else:
            icon.resize(size, Image.LANCZOS).save(f)
    open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w", encoding="utf-8").write(
        f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{BG_HEX}</color>\n</resources>\n')
    for f in glob.glob(os.path.join(RES, "drawable*", "splash.png")):
        splash(icon, Image.open(f).size).save(f)

    # iOS: AppIcon は不透明の 1024 を1枚。起動画面も同じ白の地に
    for f in glob.glob(os.path.join(IOS, "AppIcon.appiconset", "*.png")):
        icon.resize(Image.open(f).size, Image.LANCZOS).convert("RGB").save(f)
    for f in glob.glob(os.path.join(IOS, "Splash.imageset", "*.png")):
        splash(icon, Image.open(f).size).save(f)

    check_sheet(icon)
    print("ok")
