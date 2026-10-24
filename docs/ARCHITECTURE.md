# 技術構成と判断

## 現在の構成

- React 19 + TypeScript + Vite。本番成果物は `dist/` の静的ファイル。
- `src/main.tsx`: Reactアプリケーション起動。
- `src/ui/App.tsx`: 149行の画面統合。工房・設備詳細・在庫・派遣・研究・目標・記録は個別コンポーネントに分割。
- `src/ui/useGame.ts`: ゲーム状態と実時計、自動保存、可視性変更の接続。
- `src/style.css`: 中世の工房をイメージしたUIと画面幅対応。
- `src/game/`: データ・コマンド・固定tickのシミュレーション。
- `src/persistence/save.ts`: 移行後の検証、読み書き、旧JSONのバックアップと復旧。
- `src/persistence/session.ts`: Web Locksによる書き込み所有権と解放。
- `src/persistence/migrate.ts` / `legacyV1.ts`: 凍結した旧schemaからの明示的な移行。
- `src/game/contentVersions.ts`: 公開済み数値ルールの履歴。
- `src/game/config.ts`: 工房寸法と容量。
- `tests/unit/`: Vitestで経済・時間・研究・保存を検証。
- `tests/e2e/`: 本番ビルドを実Chromiumで操作し、一巡・製造・研究・破損復旧・保存失敗・非表示停止を検証。
- `scripts/setup.sh`: 書き込み可能なキャッシュを利用する `npm ci` とChromium確認。
- `package-lock.json`: exact指定した直接依存と推移的依存を固定。導入済みバージョンの正本。
- `.github/workflows/pages.yml`: mainへのpush/手動実行で検証・Pages公開。Node/npmを固定し、テストで検証した `dist/` だけを配信。第三者Actionは公式リリースのcommit SHAに固定。

通常の開発ではルートパスを使い、Pagesビルドでは `VITE_BASE_PATH=/Alcemy-Sim1/` を指定。`npm run check` は両パスでビルドとE2Eを実行し、最後にPages配信用成果物を残します。公開に必要な権限はdeployジョブだけに付け、初回のPages有効化はリポジトリ設定で行います。

Node.jsはCloudにある24.19.0を `.node-version` に記録。24.x以外は自動採用せず、ツール更新は検証を伴う別変更として行います。npmは11.xを利用します。

## ゲームの実装構成

```text
src/
  game/
    types.ts           Zod状態schemaと推論型・コマンド型
    content.ts         アイテム・レシピ・設備・研究の定義
    contentVersions.ts  変更しない公開済み数値ルールの履歴
    config.ts          工房寸法・容量の共通定義
    engine.ts          コマンド・tick・不足/価格/解放状態の算出
  persistence/save.ts  保存のschema検証・version・復旧
  ui/                  工房・派遣・研究などのReact表示
  main.tsx             起動、時計と保存を接続
tests/
  unit/                Vitestでコマンド・時間・整合性を検証
  e2e/                 Chromiumでプレイと保存復元を検証
```

MVPはReact標準の状態管理と純粋関数で構成し、外部状態管理ライブラリは使っていません。コマンド・tick・算出処理は小さいうちは `engine.ts` にまとめ、必要になった段階で分割します。

## 不変条件

- `GameState` が唯一の正本。UI内に通貨や在庫の別コピーを持たない。
- `applyCommand(state, command)` は次状態とエラーを返し、失敗時は元状態をそのまま返す。`advanceTicks(state, count)` は次状態を返す。いずれも入力を変更せず、DOM、localStorage、現在時刻を直接参照しない。
- 副作用は外側から接続する。現MVPの報酬は確定値。乱数を導入する場合はseed付き生成器を注入する。
- 計算順序は仕様に従い固定する。tickのまとめ方を変えても同一結果になることをテストする。
- 合成中ジョブは確保済み材料・残時間・完了品を保持。研究で既存ジョブを巻き戻さない。
- 研究効果は基本値と購入済みIDから再計算し、読込のたびに倍率を重複適用しない。

## 保存の方針

localStorageにはschemaVersion 2とcontentVersion、ゲーム状態を保存します。公開済みv1の構造は凍結し、移行後に厳密検証します。旧JSONは初回の書き込み前にバックアップします。読み込みデータは信用せず、有限・非負の数値、ID、配置、研究前提、ジョブ参照を検証します。未知versionや破損データを自動上書きせず、破損を案内して明示的な新規開始を提供します。

保存・初期化と時計はWeb Locksの所有タブだけで動かします。所有権を取得したら最新データを読み直し、離脱時は保存後に解放します。待機中タブはstorage通知で表示を更新します。

合成と派遣の表示プレビューはジョブ生成と同じ関数を使います。数値を変更する場合は履歴エントリを追加してCONTENT_VERSIONを進めます。既存エントリを編集すると旧セーブの契約を壊すため禁止です。固定v1 fixtureと現行定義/履歴の一致テストを維持します。

MVPでは端末間同期やオフライン加算は行いません。セーブは各ブラウザーに依存するため、将来必要ならJSONのインポート/エクスポートを追加します。CloudのE2Eテストは隔離されたブラウザープロファイルで動き、ユーザーのゲーム保存とは共有しません。

## 品質の段階

| 段階 | 必須検証 |
| --- | --- |
| M0 開発基盤 | strict型検査、本番ビルド、デスクトップ/モバイルChromiumで画面・操作・再読込、コンソールエラーと横溢れなし |
| M1 MVP | 上記 + ゲーム状態の単体テスト + 実ブラウザーで派遣→合成→販売→研究→再読込復元 |
| M2 自動化/配置 | 上記 + 複数設備競合、配置効果、長時間の整合性、データ参照と研究グラフ検査 |
| M3 継続成長 | 上記 + セーブ移行、長期数値、上限付きオフライン計算を実装時に検証 |

Firefox/WebKit、画像回帰、全端末検証は現時点の任意・未実施項目です。公開確認は `DEPLOYMENT.md` と `PROGRESS.md` に記録します。
