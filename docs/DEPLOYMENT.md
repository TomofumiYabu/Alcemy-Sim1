# GitHub Pages公開

## 公開対象と状態

- リポジトリ: `TomofumiYabu/Alcemy-Sim1`
- 公開URL: https://tomofumiyabu.github.io/Alcemy-Sim1/
- 公開対象は遊べるMVP。派遣・設備配置・自動合成・販売・研究・セーブを実装しています。
- Cloud上の単体テスト33件、通常/Pagesパスの実Chromium E2E計24件、型検査・ビルドが成功済みです。
- 初回はPagesサイト取得404で失敗しましたが、今回の開発着手時点で既存ページのHTTP 200を確認でき、Pages有効化待ちは解消済みです。
- [MVPの公開実行](https://github.com/TomofumiYabu/Alcemy-Sim1/actions/runs/40077854098) はbuild/deployとも成功。公開HTMLはHTTP 200で、MVPのJSを配信していることを確認しました。
- 公開配信を既存CAでTLS検証して取得し、Chromiumへ渡す方式でデスクトップ/モバイルの一巡と保存復元を確認。Chromium自身の直接HTTPS経路はCloudプロキシのCA信頼設定で停止したため、直接接続の成功とは扱っていません。詳細は `PROGRESS.md` を参照してください。

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
