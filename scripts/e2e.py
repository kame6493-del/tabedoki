"""ブラウザで実際に押して回る確認。python scripts/e2e.py(先に npm run build と npm run build:e2e)
- dist(製品ビルド)を http で開く: 登録・期限・使い切り/捨てた(押す・ずらす)・買い物メモ・共有ファイル(確かめてから合わせる)・
  無料の上限・課金画面(準備中)・古い保存データのテーマの読み替え
- dist-e2e(--mode e2e。疑似購入あり)を開く: 購入→完全版の機能(テーマ・通知・分類・CSV・31品以上)
- 全画面を 375 幅と 430 幅で撮る(scripts/e2e_out/w375・w430)。横にはみ出していないかも測る
サーバーは自分で起こし、最後に自分で止める。"""
import json
import os
import re
import socket
import subprocess
import sys
import time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "e2e_out")
os.makedirs(OUT, exist_ok=True)
fails, errors = [], []
taps = {}


def check(cond, msg):
    print(("OK  " if cond else "NG  ") + msg)
    if not cond:
        fails.append(msg)


def serve(dirname, port):
    return subprocess.Popen([sys.executable, os.path.join(ROOT, "scripts", "serve.py"), os.path.join(ROOT, dirname), str(port)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def shot(page, name, full=False, sub=""):
    page.wait_for_timeout(380)  # 板の出てくる動きが終わってから撮る
    d = os.path.join(OUT, sub) if sub else OUT
    os.makedirs(d, exist_ok=True)
    page.screenshot(path=os.path.join(d, name + ".png"), full_page=full)


def names(page):
    return [t.strip() for t in page.locator(".item .item-name").all_inner_texts()]


def wait_toast_gone(page):
    if page.locator(".toast").count():
        page.locator(".toast-text").click()
    page.wait_for_selector(".toast", state="detached")


def no_overflow(page, label):
    w = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check(w[0] <= w[1], f"{label}: 横にはみ出していない ({w[0]} <= {w[1]})")


def watch(page, tag):
    page.on("console", lambda m: errors.append(f"{tag}: " + m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"{tag}: " + str(e)))


def prod_flow(p, url):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", accept_downloads=True)
    page = ctx.new_page()
    watch(page, "prod")

    # 1. はじめて開いた所
    page.goto(url)
    page.wait_for_selector(".home")
    shot(page, "01_home_empty")
    check(page.locator("text=冷蔵庫はまだ空です。").count() == 1, "初回は空の説明が出る")
    check(page.locator(".qchip:not(.more)").count() == 8, "ワンタップの食材が8つ並ぶ")
    check(page.locator(".home-head img.logo").count() == 1, "上に題字(新しいアイコンの字)が出る")
    check(page.locator(".tabbar .tab").all_inner_texts() == ["ホーム", "買い物", "統計", "共有", "その他"], "下のタブは5つ(見本のカレンダーは無い機能なので出さない)")
    imgs = page.evaluate("() => [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src)")
    check(not imgs, f"絵が全部読めている: {imgs}")

    # 2. ワンタップ登録(1タップ)
    page.locator(".qchip", has_text="牛乳").first.click()
    taps["ワンタップ"] = 1
    page.wait_for_selector(".item")
    check(names(page) == ["牛乳"], "牛乳が1タップで入る")
    check(page.locator(".item .status-pill").first.inner_text() == "あと7日", "目安の7日が入る")
    check(page.locator(".item .food-pic img").count() == 1, "牛乳に見本の絵が付く")
    check(page.locator(".toast", has_text="牛乳を入れました").count() == 1, "入れたお知らせが出る")
    shot(page, "02_after_one_tap")
    # 日付を直す → 明日(2タップ)
    page.click(".toast >> text=日付を直す")
    page.wait_for_selector(".date-sheet")
    shot(page, "03_date_sheet")
    page.click(".qd >> text=明日")
    page.wait_for_selector(".date-sheet", state="detached")
    check(page.locator(".item .status-pill").first.inner_text() == "あと1日", "早押しで明日に変わる")
    check("tone-yellow" in page.locator(".item .status-pill").first.get_attribute("class"), "あと1日は黄色の札")
    wait_toast_gone(page)

    # 3. ほかの食材を1品(3タップ: 食材を追加 → 食材 → この内容で追加)
    page.click(".home-add")
    page.wait_for_selector(".add")
    page.locator(".tile", has_text="ヨーグルト").first.click()
    page.click(".tray-bar .btn.primary")
    page.wait_for_selector(".home")
    taps["ほかの食材1品"] = 3
    check("ヨーグルト" in names(page), "ほかの食材が3タップで入る")
    wait_toast_gone(page)

    # 4. まとめて入れる: 卵×2・豆腐・もやし。豆腐は袋の日付(月→日)
    page.click(".home-add")
    page.wait_for_selector(".add")
    for n in ["卵", "卵", "豆腐", "もやし"]:
        page.locator(".tile", has_text=n).first.click()
    check(page.locator(".tile.in", has_text="卵").locator(".tile-n").inner_text() == "2", "同じ食材は押した回数が個数")
    page.click(".add-tabs button >> text=まとめて入れる")
    check(page.locator(".tray-row").count() == 3, "カゴは3行(卵は1行で2個)")
    check(page.locator(".tray-row", has_text="卵").locator(".stepper b").inner_text() == "2", "卵は2個")
    page.locator(".tray-row", has_text="豆腐").locator(".date-chip").click()
    page.wait_for_selector(".date-sheet")
    target = page.evaluate("""() => { const d = new Date(); d.setDate(d.getDate() + 4); return [d.getMonth() + 1, d.getDate()]; }""")
    page.locator(".mo", has_text=f"{target[0]}月").first.click()
    page.locator(".dy").filter(has_text=re.compile(f"^{target[1]}$")).first.click()
    page.wait_for_selector(".date-sheet", state="detached")
    check("あと4日" in page.locator(".tray-row", has_text="豆腐").locator(".date-chip").inner_text(), "月→日の2回で袋の日付が入る")
    shot(page, "04_tray")
    page.click(".tray-bar .btn.primary")
    page.wait_for_selector(".home")
    check(sorted(names(page)) == sorted(["牛乳", "ヨーグルト", "卵 ×2", "豆腐", "もやし"]), f"まとめて4品が入る: {names(page)}")
    wait_toast_gone(page)
    shot(page, "05_home_list")
    first = page.locator(".items .item").first
    check(first.locator(".item-name").inner_text() == "牛乳", "いちばん上は期限の近い物(牛乳 あと1日)")
    check(page.locator(".list-card.near .count-badge").inner_text() == "2", "期限が近いもの(2日以内)は2品: 牛乳・もやし")

    # 5. 新しい食材を作って入れる
    page.click(".home-add")
    page.fill(".search input", "手作りプリン")
    page.click(".tile.new")
    page.wait_for_selector(".sheet >> text=新しい食材")
    page.click(".sheet .cat >> text=2日")
    page.click(".sheet .cat >> text=惣菜・パン")
    page.click("text=作ってカゴに入れる")
    check(page.locator(".tile.in", has_text="手作りプリン").count() == 1, "新しい食材がカゴに入る")
    page.click(".tray-bar .btn.primary")
    page.wait_for_selector(".home")
    check("手作りプリン" in names(page), "新しい食材が冷蔵庫に入る")
    check(page.locator(".item", has_text="手作りプリン").locator(".cat-pic").count() == 1, "絵の無い食材には分類の絵が出る")
    wait_toast_gone(page)

    # 6. 前回と同じ(3タップ: 食材を追加 → 前回と同じ → この内容で入れる)
    page.click(".home-add")
    page.click(".add-tabs button >> text=前回と同じ")
    check([t.strip() for t in page.locator(".last-name").all_inner_texts()] == ["手作りプリン"], "前回と同じに前回の品が並ぶ")
    check(page.locator(".last-sel b").inner_text() == "1件", "選択中 1件")
    page.locator(".last-row .toggle").first.click()
    check(page.locator(".tray-bar .btn.primary").is_disabled(), "全部外すと入れられない")
    page.locator(".last-row .toggle").first.click()
    page.click(".tray-bar .btn.primary")
    page.wait_for_selector(".home")
    taps["前回と同じ"] = 3
    check(len([n for n in names(page) if n.startswith("手作りプリン")]) == 2, "前回と同じで、もう1つ入る")
    wait_toast_gone(page)
    # 2つ目のプリンは消す(以後の数を変えないため)
    page.locator(".item", has_text="手作りプリン").last.click()
    page.click("text=間違えたので消す")
    wait_toast_gone(page)

    # 7. 捨てた → ムダ金額 → 買い物メモへ
    page.locator(".item", has_text="牛乳").click()
    page.wait_for_selector(".item-sheet")
    shot(page, "06_item_sheet")
    page.click(".item-sheet .btn.wasted")
    check(page.locator(".toast", has_text="230円").count() == 1, "捨てた額がお知らせに出る")
    page.click(".toast >> text=買い物メモへ")
    check("牛乳" not in names(page), "捨てた牛乳は一覧から消える")
    wait_toast_gone(page)

    # 8. 卵を1個だけ使い切る(買い物メモに入れる を付けて)
    page.locator(".item", has_text="卵").click()
    page.click(".is-qty button[aria-label=減らす]")
    page.check(".check-row input")
    page.click(".item-sheet .btn.used")
    check("卵" in names(page), "卵は1個残る")
    check(page.locator(".toast", has_text="買い物メモにも入れました").count() == 1, "買い物メモに入れる が効く")
    wait_toast_gone(page)

    # 9. 左にずらして「使い切った」(ヨーグルト)
    row = page.locator(".swipe", has_text="ヨーグルト")
    box = row.bounding_box()
    y = box["y"] + box["height"] / 2
    page.mouse.move(box["x"] + box["width"] - 30, y)
    page.mouse.down()
    for k in range(1, 11):
        page.mouse.move(box["x"] + box["width"] - 30 - k * 18, y)
    page.mouse.up()
    page.wait_for_timeout(250)
    check(page.locator(".swipe.open").count() == 1, "左にずらすとボタンが出る")
    shot(page, "07_swipe")
    page.locator(".swipe.open .sw.used").click()
    check("ヨーグルト" not in names(page), "ずらして使い切った")
    wait_toast_gone(page)

    # 10. ムダ管理
    page.click(".tab >> text=統計")
    page.wait_for_selector(".log-hero")
    check(page.locator(".log-yen b").inner_text() == "¥230", "今月のムダ金額 ¥230")
    check("使い切り率 67%" in page.locator(".log-sub").inner_text(), f"使い切り率 67%(卵1・ヨーグルト1/牛乳を捨てた): {page.locator('.log-sub').inner_text()}")
    check(page.locator(".vcol").count() == 6, "6か月の棒")
    shot(page, "08_log")

    # 11. 買い物メモ → 買えた物を冷蔵庫へ
    page.click(".tab >> text=買い物")
    page.wait_for_selector(".shop")
    check(page.locator(".shop-row", has_text="牛乳").count() == 1, "捨てた牛乳が買い物メモにある")
    check(page.locator(".shop-row", has_text="卵").count() == 1, "使い切った卵も買い物メモにある")
    page.fill(".shop-add input", "バナナ")
    page.click(".shop-add .btn")
    page.fill(".shop-add input", "洗剤")
    page.click(".shop-add .btn")
    check(page.locator(".sf", has_text="手入力").locator("i").inner_text() == "1", "手入力は1件(洗剤)")
    page.click(".sf >> text=手入力")
    check(page.locator(".shop-row").count() == 1, "手入力だけに絞れる")
    page.click(".sf >> text=すべて")
    page.locator(".shop-row", has_text="牛乳").click()
    page.locator(".shop-row", has_text="バナナ").click()
    check(page.locator(".shop-done").count() == 1, "買えた物があると「おつかれさま」が出る")
    shot(page, "09_shop")
    page.click("text=買えた2品を冷蔵庫に入れる")
    page.wait_for_selector(".add")
    check(page.locator(".tray-row").count() == 2, "買えた2品がカゴに入る(まとめて入れるが開く)")
    page.click(".tray-bar .btn.primary")
    page.wait_for_selector(".home")
    check("牛乳" in names(page) and "バナナ" in names(page), "買えた物が冷蔵庫に入る")
    wait_toast_gone(page)

    # 12. 置き場所で絞る
    page.click(".pl >> text=常温")
    check(names(page) == ["バナナ"], f"常温はバナナだけ: {names(page)}")
    page.click(".pl >> text=すべて")

    # 13. 共有ファイルを送る/確かめてから合わせる
    page.click(".tab >> text=共有")
    page.wait_for_selector(".share")
    shot(page, "10_share")
    with page.expect_download() as dl:
        page.click("text=共有ファイルを送る")
    share = json.load(open(dl.value.path(), encoding="utf-8"))
    check(share["kind"] == "share" and len(share["items"]) == 6, f"共有ファイルに6品: {len(share['items'])}")
    ham = dict(share["items"][0]); ham.update(id="family1", name="ハム", expiry="2030-01-01", updatedAt="2030-01-01T00:00:00.000Z")
    banana = [i for i in share["items"] if i["name"] == "バナナ"][0]
    share["items"] = [i for i in share["items"] if i["name"] != "バナナ"] + [ham]
    share["deleted"].append(banana["id"])
    share["from"] = "ママのスマホ"
    fam = os.path.join(OUT, "_family_share.json")
    json.dump(share, open(fam, "w", encoding="utf-8"), ensure_ascii=False)
    page.set_input_files("[data-testid=file-in]", fam)
    page.wait_for_selector(".merge-sheet")
    check(page.locator(".mf-sum b").all_inner_texts() == ["1品", "0品", "1品"], f"取り込みの前に 新しく1・更新0・消える1 を見せる: {page.locator('.mf-sum b').all_inner_texts()}")
    check(page.locator(".merge-sheet", has_text="ママのスマホ").count() == 1, "誰からのファイルか出る")
    shot(page, "11_merge")
    page.click("text=この内容で合わせる")
    page.wait_for_selector(".toast >> text=取り込みました")
    check("新しく1品" in page.locator(".toast").inner_text() and "消えた品1品" in page.locator(".toast").inner_text(), "共有ファイルの取り込み: 足す1・消す1")
    wait_toast_gone(page)

    # 14. 無料の機能から課金画面へ(製品ビルドの購入の状態を見る)
    page.click(".tab >> text=その他")
    page.wait_for_selector(".settings")
    shot(page, "12_settings", full=True)
    check(page.locator("text=開発用").count() == 0, "製品ビルドに開発用の欄は無い")
    page.click(".list-row >> text=お知らせの日と時刻")
    page.click(".sheet .cat >> text=当日")
    page.wait_for_selector(".paywall")
    shot(page, "13_paywall_prod", full=True)
    cta = page.locator(".pw-cta .btn").first
    check(cta.is_disabled() and "準備中" in cta.inner_text(), f"ブラウザの製品ビルドでは購入ボタンは押せない(準備中): {cta.inner_text()}")
    check(page.locator(".pw-price").inner_text() == "¥500", "値段の表示 ¥500(ストアから取れないときの目安)")
    page.click(".topbar .back")
    page.wait_for_selector(".settings")

    # 15. 開き直しても残る
    page.reload()
    page.wait_for_selector(".home")
    check(sorted(names(page)) == sorted(["卵", "豆腐", "もやし", "手作りプリン", "牛乳", "ハム"]), f"開き直しても残る: {names(page)}")

    # 16. 無料の上限 30品
    page.click(".home-add")
    tiles = page.locator(".tile:not(.new)")
    for i in range(26):
        tiles.nth(i + 6).click()
    page.click(".tray-bar .btn.primary")
    page.wait_for_selector(".toast >> text=30品までです")
    check(page.locator(".tray-row").count() == 2, "入りきらない2品はカゴに残る(まとめて入れるに切り替わる)")
    shot(page, "14_limit")
    page.click(".toast >> text=完全版を見る")
    page.wait_for_selector(".paywall")
    b.close()


def old_data_flow(p, url):
    """1.0 の保存データ(テーマ night)を入れて開くと、ダークで開き、記録は残る"""
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, locale="ja-JP")
    page = ctx.new_page()
    watch(page, "old")
    page.goto(url)
    page.wait_for_selector(".home")
    old = {"version": 1, "items": [{"id": "i1", "name": "牛乳", "cat": "dairy", "place": "fridge", "expiry": "2030-01-01", "kind": "shomi", "qty": 1, "price": 230, "addedAt": "2026-10-01T00:00:00.000Z", "batch": "b1", "updatedAt": "2026-10-01T00:00:00.000Z"}],
           "presets": [], "cats": [], "places": [], "log": [], "shop": [], "settings": {"notify": True, "notifyTime": "08:00", "notifyDaysBefore": [1], "theme": "night", "fontScale": 1, "defaultPlace": "fridge", "deviceName": ""}, "deleted": []}
    page.evaluate("(v) => localStorage.setItem('CapacitorStorage.tabedoki.v1', v)", json.dumps(old))
    page.reload()
    page.wait_for_selector(".item")
    check(names(page) == ["牛乳"], "1.0 の保存データの品が読める")
    # 無料のときはフレッシュに丸める(買った人は保存されたテーマ=ダークに読み替わる。premium_flow で確かめる)
    check(page.evaluate("document.documentElement.dataset.theme") == "fresh", "無料のときはフレッシュ")
    saved = json.loads(page.evaluate("localStorage.getItem('CapacitorStorage.tabedoki.v1')"))
    check(saved["settings"]["theme"] == "dark", f"保存し直すと theme は night→dark: {saved['settings']['theme']}")
    b.close()


def premium_flow(p, url):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", accept_downloads=True)
    page = ctx.new_page()
    watch(page, "e2e")
    page.goto(url + "?demo=1&premium=0")
    page.wait_for_selector(".item")
    shot(page, "20_demo_home")
    page.click(".tab >> text=その他")
    page.click(".pro-card")
    page.wait_for_selector(".paywall")
    page.click(".pw-cta .btn.primary")
    page.wait_for_selector(".toast >> text=完全版になりました")
    page.wait_for_selector(".settings")
    check(page.locator(".pro-card.on").count() == 1, "買うと完全版になる")
    # 通知: 当日も足す・時刻
    page.click(".list-row >> text=お知らせの日と時刻")
    page.click(".sheet .cat >> text=当日")
    check(page.locator(".sheet .cat.on").count() >= 2, "当日と前日を両方選べる")
    page.fill("input.time", "19:30")
    page.click(".sheet .close")
    check("当日・前日 19:30" in page.locator(".list-row", has_text="お知らせの日と時刻").inner_text(), "設定の行に日と時刻が出る")
    # テーマ
    page.click(".list-row >> text=テーマ")
    page.wait_for_selector(".custom")
    page.click(".theme-card >> text=ダーク")
    check(page.evaluate("document.documentElement.dataset.theme") == "dark", "テーマが変わる")
    shot(page, "21_custom_dark", full=True)
    # 分類を足す
    page.locator(".card", has_text="分類の編集").locator(".btn").click()
    page.fill(".sheet input", "お菓子")
    page.click(".sheet .btn.primary")
    check(page.locator(".toast", has_text="お菓子").count() == 1, "分類を足せる")
    check(page.locator(".chip", has_text="お菓子").count() == 1, "足した分類が並ぶ")
    page.click(".topbar .back")
    # CSV
    page.click(".list-row >> text=CSV書き出し")
    with page.expect_download() as dl:
        page.click("text=冷蔵庫の中身をCSV")
    csv = open(dl.value.path(), encoding="utf-8-sig").read()
    check(csv.startswith("名前,分類,置き場所,期限") and "ひき肉" in csv, "CSV を書き出せる")
    page.click(".sheet .close")
    page.click(".list-row >> text=テーマ")
    page.click(".theme-card >> text=フレッシュ")
    page.click(".topbar .back")
    # 上限なし: 31品目が入る
    page.click(".tab >> text=ホーム")
    page.click(".home-add")
    tiles = page.locator(".tile:not(.new)")
    for i in range(20):
        tiles.nth(i).click()
    page.click(".tray-bar .btn.primary")
    page.wait_for_selector(".home")
    total = int(re.sub(r"\D", "", page.locator(".list-cap").first.inner_text()))
    check(total > 30, f"完全版は30品を超えて入る: {total}")
    b.close()


# ---- 全画面を 375 幅と 430 幅で撮る(見本データ) ----
def screens(p, url, w, h):
    sub = f"w{w}"
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, locale="ja-JP", accept_downloads=True)
    page = ctx.new_page()
    watch(page, sub)

    def s(name, full=False):
        no_overflow(page, f"{sub} {name}")
        shot(page, name, full=full, sub=sub)

    page.goto(url + "?demo=1&premium=0")
    page.wait_for_selector(".item")
    s("01_home")
    s("01b_home_full", full=True)
    page.click(".pl >> text=冷蔵")
    s("01c_home_fridge")
    page.click(".pl >> text=すべて")
    # ずらした所
    row = page.locator(".swipe").nth(2)
    bx = row.bounding_box()
    yy = bx["y"] + bx["height"] / 2
    page.mouse.move(bx["x"] + bx["width"] - 20, yy); page.mouse.down()
    for k in range(1, 11):
        page.mouse.move(bx["x"] + bx["width"] - 20 - k * 18, yy)
    page.mouse.up()
    s("02_home_swipe")
    page.locator(".swipe.open .item").click()
    # 品の板
    page.locator(".item", has_text="ほうれん草").click()
    page.wait_for_selector(".item-sheet")
    s("03_item_sheet")
    page.click(".item-sheet >> text=期限を直す")
    page.wait_for_selector(".date-sheet")
    s("04_date_sheet")
    page.click(".date-sheet .close")
    # 食材を追加
    page.click(".home-add")
    page.wait_for_selector(".add")
    for n in ["牛乳", "卵", "卵", "ヨーグルト"]:
        page.locator(".tile", has_text=n).first.click()
    s("05_add_often")
    page.click(".add-tabs button >> text=まとめて入れる")
    for n in ["食パン", "豆腐", "バナナ"]:
        page.click(".add-tabs button >> text=よく使う食材")
        page.locator(".tile", has_text=n).first.click()
    page.click(".add-tabs button >> text=まとめて入れる")
    s("06_add_tray")
    page.click(".add-tabs button >> text=前回と同じ")
    s("07_add_last")
    page.click(".add-tabs button >> text=よく使う食材")
    page.fill(".search input", "手作りプリン")
    page.click(".tile.new")
    s("08_new_food")
    page.click(".sheet .close")
    page.click(".topbar .close")
    # 買い物メモ(買えた物あり)
    page.goto(url + "?demo=1&premium=0&bought=1")
    page.wait_for_selector(".item")
    page.click(".tab >> text=買い物")
    page.wait_for_selector(".shop-row")
    s("09_shop")
    s("09b_shop_full", full=True)
    # ムダ管理
    page.click(".tab >> text=統計")
    page.wait_for_selector(".log-hero")
    s("10_log")
    s("10b_log_full", full=True)
    page.click(".seg-tabs >> text=食材別")
    s("11_log_food")
    # 共有
    page.click(".tab >> text=共有")
    page.wait_for_selector(".share")
    s("12_share")
    with page.expect_download() as dl:
        page.click("text=共有ファイルを送る")
    share = json.load(open(dl.value.path(), encoding="utf-8"))
    extra = []
    for k, (nm, cat, place) in enumerate([("トマト", "veg", "veg"), ("レタス", "veg", "veg"), ("バナナ", "fruit", "pantry")]):
        it = dict(share["items"][0]); it.update(id=f"fam{k}", name=nm, cat=cat, place=place, presetId="", updatedAt="2030-01-01T00:00:00.000Z")
        extra.append(it)
    gone = share["items"][1]
    share["items"] = share["items"][2:] + extra
    share["deleted"].append(gone["id"])
    share["from"] = "ママのスマホ"
    fam = os.path.join(OUT, f"_family_share_{sub}.json")
    json.dump(share, open(fam, "w", encoding="utf-8"), ensure_ascii=False)
    page.set_input_files("[data-testid=file-in]", fam)
    page.wait_for_selector(".merge-sheet")
    s("13_merge")
    page.click(".merge-sheet >> text=キャンセル")
    # その他(設定)
    page.click(".tab >> text=その他")
    page.wait_for_selector(".settings")
    s("14_settings")
    s("14b_settings_full", full=True)
    page.click(".list-row >> text=お知らせの日と時刻")
    s("15_notify_sheet")
    page.click(".sheet .close")
    page.click(".list-row >> text=このアプリについて")
    s("16_about")
    page.click(".sheet .close")
    page.click(".list-row >> text=テーマ")
    page.wait_for_selector(".custom")
    s("17_custom")
    page.click(".topbar .back")
    page.click(".list-row >> text=食材の目安と値段")
    page.wait_for_selector(".presets")
    s("18_presets")
    page.click(".topbar .back")
    page.click(".pro-card")
    page.wait_for_selector(".paywall")
    s("19_paywall")
    s("19b_paywall_full", full=True)
    # 完全版+ダーク・キッチンブルー・クリームのホーム
    for th in ["dark", "blue", "cream"]:
        page.goto(url + "?demo=1&premium=1")
        page.wait_for_selector(".item")
        page.evaluate("""(th) => { const k = 'CapacitorStorage.tabedoki.v1'; const d = JSON.parse(localStorage.getItem(k)); d.settings.theme = th; localStorage.setItem(k, JSON.stringify(d)); }""", th)
        page.reload()
        page.wait_for_selector(".item")
        s(f"20_home_{th}")
    page.click(".tab >> text=統計")
    page.wait_for_selector(".log-hero")
    s("21_log_cream")
    # 空の冷蔵庫
    page.goto(url + "?demo=1&empty=1&premium=0")
    page.wait_for_selector(".home")
    s("22_home_empty")
    page.click(".tab >> text=買い物")
    s("23_shop_empty")
    b.close()


