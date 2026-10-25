# GitHub Pages公開

## 公開対象と状態

公開URL: https://tomofumiyabu.github.io/Alcemy-Sim1/

[PR #4](https://github.com/TomofumiYabu/Alcemy-Sim1/pull/4) のリファクタリングを公開済み。ユーザーの「進めてOK」を受け、最終head `0d8df75` とCI成功を再確認してmainへmergeした。マージコミットは `c1b76adb2f0656ebe6611c19056464039a477c79`。承認待ち・公開保留は解消済み。

- [公開CI #13](https://github.com/TomofumiYabu/Alcemy-Sim1/actions/runs/40215354333)は当該SHAでbuild／deployとも成功。単体66＋通常68＋Pages68＝202件成功をログで確認。
- 2026-10-25 17:17:47 UTC に公開HTML・JS・CSS・favicon・WebP12ファイルの計16ファイルでHTTP 200と検証済みdistとのSHA-256完全一致を確認。JSは `index-AjZrmwJK.js`、CSSは `index-ClSbRIua.css`。全13画像をデコードできた。
- PC／モバイルの一巡・v2保存復元・通知非再生、固定v1移行・元JSONバックアップ・旧仕事の完了、待機タブの保護と引き継ぎ、蒸留器の停止予約・遺跡・素材導線・設定復元・文字125%が成功。計6組、ブラウザーエラー0。
- 公開応答はproxyとCAでTLS検証を維持して取得し、Chromiumの公開HTTPS originで操作確認。ローカルdistは照合用。Chromium自身の直接HTTPS経路、Firefox／WebKit、実機タッチは未評価。
- schemaVersion 2、contentVersion 1、ゲーム数値・経済・保存保護を維持。ターン制は設計文書のみで、コードは追加していない。

詳しくは [対応記録](REFACTOR-RESULTS-2026-10-25.md#公開後の実測確認)。結果・応答・画面は `.cache/verification/refactor-published/` に保持する。

## 前回の公開（UI-3／UI-4）

- リポジトリ: `TomofumiYabu/Alcemy-Sim1`
- 公開URL: https://tomofumiyabu.github.io/Alcemy-Sim1/
- 公開対象はUI-1〜UI-4を反映したMVP。全設備・人物・アイテム・探索先の専用画像、素材不足と研究の導線、移動・交換、通知、保存する表示・音の設定を実装。
- ユーザーのUI-3／UI-4公開許可後、[PR #3](https://github.com/TomofumiYabu/Alcemy-Sim1/pull/3)をmainへmergeした。対象commitは `4acae7e`。
- [公開実行 #8](https://github.com/TomofumiYabu/Alcemy-Sim1/actions/runs/40116139289)はbuild／deployとも成功。Cloud／CIそれぞれで単体57件＋通常パスE2E60件＋PagesパスE2E60件＝177件成功。型検査・本番ビルド成功。
- 2026-10-25（Asia/Tokyo）に公開HTML／JS／CSS／favicon／WebP12ファイル、計16ファイルでHTTP 200と検証済み成果物とのSHA-256一致を確認。公開JSは `index-BESGceIA.js`、CSSは `index-DqDQCbsR.css`。魔晶片はJSへ含まれ、全13画像が公開画面でデコードできた。
- PC・モバイルの一巡、通知と非再生、設備移動・購入配置、保存復元、待機タブの保護と引継ぎ、固定v1の移行・元JSONバックアップ・旧ジョブ完了を確認。追加機能も1366px／320pxで素材から蒸留器・遺跡への移動、停止予約、遺跡帰還、設定復元と文字125%を確認。ページ／console／リクエストエラーなし。
- 継承したproxyとCAのTLS検証を維持して公開応答を取得し、Chromiumの公開HTTPS originへ渡して操作を確認した。公開サイトから取得した画像・ファイルを使い、ローカルdistで代用せず、TLS検証も無効化していない。Chromium自身の直接HTTPS経路は今回再評価していない。

詳細、素材記録、性能、未実施範囲は [納品記録](UI-DELIVERY-2026-10-25.md) と `PROGRESS.md` を参照。以前のM1・レビュー公開（実行 #5、94件）、UI-1（#6、118件）、UI-2（#7、147件）の記録もPROGRESSに保持する。

## 初回設定（設定済み・リポジトリ再作成時の参考）

1. [リポジトリのPages設定](https://github.com/TomofumiYabu/Alcemy-Sim1/settings/pages) を開く。
2. **Build and deployment → Source → GitHub Actions** を選択する。
3. [Deploy to GitHub Pages](https://github.com/TomofumiYabu/Alcemy-Sim1/actions/workflows/pages.yml) を開く。まだ公開成功の実行がなければ、**Run workflow → Branch: main → Run workflow** を実行する。
4. `build` と `deploy` の成功後、deployジョブの公開URLを開く。準備画面の見出し・スタイル・目標の開閉が動き、再読込しても表示されることを確認する。

ローカルPCでのclone、ビルド、CLI操作は不要です。Pagesの項目がプラン・組織ポリシー・権限で利用できない場合は、管理者による確認が必要です。公開のためにリポジトリの可視性を自動変更しません。

## 以後の更新

`main` へのアプリケーション変更のpushで `.github/workflows/pages.yml` が動きます。文書（Markdownとdocs配下）だけの更新では公開処理を繰り返しません。手動実行は可能です。

1. `.node-version` と `packageManager` に合わせたNode.js/npmを用意し、`npm ci`。
2. GitHub runner用のChromiumをPlaywrightの公式インストーラーで導入。
3. `npm run check` でVitest単体テスト・型検査・本番ビルド・通常/Pagesパスそれぞれのデスクトップ/モバイルE2Eを実行。
4. 最後のPagesパス検証に使った `dist/` をアップロード。
5. `github-pages` environmentにデプロイ。

検証が失敗したビルドは公開しません。ビルドはcontents読み取り権限のみ、deployにだけPages書き込みとOIDCの権限を付けています。追加の個人トークンはワークフローに保存しません。

## Cloudでの確認コマンド

```sh
cd /workspace/Alcemy-Sim1
npm run check
```

Pagesパスだけを検証する場合は `npm run test:e2e:pages`。通常開発は `npm run dev` でルートパスを使用します。Cloudで検証したブラウザーは既存の `/usr/bin/chromium` です。

## 初回設定時のAPI接続制限（履歴）

今回、既存認証を使った `gh api repos/TomofumiYabu/Alcemy-Sim1` がGitHubに到達する前に拒否され、HTTPS CONNECTもプロキシから403でした。トークン不足を示すGitHub API応答ではありません。Gitの読み書きは成功しています。

APIでのPages設定と公開確認に必要な `api.github.com` と `tomofumiyabu.github.io` を、既存のpackage_managersプリセットを維持してCloud環境設定の変更案に追加しました。変更案の保存は実行環境への反映ではありません。最終確認の実機設定はspec revision 1、追加のallowed_hostsは空のままでした。環境設定で反映後、APIを再試行し、実際の権限とPages状態を確認します。秘密値をチャットに貼ったり、新しいトークンを先回りして発行したりする必要はありません。

APIを使わない公開GitHub Web画面からはActionsの実行結果を確認できました。また公開予定のgithub.ioホストには到達し、HTTP 404を確認しています。API接続制限と、初回Pages設定不足によるデプロイ失敗は区別します。

上記のGitHub Web画面での初回設定は、このCloudのAPI接続制限を解消しなくてもユーザーが行えます。
