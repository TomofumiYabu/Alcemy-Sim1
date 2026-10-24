# Alcemy Sim

中世ファンタジーの錬金術工房経営ゲーム。冒険者による素材収集、工房設備による自動合成、研究ツリーによる恒常的な成長を組み合わせます。

現在は開発基盤と計画を整備した段階です。表示される画面は準備画面で、ゲーム本体は未実装です。

## Codex Cloudでの開発

作業ディレクトリは `/workspace/Alcemy-Sim1`。Node.js 24.19.0 / npm 11.9.0 とCloudにあるChromiumを利用します。外部APIキー、DB、Dockerは不要です。

```sh
cd /workspace/Alcemy-Sim1
bash scripts/setup.sh
npm run dev
```

開発サーバーは5173番ポートを使用します。検証は別のシェルで実行できます。

```sh
npm run check
```

型検査、本番ビルド、通常パスとGitHub PagesパスそれぞれでデスクトップとモバイルのChromium E2E（計4件）を実行します。E2Eは4173番ポートに専用サーバーを起動して終了時に停止します。結果は `test-results/`、失敗時のtraceや画像も同ディレクトリに出力され、Git管理には含まれません。`CHROMIUM_PATH` で既存のブラウザー実行ファイルを指定できます。

## GitHub Pages

公開先の予定URL: https://tomofumiyabu.github.io/Alcemy-Sim1/

`main` へのpushでテスト・ビルド・Pagesへのデプロイを実行します。初回はリポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選ぶ必要があります。詳細と公開確認状況は [公開手順](docs/DEPLOYMENT.md) を参照してください。現在公開対象となるのは準備画面で、ゲーム機能は次の実装段階です。

## 設計・計画

- [開発ルール](AGENTS.md)
- [調査結果](docs/RESEARCH.md)
- [ゲーム仕様案](docs/SPEC.md)
- [技術構成](docs/ARCHITECTURE.md)
- [実装計画と完了条件](docs/PLAN.md)
- [進捗と引き継ぎ](docs/PROGRESS.md)
- [GitHub Pages公開手順](docs/DEPLOYMENT.md)

初回の目標は「冒険者の派遣 → 素材回収 → 設備の配置と自動合成 → 販売 → 研究」の一巡を実際に遊べるようにすることです。
