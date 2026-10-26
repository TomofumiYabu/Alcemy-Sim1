# 検証スクリプト

Node／npmはリポジトリ指定版、依存は `npm ci`。追加の実行依存は不要。CloudのChromiumは `/usr/bin/chromium`（変更時は `CHROMIUM_PATH`）。curlと既存のproxy／CAを利用し、TLS検証を維持する。

## 本番ビルドの確認

```sh
VITE_BASE_PATH=/Alcemy-Sim1/ npm run build
VITE_BASE_PATH=/Alcemy-Sim1/ npm run preview -- --host 127.0.0.1 --port 4186 --strictPort
```

別のシェルで以下を実行する。

```sh
node scripts/benchmark.mjs --url http://127.0.0.1:4186/Alcemy-Sim1/ --output .cache/verification/baseline
node scripts/public-smoke.mjs --url http://127.0.0.1:4186/Alcemy-Sim1/ --output .cache/verification/local-smoke
node scripts/visual-check.mjs --url http://127.0.0.1:4186/Alcemy-Sim1/ --output .cache/verification/visual
```

共通引数は `--url`（末尾 `/` 必須）、`--dist`（期待するビルド、既定 `dist`）、`--output`（Git対象外の出力先）。既存の一時ファイルを入力にしない。fixtureは実エンジンから生成し、実セーブ検証を通す。ブラウザーは隔離プロファイルを使い、ユーザーの保存データへ触れない。

## 性能計測

`benchmark.mjs` は1366×768、演出あり、新しいブラウザープロファイルで釜12台＋蒸留器12台で1日を明示確定する（傷薬24＋エキス12、知識36）。営業のclick→描画時間も記録する。20回の画面切替ハンドラから次のrequestAnimationFrameまでを計測し、平均・p95・最大、両製品の完成と24台の継続稼働、通知数、転送量、対象commit・未コミット変更の有無・ビルドHTMLのSHA-256・URL・ブラウザー版・ビルド容量をJSONへ出す。HTMLが期待したdistと一致することも確認する。

変更前後は同じ手順・環境・fixtureで比較する。物理入力遅延、全端末の性能、60fpsの保証ではない。キャッシュはブラウザープロファイルに対して冷たい状態であり、OSやproxyキャッシュは制御していない。出力JSONと画面は指定先へ置く。

## 配信後の確認

```sh
node scripts/public-smoke.mjs --url https://tomofumiyabu.github.io/Alcemy-Sim1/ --output .cache/verification/published
```

配信成功後、検証したPages版のdistを指定して実行する。公開HTML、JS／CSS、favicon、全外部WebPを実際に取得し、各SHA-256をdistと照合する。小さい画像はJS内に含まれることがある。

取得はcurlでTLSを検証し、その応答をChromiumの対象originへ渡す。ローカルdistは照合用であり、公開応答の代用としてブラウザーへ渡さない。Chromium自身の直接HTTPS経路の検証とは区別する。URLが未配信版なら照合失敗で止まる。

PC/モバイルの2営業の一巡と陳列/購買、時計での非進行、移動・購入、日次保存復元と通知非再生、待機タブ引継ぎ、固定v1のschema 3移行と2つのバックアップ、棚から製作用エキスを戻す導線、蒸留器の停止予約、遺跡帰還、店Lv3/知名度100、画像、設定と文字125%を6組で確認する。業務はUIの日送りでだけ進める。テスト時計は通知の期限や実時間放置の非進行確認だけに使う。console／ページ／リクエストエラーを記録し、エラーがあれば失敗する。

取得応答、JSON、画像は出力先へ置き、commitしない。実行ソースとfixture生成はこのディレクトリで追跡する。公開時の確認結果はPROGRESSへ記録する。

## 表示確認

`visual-check.mjs` はローカル本番previewを対象に1440×900／1366×768／390×844／320×740で、標準・125%文字の全4画面（32条件）、モバイル設備シート（4条件）、営業日報（8条件）の計44条件を撮影し、横はみ出し・見出し・ブラウザーエラーを確認する。公開HTTPSの確認はcurl経路を持つpublic-smokeを使う。画面は目視も行い、自動検査だけでデザイン品質や実機タッチを保証しない。200%文字とキーボード・詳細シートはE2Eが担当する。

T1以降、性能・表示・smokeのfixtureは実際の営業コマンドで成長させたschema 3も使う。旧公開版のtimer計測値と、新しい1日確定の測定値は同一シナリオの比較値として扱わない。middlewareの検証用ViteはWebSocketを無効にし、複数スクリプトでもHMRポートを占有しない。