if __name__ == "__main__":
    def free_port():
        with socket.socket() as so:
            so.bind(("127.0.0.1", 0))
            return so.getsockname()[1]
    # 決まった番号だと、ほかの作業が同じ番号でサーバーを立てていることがある
    only_screens = "--screens" in sys.argv
    procs = []

    def up(dirname):
        # 段ごとに新しいサーバーを起こす(長く回すと、この環境では途中でサーバーが落ちることがあった)
        port = free_port()
        procs.append(serve(dirname, port))
        for _ in range(50):
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                    break
            except OSError:
                time.sleep(0.1)
        return f"http://127.0.0.1:{port}/"
    try:
        with sync_playwright() as p:
            if not only_screens:
                prod_flow(p, up("dist"))
                old_data_flow(p, up("dist"))
                premium_flow(p, up("dist-e2e"))
            screens(p, up("dist-e2e"), 375, 812)
            screens(p, up("dist-e2e"), 430, 932)
    except Exception:
        print("console errors so far:", errors)
        raise
    finally:
        for pr in procs:
            pr.terminate()
    print("console errors:", errors)
    print("taps:", taps)
    if errors:
        fails.append("console error")
    print("RESULT", "PASS" if not fails else f"FAIL {len(fails)}: {fails}")
    sys.exit(1 if fails else 0)
