"""見本(ChatGPT に作らせた UI 参考画像)から食材の絵・人物・小物を切り出して public/img/ に置く。
python scripts/cut_ref_images.py
- 見本は Downloads/tabedoki_ref_2〜8_941x1672.png(持ち主の指示で、見本の絵はそのまま使ってよい)
- 白い地を縁から塗りつぶして透明にし(白い牛乳パックや豆腐の中は残る)、絵の大きさで切り詰めて正方形に置く
"""
import os
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(os.path.expanduser("~"), "Downloads")
OUT = os.path.join(ROOT, "public", "img")
os.makedirs(os.path.join(OUT, "food"), exist_ok=True)


def ref(n):
    return Image.open(os.path.join(REF, f"tabedoki_ref_{n}_941x1672.png")).convert("RGB")


def whiten(im, tol=14, min_frac=0.15):
    """縁とつながっている、縁の色に近い画素を真っ白にし、小さな切れ端(隣の＋ボタンなど)も白で消す。
    白い牛乳パックに白が染みても白のままなので見た目は変わらない。アプリでは白い板の上に置く"""
    im = im.convert("RGB")
    w, h = im.size
    px = im.load()
    edge = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)] + [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    edge.sort(key=lambda c: -(c[0] + c[1] + c[2]))
    bgc = edge[len(edge) // 4]
    bg = bytearray(w * h)
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    seen = bytearray(w * h)
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b = px[x, y]
        if max(abs(r - bgc[0]), abs(g - bgc[1]), abs(b - bgc[2])) > tol:
            continue
        bg[i] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    # 地でない画素のかたまりを数え、いちばん大きいかたまりの min_frac 未満は消す
    lab = [0] * (w * h)
    sizes = {}
    cur = 0
    for i in range(w * h):
        if bg[i] or lab[i]:
            continue
        cur += 1
        n = 0
        st = [i]
        lab[i] = cur
        while st:
            j = st.pop(); n += 1
            x, y = j % w, j // w
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    k = ny * w + nx
                    if not bg[k] and not lab[k]:
                        lab[k] = cur; st.append(k)
        sizes[cur] = n
    big = max(sizes.values()) if sizes else 0
    keep = {k for k, v in sizes.items() if v >= big * min_frac}
    out = Image.new("RGB", (w, h), (255, 255, 255))
    op = out.load()
    for i in range(w * h):
        if not bg[i] and lab[i] in keep:
            x, y = i % w, i // w
            op[x, y] = px[x, y]
    # 中身の範囲
    xs = [i % w for i in range(w * h) if not bg[i] and lab[i] in keep]
    ys = [i // w for i in range(w * h) if not bg[i] and lab[i] in keep]
    return out, ((min(xs), min(ys), max(xs) + 1, max(ys) + 1) if xs else None)


def place(im, bb, size, pad=0.07):
    if bb:
        im = im.crop(bb)
    inner = round(size * (1 - pad * 2))
    s = inner / max(im.width, im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    can = Image.new("RGB", (size, size), (255, 255, 255))
    can.paste(im, ((size - im.width) // 2, (size - im.height) // 2))
    return can


def clear(im, tol, min_frac=0.15):
    """whiten と同じ見分け方で、地を透明にする(色の付いた板の上に置く絵用)"""
    w, h = im.size
    white, bb = whiten(im, tol, min_frac)
    a = Image.new("L", (w, h), 0)
    ap, wp, sp = a.load(), white.load(), im.convert("RGB").load()
    for y in range(h):
        for x in range(w):
            if wp[x, y] != (255, 255, 255) or sp[x, y] == (255, 255, 255):
                ap[x, y] = 255 if wp[x, y] != (255, 255, 255) else 0
    from PIL import ImageFilter
    a = a.filter(ImageFilter.GaussianBlur(0.6))
    out = im.convert("RGBA")
    out.putalpha(a)
    return out, bb


def cut(n, box, name, size=160, tol=14, sub="food", pad=0.07, transparent=False, src=None, min_frac=0.15):
    raw = (src or ref(n)).crop(box)
    im, bb = clear(raw, tol, min_frac) if transparent else whiten(raw, tol, min_frac)
    if transparent:
        im = im.crop(bb) if bb else im
        s = size / max(im.width, im.height)
        out = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    else:
        out = place(im, bb, size, pad)
    path = os.path.join(OUT, sub, name + ".png") if sub else os.path.join(OUT, name + ".png")
    out.save(path, optimize=True)
    return path


# 食材(見本2 の「食材を追加」の升目がいちばん大きく、きれい)
FOODS2 = {
    "milk": (530, 419, 608, 487), "egg": (652, 412, 742, 487), "yogurt": (780, 412, 880, 487),
    "bread": (522, 543, 612, 600), "tofu": (652, 543, 742, 602), "natto": (780, 543, 880, 602),
    "banana": (522, 660, 615, 718), "lettuce": (652, 657, 742, 720), "tomato": (780, 657, 880, 720),
    "cucumber": (522, 770, 615, 830), "carrot": (652, 770, 742, 832), "onion": (780, 770, 880, 832),
}

if __name__ == "__main__":
    for k, b in FOODS2.items():
        cut(2, b, k)
    # 見本3〜6 にしか無い食材
    cut(4, (34, 982, 92, 1034), "ham")
    cut(4, (34, 1046, 92, 1102), "spinach")
    cut(4, (34, 1118, 92, 1172), "icecream")
    cut(2, (60, 963, 132, 1036), "frozen_udon")
    cut(4, (652, 893, 714, 962), "udon")
    cut(5, (683, 1083, 748, 1148), "moyashi")
    cut(6, (514, 762, 553, 802), "cheese")
    # 小物・人物(色の付いた板にも置けるよう透明に)
    cut(7, (32, 375, 300, 590), "share_family", size=640, tol=10, sub="", transparent=True, min_frac=0.0005)
    cut(6, (698, 308, 872, 436), "basket_done", size=400, tol=12, sub="", transparent=True, min_frac=0.005)
    cut(5, (650, 484, 716, 552), "coin", size=160, tol=16, sub="", transparent=True)
    cut(8, (424, 352, 556, 402), "crown", size=320, tol=12, sub="", transparent=True, min_frac=0.01)
    cut(5, (645, 941, 675, 969), "rank1", size=72, tol=14, sub="", transparent=True)
    cut(5, (645, 1023, 675, 1050), "rank2", size=72, tol=14, sub="", transparent=True)
    cut(5, (645, 1103, 675, 1131), "rank3", size=72, tol=14, sub="", transparent=True)
    cut(7, (284, 1376, 428, 1522), "grocery_bag", size=320, tol=34, sub="", transparent=True)
    # ストアの絵(フィーチャー画像)用の野菜(見本2 の右上)。アプリには入れないので store/raw に置く
    im, bb = clear(ref(2).crop((728, 0, 941, 196)), 18, 0.02)
    im.crop(bb).save(os.path.join(ROOT, "store", "raw", "veggies.png"))
    # 題字: 新しいアイコンの下の「タベドキ」
    icon = Image.open(os.path.join(ROOT, "store", "icon_1024.png")).convert("RGB")
    cut(0, (90, 735, 935, 965), "logo", size=600, tol=20, sub="", transparent=True, src=icon, min_frac=0.005)
    print("ok")
