"""ブラウザで実際に押して回る確認。python scripts/e2e.py
- dist(製品ビルド)を http で開く: 登録・期限・使い切り/捨てた・買い物メモ・共有ファイル・無料の上限・課金画面(準備中)
- dist-e2e(--mode e2e。疑似購入あり)を開く: 購入→完全版の機能(テーマ・通知・分類・CSV)
画面写真は scripts/e2e_out/ に置く。サーバーは自分で起こし、最後に自分で止める。"""
import json
import os
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


def shot(page, name, full=False):
    page.wait_for_timeout(350)  # 板の出てくる動きが終わってから撮る
    page.screenshot(path=os.path.join(OUT, name + ".png"), full_page=full)


def names(page):
    return page.locator(".item .item-name").all_inner_texts()


def wait_toast_gone(page):
    # お知らせは押すと閉じる
    if page.locator(".toast").count():
        page.locator(".toast-text").click()
    page.wait_for_selector(".toast", state="detached")


def prod_flow(p, url):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", accept_downloads=True)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append("prod: " + m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("prod: " + str(e)))

    # 1. はじめて開いた所
    page.goto(url)
    page.wait_for_selector(".home")
    shot(page, "01_home_empty")
    check(page.locator("text=冷蔵庫はまだ空です。").count() == 1, "初回は空の説明が出る")
    check(page.locator(".qchip").count() >= 8, "ワンタップの食材が8つ以上並ぶ")

    # 2. ワンタップ登録(1タップ)
    page.locator(".qchip", has_text="牛乳").first.click()
    taps["ワンタップ"] = 1
    page.wait_for_selector(".item")
    check(names(page) == ["牛乳"], "牛乳が1タップで入る")
    check("あと7日" in page.locator(".item .left").first.inner_text(), "目安の7日が入る")
    check(page.locator(".toast", has_text="牛乳を入れました").count() == 1, "入れたお知らせが出る")
    shot(page, "02_after_one_tap")
    # 日付を直す → 明日(2タップ)
    page.click(".toast >> text=日付を直す")
    page.wait_for_selector(".date-sheet")
    shot(page, "03_date_sheet")
    page.click(".qd >> text=明日")
    page.wait_for_selector(".date-sheet", state="detached")
    check(page.locator(".item .left").first.inner_text() == "明日まで", "早押しで明日に変わる")
    wait_toast_gone(page)

    # 3. まとめて入れる: 卵×2・豆腐・もやし。豆腐は袋の日付(月→日)
    page.click(".fab")
    page.wait_for_selector(".add")
    for n in ["卵", "卵", "豆腐", "もやし"]:
        page.locator(".tile", has_text=n).first.click()
    check(page.locator(".tray-row").count() == 3, "カゴは3行(卵は1行で2個)")
    check(page.locator(".tray-row", has_text="卵").locator(".stepper b").inner_text() == "2", "卵は2個")
    page.locator(".tray-row", has_text="豆腐").locator(".date-chip").click()
    page.wait_for_selector(".date-sheet")
    # 今月の(今日から)4日後の日を押す
    target = page.evaluate("""() => { const d = new Date(); d.setDate(d.getDate() + 4); return [d.getMonth() + 1, d.getDate()]; }""")
    page.locator(".mo", has_text=f"{target[0]}月").first.click()
    page.locator(".dy", has_text=str(target[1])).filter(has_text=__import__("re").compile(f"^{target[1]}$")).first.click()
    page.wait_for_selector(".date-sheet", state="detached")
    check("あと4日" in page.locator(".tray-row", has_text="豆腐").locator(".date-chip").inner_text(), "月→日の2回で袋の日付が入る")
    shot(page, "04_tray")
    page.click(".tray-bar .btn.primary")
    page.wait_for_selector(".home")
    check(sorted(names(page)) == sorted(["牛乳", "卵 ×2", "豆腐", "もやし"]), f"まとめて4品が入る: {names(page)}")
    wait_toast_gone(page)
    shot(page, "05_home_list")
    # 期限が近い順
    lefts = page.locator(".item .left").all_inner_texts()
    check(lefts[0] == "明日まで", f"いちばん上は期限の近い物: {lefts}")

    # 4. 新しい食材を作って入れる(3タップ+名前)
    page.click(".fab")
    page.fill(".search input", "手作りプリン")
    page.click(".tile.new")
    page.wait_for_selector(".sheet >> text=新しい食材")
    page.click(".sheet .cat >> text=2日")
    page.click(".sheet .cat >> text=惣菜・パン")
    page.click("text=作ってカゴに入れる")
    check(page.locator(".tray-row", has_text="手作りプリン").count() == 1, "新しい食材がカゴに入る")
    page.click(".tray-bar .btn.primary")
    page.wait_for_selector(".home")
    check("手作りプリン" in names(page), "新しい食材が冷蔵庫に入る")
    wait_toast_gone(page)

    # 5. 前回と同じ
    page.click(".fab")
    page.click("text=前回と同じ")
    check([t.strip() for t in page.locator(".tray-name").all_inner_texts()] == ["手作りプリン"], "前回と同じで、前回の品がカゴに戻る")
    check(page.locator(".tile", has_text="手作りプリン").count() == 1, "作った食材がタイルに並ぶ")
    page.click(".topbar .icon")
    page.wait_for_selector(".home")

    # 6. 捨てた → もったいない額 → 買い物メモへ
    page.locator(".item", has_text="牛乳").click()
    page.wait_for_selector(".sheet")
    shot(page, "06_item_sheet")
    page.click(".btn.wasted")
    check(page.locator(".toast", has_text="230円").count() == 1, "捨てた額がお知らせに出る")
    page.click(".toast >> text=買い物メモへ")
    check("牛乳" not in names(page), "捨てた牛乳は一覧から消える")
    wait_toast_gone(page)

    # 7. 卵を1個だけ使い切る
    page.locator(".item", has_text="卵").click()
    page.click(".is-qty button[aria-label=減らす]")
    page.click(".btn.used")
    check("卵" in names(page), "卵は1個残る")
    wait_toast_gone(page)

    # 8. 記録
    page.click(".tab >> text=記録")
    page.wait_for_selector(".log-hero")
    check(page.locator(".log-yen b").inner_text() == "230円", "記録のもったいない額 230円")
    check("使い切り率 50%" in page.locator(".log-sub").inner_text(), "使い切り率 50%")
    shot(page, "07_log")

    # 9. 買い物メモ → 買えた物を冷蔵庫へ
    page.click(".tab >> text=買い物")
    page.wait_for_selector(".shop")
    check(page.locator(".shop-row", has_text="牛乳").count() == 1, "捨てた牛乳が買い物メモにある")
    page.fill(".shop-add input", "バナナ")
    page.click(".shop-add .btn")
    page.locator(".shop-row", has_text="牛乳").click()
    page.locator(".shop-row", has_text="バナナ").click()
    shot(page, "08_shop")
    page.click("text=買えた2品を冷蔵庫に入れる")
    page.wait_for_selector(".add")
    check(page.locator(".tray-row").count() == 2, "買えた2品がカゴに入る")
    page.click(".tray-bar .btn.primary")
    page.wait_for_selector(".home")
    check("牛乳" in names(page) and "バナナ" in names(page), "買えた物が冷蔵庫に入る")
    wait_toast_gone(page)

    # 10. 置き場所で絞る
    page.click(".pl >> text=常温")
    check(names(page) == ["バナナ"], f"常温はバナナだけ: {names(page)}")
    page.click(".pl >> text=すべて")

    # 11. 共有ファイルを送る/受け取る
    page.click(".tab >> text=設定")
    page.wait_for_selector(".settings")
    shot(page, "09_settings", full=True)
    with page.expect_download() as dl:
        page.click("button:text-is(\"送る\")")
    path = dl.value.path()
    share = json.load(open(path, encoding="utf-8"))
    check(share["kind"] == "share" and len(share["items"]) == 6, f"共有ファイルに6品: {len(share['items'])}")
    # 家族の端末で「ハム」を足し、バナナを使い切ったことにする
    ham = dict(share["items"][0]); ham.update(id="family1", name="ハム", expiry="2030-01-01", updatedAt="2030-01-01T00:00:00.000Z")
    banana = [i for i in share["items"] if i["name"] == "バナナ"][0]
    share["items"] = [i for i in share["items"] if i["name"] != "バナナ"] + [ham]
    share["deleted"].append(banana["id"])
    fam = os.path.join(OUT, "_family_share.json")
    json.dump(share, open(fam, "w", encoding="utf-8"), ensure_ascii=False)
    page.set_input_files("[data-testid=file-in]", fam)
    page.wait_for_selector(".toast >> text=取り込みました")
    check("新しく1品" in page.locator(".toast").inner_text() and "消えた品1品" in page.locator(".toast").inner_text(), "共有ファイルの取り込み: 足す1・消す1")
    wait_toast_gone(page)

    # 12. 無料の機能から課金画面へ(キーが空なので「購入は準備中です」)
    page.click(".row .cat >> text=当日")
    page.wait_for_selector(".paywall")
    shot(page, "10_paywall_prod", full=True)
    check(page.locator("text=購入は準備中です").count() == 1, "キーが空なら「購入は準備中です」")
    check(page.locator(".pw-cta .btn").first.is_disabled(), "準備中のボタンは押せない")
    check(page.locator("text=開発用").count() == 0, "製品ビルドに開発用の欄は無い")
    page.click(".topbar .icon")
    page.wait_for_selector(".settings")
    check(page.locator("text=開発用").count() == 0, "設定に開発用の欄が出ない")

    # 13. 開き直しても残る
    page.reload()
    page.wait_for_selector(".home")
    check(sorted(names(page)) == sorted(["卵", "豆腐", "もやし", "手作りプリン", "牛乳", "ハム"]), f"開き直しても残る: {names(page)}")

    # 14. 無料の上限 30品
    page.click(".fab")
    tiles = page.locator(".tile:not(.new)")
    for i in range(26):
        tiles.nth(i + 6).click()
    page.click(".tray-bar .btn.primary")
    page.wait_for_selector(".toast >> text=30品までです")
    check(page.locator(".tray-row").count() == 2, "入りきらない2品はカゴに残る")
    shot(page, "11_limit")
    page.click(".toast >> text=完全版を見る")
    page.wait_for_selector(".paywall")
    page.click(".topbar .icon")
    b.close()


