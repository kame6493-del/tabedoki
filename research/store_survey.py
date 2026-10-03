# -*- coding: utf-8 -*-
"""App Store(日本)で 4語 × 上位20本 の課金内容・評価件数・レビューの不満を集める。2026-10-03
python research/store_survey.py  → research/survey.json, research/survey.md
"""
import json, os, re, time, urllib.parse, urllib.request, collections

HERE = os.path.dirname(os.path.abspath(__file__))
TERMS = ["賞味期限", "冷蔵庫", "食材管理", "在庫管理 食品"]
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}

# 不満の分類(1件のレビューが複数に入ってよい)
CATS = collections.OrderedDict([
    ("登録・入力の手間", r"面倒|めんどう|めんどく|手間|いちいち|入力が|入力する|登録が|登録する|登録に|手入力|毎回|時間がかか|ひとつひとつ|一つ一つ|一個ずつ|1つずつ|打ち込"),
    ("日付入力が不便", r"日付|年月日|カレンダー|ドラム|スクロール"),
    ("バーコードが読めない/出ない", r"バーコード.{0,15}(読め|読まな|反応|出ない|出てこ|ヒットし|登録されてい|無い|ない|認識)"),
    ("広告がじゃま", r"広告"),
    ("課金・サブスク", r"課金|有料|サブスク|月額|年額|お金|無料版|制限"),
    ("通知が来ない/不便", r"通知"),
    ("家族と共有できない", r"共有|同期|家族|夫|妻|旦那"),
    ("データが消えた", r"消え|消えて|リセット|引き継"),
    ("落ちる・不具合", r"落ちる|落ちた|不具合|バグ|開かな|固ま|フリーズ|起動しな"),
])


def get(url, tries=3):
    err = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa
            err = e
            time.sleep(3 + 3 * i)
    raise err


def search(term):
    u = "https://itunes.apple.com/search?" + urllib.parse.urlencode(
        {"term": term, "country": "jp", "entity": "software", "limit": 20, "lang": "ja_jp"})
    return json.loads(get(u)).get("results", [])


def iap(app_id):
    """ストアのページから「アプリ内購入」の一覧を読む"""
    try:
        s = get(f"https://apps.apple.com/jp/app/id{app_id}")
    except Exception:
        return None
    i = s.find('"title":"アプリ内購入"')
    if i < 0:
        return []
    j = s.find('}]', i)
    seg = s[i:j + 2]
    return re.findall(r'"leadingText":"((?:[^"\\]|\\.)*)","trailingText":"([^"]*)"', seg)


def reviews(app_id, pages=5):
    out = []
    for p in range(1, pages + 1):
        try:
            d = json.loads(get(f"https://itunes.apple.com/jp/rss/customerreviews/page={p}/id={app_id}/sortby=mostrecent/json"))
        except Exception:
            break
        es = d.get("feed", {}).get("entry", [])
        if isinstance(es, dict):
            es = [es]
        es = [e for e in es if "im:rating" in e]
        if not es:
            break
        for e in es:
            out.append({"rating": int(e["im:rating"]["label"]), "title": e["title"]["label"],
                        "body": e["content"]["label"], "date": e.get("updated", {}).get("label", "")[:10]})
        time.sleep(1)
    return out


def main():
    path = os.path.join(HERE, "survey.json")
    data = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {"terms": {}, "apps": {}}
    for t in TERMS:
        if t not in data["terms"]:
            res = search(t)
            data["terms"][t] = [r["trackId"] for r in res]
            for r in res:
                data["apps"].setdefault(str(r["trackId"]), {
                    "id": r["trackId"], "name": r["trackName"], "seller": r.get("sellerName", ""),
                    "price": r.get("formattedPrice", ""), "rating_count": r.get("userRatingCount", 0),
                    "rating": round(r.get("averageUserRating", 0), 2), "released": r.get("releaseDate", "")[:10],
                    "updated": r.get("currentVersionReleaseDate", "")[:10]})
            json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            time.sleep(2)
    # 検索の上位20には出ないが、有料で売れている実例(D_報告.md)
    if "extra" not in data:
        r = json.loads(get("https://itunes.apple.com/lookup?country=jp&id=1362509132"))["results"][0]
        data["extra"] = [r["trackId"]]
        data["apps"][str(r["trackId"])] = {"id": r["trackId"], "name": r["trackName"], "seller": r.get("sellerName", ""),
            "price": r.get("formattedPrice", ""), "rating_count": r.get("userRatingCount", 0), "rating": round(r.get("averageUserRating", 0), 2),
            "released": r.get("releaseDate", "")[:10], "updated": r.get("currentVersionReleaseDate", "")[:10]}
    for k, a in data["apps"].items():
        if not a.get("iap"):
            a["iap"] = iap(k); time.sleep(1.5)
        if "reviews" not in a:
            a["reviews"] = reviews(k); time.sleep(1)
        json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("ok", a["name"], len(a["reviews"]), a["iap"] and len(a["iap"]))
    report(data)


