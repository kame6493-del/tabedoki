# タベドキ(冷蔵庫の賞味期限と食材の管理)公開までの状態

作成 2026-10-03〜04。置き場所: `Downloads\タベドキ_2026-10-03\app\`

## 何を作ったか
- 名前: タベドキ(食べ時の造語)。appId / Bundle ID: `jp.tabedoki.app`
- 値段: 無料+買い切り「完全版」¥500(非消耗型 `tabedoki_full`、RevenueCat の entitlement `full`)。広告なし・アカウントなし・サーバーなし
- 作り: Capacitor 8 + React 19 + Vite + TypeScript + vitest(お手本のニガテ帳と同じ)。保存 @capacitor/preferences、通知 @capacitor/local-notifications、ファイル渡し @capacitor/filesystem + @capacitor/share
- 課金の設定は `src/domain/config.ts` にまとめた。RevenueCat のキーは空 → 購入ボタンは「購入は準備中です」(押せない・落ちない)。疑似購入は `vite dev` と `--mode e2e` の書き出しだけ(製品ビルドからはコードごと消えることを grep で確認)

### 登録の速さ(いちばん大事にした所)
| やりたいこと | 手数 |
|---|---|
| よく買う食材を1品(ホームの「ワンタップで入れる」8品) | 1タップ |
| ほかの食材を1品 | 3タップ(まとめて入れる→食材→入れる) |
| 買い物の後に N 品 | N+2 タップ(同じ食材は押した回数が個数) |
| 前回と同じ買い物 | 3タップ(まとめて入れる→前回と同じ→入れる) |
| 期限を「明日・1週間」などに直す | +2タップ(日付→早押し) |
| 袋の日付を写す | +3タップ(日付→月→日。年は自動) |
| 買い物メモで買えた物を冷蔵庫へ | 2タップ+入れる |

### 機能
- 期限の近い順の一覧(期限切れ/今日/2日以内/1週間/まだ大丈夫で色分け)、置き場所で絞り込み
- 期限前の通知: 同じ朝の品は1通にまとめる。使い切った品の通知は出ない(登録や記録のたびに予約を全部入れ直す)。無料=前日8時、完全版=当日〜1週間前を複数・時刻
- 使い切った/捨てた(個数の一部も可)、取り消し、捨てた額=もったいない額を月ごとに、よく捨てる食材
- 買い物メモ(捨てた・使い切った品から1タップで送る、買えた物をそのまま登録)
- 家族と共有: 共有ファイル(JSON)を OS の共有シートで送り、相手が「受け取る」で合わせる(同じ品は新しい方、消した品は消える)。サーバーなし
- バックアップ保存/戻す(無料。調査で「データが消えた」が不満の10%だったため)
- 完全版: 品数無制限(無料30品)・通知の細かい設定・分類/置き場所の追加・テーマ4種・CSV書き出し

### 期限の目安と出典
- 食材61品の目安日数はタベドキ独自の値(`src/domain/foods.ts`)。消費者庁・農水省・厚労省の公開資料に家庭向けの食品別日数の一覧は見つからなかったので、出典を付けた数字にはしていない。アプリ内とストア説明で「独自の目安・袋の期限が優先」と明記
- 保存温度の前提だけ公的な出典に合わせた: 厚生労働省「家庭でできる食中毒予防の6つのポイント」https://www.mhlw.go.jp/www1/houdou/0903/h0331-1.html 「冷蔵庫は10度C以下、冷凍庫は、−15度C以下に維持することがめやすです」「早めに使いきるようにしましょう」(原文を research/mhlw.html で確認)。アプリ内「食材の目安と値段」に表示
- 外部のデータ・API は使っていない。値段(もったいない額用)は仮の値で、利用者が変えられる

## 1. App Store 調査(2026-10-03、research/)
`research/store_survey.py` で「賞味期限」「冷蔵庫」「食材管理」「在庫管理 食品」の上位20本ずつ(計63本)について、本体価格・アプリ内課金(ストアのページから)・評価件数・最新レビュー最大250件を集めた。全表は `research/survey.md`、生データは `research/survey.json`。

主な数字(「賞味期限」上位):
| 順位 | アプリ | 課金 | 評価件数 | 低評価の主な不満 |
|---|---|---|---|---|
| 1 | リミッター(2015) | 月額¥190・年額¥1,990・全機能解除¥600 ほか | 6,763 | 課金76・登録の手間38・データ消失28 |
| 2 | かうサポ(2017) | 広告非表示¥600 | 982 | - |
| 3 | タベキル(2026) | 月額¥300・年額¥3,000 | 21 | - |
| 4 | Food Timer(2024) | テーマ+広告削除¥500 | 18 | - |
| 8 | 期限! Keep(2018) | 広告非表示¥500 | 109 | - |
| 9 | 賞味期限_(2018) | Pro¥800 | 9 | 共有できない |
| 10 | うちメモ LT(2010) | なし(有料版あり) | 1,601 | 課金14・共有12・データ消失9 |
| 12 | ノコリス(2020) | Pro 月¥270/年¥2,700 | 259 | 通知12 |
| 圏外 | うちメモ 有料版(2018) | 本体¥360 | 780 | 課金19・共有12・データ消失9 |

レビューの不満(食材・在庫の管理アプリ46本、★3以下 775件。レシピ・献立・整理ゲーム・カレンダーは除外):
| 不満 | ★3以下で触れた割合 |
|---|---|
| 課金・サブスク | 17% |
| 登録・入力の手間 | 16% |
| 落ちる・不具合 | 11% |
| データが消えた | 10% |
| 家族と共有できない | 7% |
| 広告 | 6% |
| 通知 | 4% |
| 日付入力 | 3% |

確かめた結果: 「登録の手間」単独では課金(17%)とほぼ並ぶ2位。ただし課金の不満の多くは「上限に達して登録できない」「1件ごとに動画広告」という登録を止められた不満で、登録の手間+日付入力+登録の制限を合わせると 173件/775件=22%で最大。→ 登録の速さを最優先にした判断は合っている。
課金の作りへの反映: 月額をやめて買い切り、広告なし、無料の上限は「同時に30品」を最初からホームに表示(途中で突然止めない)、入りきらない品はカゴに残して消さない。値段は買い切りの実例(¥500×2本・¥600×2本・うちメモ¥360・Pro¥800)の中央の¥500。

## 2. 確かめたこと
1. 単体テスト 30件 全部通過(`npx vitest run`): 日付(月日だけで年を決める・月末)、目安の並び、登録(ワンタップ・同じ食材は個数・まとめて・無料の上限・前回と同じ・手で直した日数の引き継ぎ・新しい食材)、並び順と区分、使い切った/捨てた/一部/取り消し/集計、買い物メモ、通知の予定(まとめ・当日+前日・過去は入れない)、共有ファイルの合わせ方、壊れた保存の読み直し、CSV、バックアップ
2. `npm run build` 通過(tsc + vite)
3. E2E `python scripts/e2e.py`(Playwright。dist と dist-e2e を自分で起こしたサーバーで開く)39項目 全部 OK・console error 0。初回→1タップ登録→日付の早押し→まとめて4品→月→日→新しい食材→前回と同じ→捨てた(230円)→一部だけ使い切り→記録(230円・使い切り率50%)→買い物メモ→買えた物を冷蔵庫へ→置き場所→共有ファイルの送受信(足す1・消す1)→課金画面「購入は準備中です」→開き直し→無料の上限(2品はカゴに残る)。疑似購入の版で購入→通知・テーマ・分類・CSV・31品以上
4. 画面写真を目で確認し、折り返し(設定のボタン・品の板の消すボタン・課金表)、FAB と最終行の重なり、0円の棒の赤い点、置き場所タブのはみ出しを直した。英語の取り残しなし
5. ストア素材 `store/`: icon_1024.png、shot_1〜5.png(1290x2796)、play/icon_512.png・feature_1024x500.png・play_shot_1〜5.png(1080x1920)、listing_appstore.md(名前16字・サブタイトル15字・キーワード61字)、play/listing.md(題名16字・短い説明45字)、play/data_safety.md、play/content_rating.md。作り直しは `python scripts/make_store.py`
6. プライバシーポリシー `store/privacy.md`(端末内保存・収集しない・RevenueCat の記載)

## 3. Android(クローズドテストにすぐ出せる状態)
- `npx cap add android` / `npx cap add ios` / `npx cap sync` 済み。アイコン・起動画面・通知の小アイコンは `python scripts/make_native_assets.py` で作成
- 署名済み AAB: `releases\tabedoki-release.aab`(versionCode 1 / versionName 1.0.0 / targetSdk 36 / minSdk 24)。動作確認用 APK: `releases\tabedoki-release.apk`
- 署名の確認: AAB は `jarsigner -verify` で jar verified、APK は `apksigner verify` 通過。aapt で package=jp.tabedoki.app・表示名タベドキを確認
- 権限: INTERNET・VIBRATE・POST_NOTIFICATIONS・RECEIVE_BOOT_COMPLETED・WAKE_LOCK・SCHEDULE_EXACT_ALARM(通知プラグインが入れる。正確なアラームは使っていない)・BILLING
- 署名鍵: `%LOCALAPPDATA%\TabedokiBuild\signing\tabedoki-upload.jks`(別名 tabedoki-upload)。パスワードは同じフォルダの DPAPI ファイル(このWindowsユーザーだけが復号できる)。PC を替える前にフォルダごと控えること。無くすと Play で「アップロード鍵のリセット」申請になる
- 作り直し: `npm run build` → `npx cap sync` → `powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1`(空いているドライブ文字を subst して英字パスで Gradle を回し、終わったら外す。鍵は作り直さない)。版を上げるときは android/app/build.gradle の versionCode を上げる
- 実機・エミュレーターでの起動確認はしていない(下の「残り」)

## 4. iOS
- Windows では組めないので `.github/workflows/ios-testflight.yml`(ニガテ帳の手順を写し、このアプリの ios/ を指すように直した)と `ios/ExportOptions.plist` を置いた。push はしていない
- Info.plist: 表示名タベドキ、開発言語 ja、暗号化の申告(ITSAppUsesNonExemptEncryption=false)。カメラ・写真・位置は使わないので説明文は不要(通知は OS の確認画面だけで説明文の項目は無い)。MARKETING_VERSION 1.0.0
- シークレット4つ(ASC_KEY_ID・ASC_ISSUER_ID・APPLE_TEAM_ID・ASC_KEY_P8_BASE64)はニガテ帳と同じものを使う

## 残り(持ち主がやること)
1. Play Console でアプリを作る(jp.tabedoki.app)→ アプリ内アイテム tabedoki_full ¥500 → クローズドテストに releases\tabedoki-release.aab を上げる → store/play/ の掲載文・画像・データセーフティ・レーティングを入れる → store/tester_post.txt にグループと参加 URL を入れて募集(12人×14日)
2. プライバシーポリシーとサポートの公開ページ(store/privacy.md を GitHub Pages などに置く)。連絡先の行を埋める
3. RevenueCat にアプリを足し、entitlement "full"・Offering を作って、公開APIキーを src/domain/config.ts の BILLING.revenuecat に入れ、ビルドし直す(キーを入れる前の AAB は購入が「準備中」のまま)
4. iOS: 非公開リポジトリに置いて workflow を compile_only で1回 → App Store Connect でアプリと App内課金を作って TestFlight
5. APK を実機に入れて、通知の許可・時刻どおりの通知・共有シート(LINE で JSON を送る/受け取る)・購入の流れを確かめる(ブラウザの E2E では通知とネイティブの共有は動かせない)

## Google Play(2026-10-04)
- Play Console にアプリを作成: app id 4976219282818450257、名前「タベドキ 賞味期限と冷蔵庫の管理」、jp.tabedoki.app、日本語・アプリ・無料
- プライバシーポリシー: https://kame6493-del.github.io/apps/tabedoki/privacy.html
- クローズドテスト Alpha(トラック 4698231948735856697): 日本・テスター AndroidClosedJP と nigatecho-testers・フィードバック kame6493@gmail.com
- 2026-10-04 審査に送信(14件)。申告: 広告なし/ログイン不要/18歳以上/レーティング3歳以上/データセーフティ=購入履歴のみ/広告ID なし/行政 いいえ/金融なし/健康なし。ストア設定 フード、ドリンク
- 画面写真の並びは自動(play_shot の順に並んでいない可能性)。公開前に確認
- 1.0.1 (vc2): RevenueCat Android キー入り。AAB: C:\Users\yuichi1\Downloads\タベドキ_2026-10-03\app\releases\tabedoki-1.0.1-vc2-release.aab (6.09 MB, 6,386,165 バイト)
