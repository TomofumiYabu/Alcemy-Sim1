# 進捗・引き継ぎ

最終更新: 2026-10-24（Asia/Tokyo）。現在の段階: M0完了（開発基盤・調査・計画）。次はM1。

## 今回の対象

ユーザーの最初の区切りに合わせ、空のリポジトリを調査し、Cloud専用の開発・検証基盤と仕様案を用意する。ゲーム本体の実装はM1から。

## 完了した作業

- 空リポジトリ、GitHub読み取り接続、CloudのNode.js/npm/Chromium、ネットワークと秘密値の要否を確認。
- React/TypeScript/Vite、strict型検査、exact依存とlockfile、Chromium E2E、npmキャッシュの書込先を設定。
- 開発準備画面を追加。デスクトップ/モバイル向けレイアウトと目標の展開操作を用意。
- `AGENTS.md`、README、調査・仕様案・技術構成・行動計画を作成。
- Cloud設定の `install_script` と `start_skill` を保存済み。保存結果は `status: saved`、`requires_publish: true`。既存のネットワークと認証設定は変更していない。
- 開発基盤をcommit `4606de4`、ルール・仕様・計画を `f7f2a12` に記録。Cloudの作業ブランチ `work` から、空だったリモートの `main` に通常push成功。同期時は `git push origin HEAD:main` を明示する。

## 検証記録

| 確認 | 結果 |
| --- | --- |
| `bash scripts/setup.sh` | 成功。`npm ci` とChromiumの確認。再実行しても依存宣言とlockfileの差分なし |
| `npm run check` 内のstrict型検査 | 成功 |
| 同コマンド内の本番ビルド | 成功 |
| デスクトップChromium E2E | 1件成功 |
| モバイルChromium E2E | 1件成功 |
| `npm run dev` + 実Chromium | HTTP 200、React描画、ページ例外なし。保存した `start_skill` の確認コマンドも再実行して成功 |
| ゲーム状態の単体テスト / プレイ一巡E2E | 未実装・未実行。M1で追加 |

E2Eは準備画面の描画、目標の開閉、再読込、横溢れなし、コンソール/ページエラーなしを検証。最初の実行はfaviconの404で2件失敗し、faviconを追加して再実行した結果が上記の2件成功。未解決の必須検証失敗はない。

Cloud実機は最終確認で `running`、`observations_current: true`。GitHubの読み書きとnpm依存取得を実操作で確認済み。新しいCloudタスクでの復元は未検証で、設定公開の成功もまだ主張しない。

## 次の作業

推奨Goalは **M1を完成させ、最初の研究購入と保存復元までの一巡を自動テストで通す**（詳細は `PLAN.md`）。最初の実装単位はゲーム状態・初期データ・コマンド・tickとVitestの導入。ユーザーからのGoalまたは時間指定に沿って自律的に開発を続ける。

Cloud環境を将来のタスクで使うには、ユーザーが環境設定で保存した `install_script` / `start_skill` を確認・保存して環境をPublishする。設定保存だけでは実行・公開・新規タスクでの復元にはならない。公開後の起動手順は `start_skill` に登録済み。

## 現在の制限

- 現在の画面は準備画面。素材収集、合成、設備配置、販売、研究、保存は未実装。
- 初期ゲームに外部認証情報やユーザーのローカルPC操作は不要。
- Cloud設定の保存・公開・新しいタスクでの復元は別の段階。実際に確認した結果だけを記録する。

## 追加作業: GitHub Pages対応（2026-10-24）

- ユーザーの公開依頼に対応し、`main` pushと手動起動に対応する `.github/workflows/pages.yml` を追加。
- `/Alcemy-Sim1/` 配下に対応するVite設定、Playwrightの接続先、favicon確認を追加。通常の開発パスも維持。
- `npm run check` は通常/Pagesパスの型検査・ビルド・デスクトップ/モバイルE2E計4件が成功。Pages用JS・CSS・faviconの参照先を実ブラウザーで確認。
- 公開方法、初回のPages有効化、失敗時の対応を `docs/DEPLOYMENT.md` に記録。
- GitHub APIへの要求とHTTPS CONNECTがCloudプロキシから403。これはGitHubトークン不足を確認した結果ではない。
- commit `89a7b5e` を `main` にpushし、[初回Actions実行](https://github.com/TomofumiYabu/Alcemy-Sim1/actions/runs/40074910335) を公開Web画面から確認。`build` は45秒で成功、`deploy` は `Configure Pages` でPagesサイト取得404のため失敗。公開予定URLも実要求でHTTP 404を確認。
- Cloud設定の許可先追加案に `api.github.com` と `tomofumiyabu.github.io` を保存済み。既存のプリセット・インストール手順は維持。
- 残作業: ユーザーがGitHubのSettings → PagesでSourceをGitHub Actionsに設定してワークフローを再実行する。あるいはCloudのAPI接続制限を環境設定で反映後、こちらでPagesを設定して再実行する。現在の公開対象は準備画面であり、ゲーム本体の未実装状態は変わらない。
