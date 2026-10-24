# GitHub Pages公開

## 公開対象と状態

- リポジトリ: `TomofumiYabu/Alcemy-Sim1`
- 公開URL: https://tomofumiyabu.github.io/Alcemy-Sim1/
- 公開対象はUI-1を反映したMVP。常設HUD、4画面のナビ、PCの設備詳細、モバイルの下部ナビ・詳細シート、初回案内、キーボード配置を実装。専用アートはUI-2以降。
- ユーザーの公開許可後、[PR #1](https://github.com/TomofumiYabu/Alcemy-Sim1/pull/1)をmainへmergeした。対象commitは `3d2258e`。
- [公開実行 #6](https://github.com/TomofumiYabu/Alcemy-Sim1/actions/runs/40104160651)はbuild／deployとも成功。build 1分59秒、deploy 12秒、全体2分18秒。Cloud／CIそれぞれで単体46件＋通常パスE2E36件＋PagesパスE2E36件＝118件成功。型検査・本番ビルド成功。
- 2026-10-24 23:51〜23:52（Asia/Tokyo）に公開HTML／JS／CSS／faviconのHTTP 200を確認。公開JS `index-D3jh19VL.js` とCSS `index-8MIKNMru.css` は、検証した成果物とのSHA-256一致を確認した。
- 公開応答を使い、PC・モバイルで一巡、設備移動・購入配置、再読込復元を確認。別タブの保存保護と所有権引継ぎ、固定v1セーブの移行・元JSONバックアップ・旧ジョブ完了も確認。ページ／console／リクエストエラーなし。
- Cloudでは、継承したプロキシとCAによるTLS検証を維持して公開応答を取得し、Chromiumの公開HTTPS originへ渡して操作を検証した。ローカルdistで代用せず、TLS検証無効化も行っていない。Chromium自身の直接HTTPS経路の成否は今回再評価していない。

以前のM1・レビュー公開（実行 #5、94件）の記録は `PROGRESS.md` に残す。UI-1の最新結果と未実施範囲も同文書を参照。

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