# 食材・在庫の管理アプリではないもの(レシピ・献立・カレンダー・整理ゲーム・コレクション管理)は不満の集計から外す
OFFTOPIC = r"macaroni|クラシル|Treeカレンダー|meek|Fill The Fridge|Fill Up Fridge|冷蔵庫整理 3D|me:new|pecco|レピモ|らくらく献立|Harapeko|A!Spoon|3秒献立|monoca|おかいものメモ|フリレコ"


def classify(text):
    return [c for c, rx in CATS.items() if re.search(rx, text)]


def report(data):
    L = []
    tot = collections.Counter(); low = collections.Counter(); nlow = 0; nall = 0
    samples = collections.defaultdict(list)
    for a in data["apps"].values():
        if re.search(OFFTOPIC, a["name"]):
            a["offtopic"] = True
            continue
        for r in a["reviews"]:
            cs = classify(r["title"] + " " + r["body"])
            nall += 1
            for c in cs:
                tot[c] += 1
            if r["rating"] <= 3:
                nlow += 1
                for c in cs:
                    low[c] += 1
                    if len(samples[c]) < 6 and len(r["body"]) < 140 and sum(1 for x in samples[c] if x.startswith(a['name'][:16])) < 2:
                        samples[c].append(f"{a['name'][:16]} ★{r['rating']}「{r['body'].replace(chr(10), ' ')[:90]}」")
    for a in data["apps"].values():
        a["complaints"] = collections.Counter(c for r in a["reviews"] if r["rating"] <= 3 for c in classify(r["title"] + " " + r["body"]))
    for t, ids in data["terms"].items():
        L.append(f"\n### 「{t}」上位{len(ids)}本\n")
        L.append("| 順位 | アプリ | 本体価格 | アプリ内課金(主なもの) | 評価件数 | 平均 | 公開 | 低評価(★3以下)の主な不満 |")
        L.append("|---|---|---|---|---|---|---|---|")
        for i, k in enumerate(ids, 1):
            a = data["apps"][str(k)]
            ia = a.get("iap")
            ias = "取得失敗" if ia is None else ("なし" if not ia else "・".join(f"{n[:14]} {p}" for n, p in ia[:4]))
            cm = "・".join(f"{c}{n}" for c, n in a["complaints"].most_common(3)) or "-"
            L.append(f"| {i} | {a['name'][:28].replace('|', '/')} | {a['price']} | {ias.replace('|', '/')} | {a['rating_count']:,} | {a['rating']} | {a['released'][:4]} | {cm} |")
    ex = data.get("extra", [])
    if ex:
        L.append("\n### 検索上位20に出ない有料の実例\n")
        L.append("| アプリ | 本体価格 | アプリ内課金 | 評価件数 | 平均 | 公開 | 低評価の主な不満 |")
        L.append("|---|---|---|---|---|---|---|")
        for k in ex:
            a = data["apps"][str(k)]
            ias = "・".join(f"{n[:14]} {p}" for n, p in (a.get("iap") or [])[:4]) or "なし"
            cm = "・".join(f"{c}{n}" for c, n in a["complaints"].most_common(3)) or "-"
            L.append(f"| {a['name']} | {a['price']} | {ias} | {a['rating_count']:,} | {a['rating']} | {a['released'][:4]} | {cm} |")
    napps = sum(1 for a in data["apps"].values() if not a.get("offtopic"))
    L.append(f"\n### 不満の分類(食材・在庫の管理アプリ {napps}本の最新レビュー 計{nall}件、うち★3以下 {nlow}件。レシピ・献立・整理ゲーム・カレンダーは除外)\n")
    L.append("| 不満 | ★3以下で触れた件数 | ★3以下に占める割合 | 全レビューで触れた件数 |")
    L.append("|---|---|---|---|")
    for c in CATS:
        L.append(f"| {c} | {low[c]} | {low[c] * 100 / max(1, nlow):.0f}% | {tot[c]} |")
    L.append("\n### 低評価レビューの例(原文の抜粋)\n")
    for c in CATS:
        for s in samples[c][:4]:
            L.append(f"- [{c}] {s}")
    open(os.path.join(HERE, "survey.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
    print("report", nall, nlow, dict(low))


if __name__ == "__main__":
    main()