def premium_flow(p, url):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="ja-JP", accept_downloads=True)
    page = ctx.new_page()
    page.on("console", lambda m: errors.append("e2e: " + m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append("e2e: " + str(e)))
    page.goto(url + "?demo=1&premium=0")
    page.wait_for_selector(".item")
    shot(page, "20_demo_home")
    check(page.locator(".sum.today b").inner_text() == "1", "見本: 今日まで 1品")
    page.click(".tab >> text=設定")
    page.click(".pro-card")
    page.wait_for_selector(".paywall")
    page.click(".pw-cta .btn.primary")
    page.wait_for_selector(".toast >> text=完全版になりました")
    page.wait_for_selector(".settings")
    check(page.locator(".pro-card.on").count() == 1, "買うと完全版になる")
    # 通知: 当日も足す・時刻
    page.click(".row .cat >> text=当日")
    check(page.locator(".row .cat.on").count() >= 2, "当日と前日を両方選べる")
    page.fill("input.time", "19:30")
    # テーマ
    page.click(".cat >> text=夜(暗い)")
    check(page.evaluate("document.documentElement.dataset.theme") == "night", "テーマが変わる")
    shot(page, "21_settings_night", full=True)
    # 分類を足す
    page.locator(".row", has_text="分類").locator(".btn").click()
    page.fill(".sheet input", "お菓子")
    page.click(".sheet .btn.primary")
    check(page.locator(".toast", has_text="お菓子").count() == 1, "分類を足せる")
    # CSV
    with page.expect_download() as dl:
        page.click("text=中身をCSV")
    csv = open(dl.value.path(), encoding="utf-8-sig").read()
    check(csv.startswith("名前,分類,置き場所,期限") and "ひき肉" in csv, "CSV を書き出せる")
    page.click(".cat >> text=キッチン")
    # 上限なし: 31品目が入る
    page.click(".tab >> text=冷蔵庫")
    page.click(".fab")
    tiles = page.locator(".tile:not(.new)")
    for i in range(20):
        tiles.nth(i).click()
    page.click(".tray-bar .btn.primary")
    page.wait_for_selector(".home")
    total = int(page.locator(".sum.total b").inner_text())
    check(total > 30, f"完全版は30品を超えて入る: {total}")
    # 記録の画面(見本)
    page.click(".tab >> text=記録")
    page.wait_for_selector(".log-hero")
    shot(page, "22_log_demo", full=True)
    b.close()


if __name__ == "__main__":
    import socket

    def free_port():
        with socket.socket() as so:
            so.bind(("127.0.0.1", 0))
            return so.getsockname()[1]
    # 決まった番号だと、ほかの作業が同じ番号でサーバーを立てていることがある(実際に5391は塞がっていた)
    P1, P2 = free_port(), free_port()
    s1 = serve("dist", P1)
    s2 = serve("dist-e2e", P2)
    try:
        time.sleep(1.2)
        with sync_playwright() as p:
            prod_flow(p, f"http://127.0.0.1:{P1}/")
            premium_flow(p, f"http://127.0.0.1:{P2}/")
    except Exception:
        print("console errors so far:", errors)
        raise
    finally:
        s1.terminate(); s2.terminate()
    print("console errors:", errors)
    print("taps:", taps)
    if errors:
        fails.append("console error")
    print("RESULT", "PASS" if not fails else f"FAIL {len(fails)}: {fails}")
    sys.exit(1 if fails else 0)
