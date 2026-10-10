"""見本と作り直した画面を並べた比較画像を作る。python scripts/make_compare.py(先に python scripts/e2e.py)
docs/compare_redesign_2〜8.png(見本1枚+同じ役目の画面3枚)と docs/compare_redesign_all.png(全部を縦に)"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(os.path.expanduser("~"), "Downloads")
SHOTS = os.path.join(ROOT, "scripts", "e2e_out", "w375")
DOCS = os.path.join(ROOT, "docs")
os.makedirs(DOCS, exist_ok=True)
BOLD = "C:/Windows/Fonts/YuGothB.ttc"
REG = "C:/Windows/Fonts/YuGothM.ttc"

# 見本の番号 → (題, 並べる画面, 見本と違えた所)
PLAN = {
    2: ("ホーム・冷蔵庫リスト/ワンタップ登録", ["01_home", "05_add_often", "04_date_sheet"],
        "検索欄とカレンダーのタブは無い機能なので出さない。ワンタップ登録(1タップ)を残すため、ホームの上に「ワンタップで入れる」を置いた。日付は月→日の2タップで決まるので「この内容で追加」の前に日付欄を置かず、カゴの日付から直す"),
    3: ("入力画面の詳細(まとめて入れる・前回と同じ・日付2タップ)", ["06_add_tray", "07_add_last", "04_date_sheet"],
        "日付は見本の回す欄ではなく、月と日を並べた升目(どの日でも2タップで届く)。「この日付で決定」は置かない(日を押した時点で決まる)。今日・明日・1週間などの早押しを残した"),
    4: ("一覧・検索・絞り込み", ["01_home", "01c_home_fridge", "20_home_blue"],
        "検索・カテゴリ・並び替えの絞り込み画面は今無い機能なので作らない。絞り込みは置き場所(すべて・冷蔵・野菜室・冷凍・常温)だけ。期限の札の色は見本どおり"),
    5: ("使い切り・廃棄・ムダ管理", ["02_home_swipe", "03_item_sheet", "10_log"],
        "捨てた量(1/2・1/4)・捨てた理由・メモは記録していない機能なので出さない(個数と金額だけ)。ムダ管理の「理由別」も同じ理由で無い"),
    6: ("買い物メモといつもの買い物", ["09_shop", "09b_shop_full", "06_add_tray"],
        "「いつもの買い物」のセットは無い機能なので作らない(同じ役目は食材を追加の「前回と同じ」)。購入日・お店の記録も無い。自動で足すのではなく、使い切った・捨てた時に送る"),
    7: ("共有ファイルで家族と合算", ["12_share", "13_merge", "01_home"],
        "LINE・メールの別ボタンは OS の共有シート1つにまとめた(LINE のロゴは使わない)。同じ食材は数を足すのではなく、新しく直した方が残る今の合わせ方のまま。自分・家族の札は持ち主を記録していないので出さない"),
    8: ("設定・完全版・テーマ", ["14_settings", "19_paywall", "17_custom"],
        "完全版の中身・値段は 1.0 と同じ(お知らせは「前日の8時」/「当日〜1週間前・好きな時刻」)。テーマ4種の名前と色を見本に合わせた。分類・置き場所は足すだけ(書き換えの鉛筆は無い機能なので出さない)"),
}


def wrap(d, text, font, width):
    lines, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=font) > width:
            lines.append(cur); cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def one(n):
    title, shots, note = PLAN[n]
    ref = Image.open(os.path.join(REF, f"tabedoki_ref_{n}_941x1672.png")).convert("RGB")
    H = 1672
    pw = round(750 * 1500 / 1624)
    W = 941 + 60 + 3 * pw + 2 * 30 + 60
    can = Image.new("RGB", (W, H + 330), (244, 247, 245))
    d = ImageDraw.Draw(can)
    f1, f2, f3 = ImageFont.truetype(BOLD, 44), ImageFont.truetype(BOLD, 30), ImageFont.truetype(REG, 28)
    d.text((30, 24), f"見本 {n}: {title}", font=f1, fill=(15, 110, 60))
    can.paste(ref, (30, 100))
    x = 941 + 90
    d.text((x, 108), "作り直した画面(375幅・見本データ)", font=f2, fill=(30, 40, 35))
    for s in shots:
        im = Image.open(os.path.join(SHOTS, s + ".png")).convert("RGB")
        if im.height > im.width * 2.3:  # 縦長の全体写真は上から切る
            im = im.crop((0, 0, im.width, round(im.width * 1624 / 750)))
        im = im.resize((pw, round(im.height * pw / im.width)), Image.LANCZOS)
        im = im.crop((0, 0, pw, min(im.height, 1500)))
        m = Image.new("L", im.size, 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=36, fill=255)
        d.rounded_rectangle([x - 6, 166, x + pw + 6, 166 + im.height + 12], radius=42, fill=(40, 48, 44))
        can.paste(im, (x, 172), m)
        d.text((x, 172 + im.height + 24), s, font=f3, fill=(110, 118, 114))
        x += pw + 30
    y = H + 130
    d.text((30, y), "見本と違えた所:", font=f2, fill=(200, 60, 60))
    for i, ln in enumerate(wrap(d, note, f3, W - 300)):
        d.text((260, y + 2 + i * 40), ln, font=f3, fill=(40, 48, 44))
    out = os.path.join(DOCS, f"compare_redesign_{n}.png")
    can.save(out)
    return out


if __name__ == "__main__":
    outs = [one(n) for n in PLAN]
    ims = [Image.open(o) for o in outs]
    w = 1600
    ims = [im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) for im in ims]
    allc = Image.new("RGB", (w, sum(i.height for i in ims) + 20 * len(ims)), (255, 255, 255))
    y = 0
    for im in ims:
        allc.paste(im, (0, y)); y += im.height + 20
    allc.save(os.path.join(DOCS, "compare_redesign_all.png"))
    print("ok", len(outs))
