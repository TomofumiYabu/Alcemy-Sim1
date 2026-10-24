# GitHub Pages公開

## 公開対象と状態

- リポジトリ: `TomofumiYabu/Alcemy-Sim1`
- 予定URL: https://tomofumiyabu.github.io/Alcemy-Sim1/
- 公開対象は準備画面。ゲームの試遊機能はM1で追加予定です。
- Cloud上で通常パスとPagesパスの型検査・ビルド・実Chromium E2E計4件は成功済みです。
- [初回Actions実行](https://github.com/TomofumiYabu/Alcemy-Sim1/actions/runs/40074910335) は `build` 成功、`deploy` 失敗。`Configure Pages` でPagesサイト取得が404となり、Pagesを有効にしてGitHub Actions方式に設定するようGitHubが案内しています。
- 公開予定URLへの実要求もHTTP 404でした。公開完了ではありません。初回設定後にワークフローを再実行して公開を確認する必要があります。

## 初回設定（GitHubのWeb画面）

1. [リポジトリのPages設定](https://github.com/TomofumiYabu/Alcemy-Sim1/settings/pages) を開く。
2. **Build and deployment → Source → GitHub Actions** を選択する。
3. [Deploy to GitHub Pages](https://github.com/TomofumiYabu/Alcemy-Sim1/actions/workflows/pages.yml) を開く。まだ公開成功の実行がなければ、**Run workflow → Branch: main → Run workflow** を実行する。
4. `build` と `deploy` の成功後、deployジョブの公開URLを開く。準備画面の見出し・スタイル・目標の開閉が動き、再読込しても表示されることを確認する。

ローカルPCでのclone、ビルド、CLI操作は不要です。Pagesの項目がプラン・組織ポリシー・権限で利用できない場合は、管理者による確認が必要です。公開のためにリポジトリの可視性を自動変更しません。

## 以後の更新

`main` への通常pushで `.github/workflows/pages.yml` が動きます。

1. `.node-version` と `packageManager` に合わせたNode.js/npmを用意し、`npm ci`。
2. GitHub runner用のChromiumをPlaywrightの公式インストーラーで導入。
3. `npm run check` で型検査・本番ビルド・通常/Pagesパスそれぞれのデスクトップ/モバイルE2Eを実行。
4. 最後のPagesパス検証に使った `dist/` をアップロード。
5. `github-pages` environmentにデプロイ。

検証が失敗したビルドは公開しません。ビルドはcontents読み取り権限のみ、deployにだけPages書き込みとOIDCの権限を付けています。追加の個人トークンはワークフローに保存しません。

## Cloudでの確認コマンド

```sh
cd /workspace/Alcemy-Sim1
npm run check
```

Pagesパスだけを検証する場合は `npm run test:e2e:pages`。通常開発は `npm run dev` でルートパスを使用します。Cloudで検証したブラウザーは既存の `/usr/bin/chromium` です。

## 自動設定を妨げている接続制限

今回、既存認証を使った `gh api repos/TomofumiYabu/Alcemy-Sim1` がGitHubに到達する前に拒否され、HTTPS CONNECTもプロキシから403でした。トークン不足を示すGitHub API応答ではありません。Gitの読み書きは成功しています。

APIでのPages設定と公開確認に必要な `api.github.com` と `tomofumiyabu.github.io` を、既存のpackage_managersプリセットを維持してCloud環境設定の変更案に追加しました。変更案の保存は実行環境への反映ではありません。最終確認の実機設定はspec revision 1、追加のallowed_hostsは空のままでした。環境設定で反映後、APIを再試行し、実際の権限とPages状態を確認します。秘密値をチャットに貼ったり、新しいトークンを先回りして発行したりする必要はありません。

APIを使わない公開GitHub Web画面からはActionsの実行結果を確認できました。また公開予定のgithub.ioホストには到達し、HTTP 404を確認しています。API接続制限と、初回Pages設定不足によるデプロイ失敗は区別します。

上記のGitHub Web画面での初回設定は、このCloudのAPI接続制限を解消しなくてもユーザーが行えます。
