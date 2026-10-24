# 技術的負債・リファクタリングのレビュー

2026-10-25（Asia/Tokyo）。対象commit: `76765a1f8ca22cacf1882f750fc0cb967e71fd55`。ソース参照はこのcommitに固定する。

ユーザーの依頼により、3名のサブエージェントがUI・状態管理、ゲーム・保存、テスト・開発運用を分担して読み取りレビューし、主担当が根拠と再現結果を確認して統合した。アプリケーションの修正は行っていない。

## 判断

**全面的な作り直しは不要。次のM2開発前に、範囲を絞った整理を勧める。** 純粋なエンジン、単一の`useGame`、Web Locks、保存とUI設定の分離、構造化イベントは維持する。ファイルの行数だけを理由に巨大分割や外部状態管理ライブラリの導入を行う必要はない。

今回、公開停止を要するP1相当の問題は確認していない。通常のUI操作に関する小さな不具合を3条件で再現した。保存に関する主要指摘は、現行M1の故障ではなく、M2・M3の機能追加前に解消したい設計上の境界である。

## 優先して対応する項目

### 1. [P2] 案内とフォーカスの契約を、現在の状態と型で表す

根拠: [ExpeditionPanel.tsx:27](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/ui/ExpeditionPanel.tsx#L27)、[App.tsx:51](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/ui/App.tsx#L51)、[QuestProgress.tsx:55](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/ui/QuestProgress.tsx#L55)、[types.ts:7](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/ui/types.ts#L7)。

現在、次の2条件をChromiumで再現した。

- 素材不足から未雇用イリスへ案内され、雇用・派遣してカードが「探索中」になっても、上の案内は「まず冒険者を雇いましょう」のまま残る。案内文をrequest時のstateから作り、文字列として保持しているため。
- 知識1で初回研究の案内を押すと、無効な研究ボタンへの`focus()`が失敗し、フォーカスは「次の一歩を開く」に残る。画面は切り替わるが、キーボードの続きが対象へ移らない。

加えて、移動先は任意の文字列で、CSSセレクタ、日本語のaria-label、`equipment:*`、`expedition:*`が混在する。画面構造や名称を変えたときの対応漏れを型検査で発見できない。

**最小対応**: 案内対象のIDを保持し、文章は現在のGameStateから導出する。無効なボタンの代わりにカードや見出しへフォーカスする。移動要求は研究ID・設備種別・探索先ID等を持つ判別共用体へ整理し、対象解決を一か所へ寄せる。新しいルーターや状態管理基盤は不要。次の保守作業で、上記2条件の回帰ケースと合わせて着手を勧める。

### 2. [P2] 画像の失敗状態を画像単位にする

根拠: [Artwork.tsx:44](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/ui/Artwork.tsx#L44)。

`failed`がコンポーネント単位で残り、`src`が変わっても復帰しない。森画像だけを破損応答にした後に遺跡へ切り替えると、正常な遺跡画像を要求せず代替記号「◇」のままになる。同じ遺跡画像は別の研究カードで480pxとして正常にデコードされた。設備交換のように同じインスタンスの画像が変わる場面にも同じ構造がある。

**最小対応**: 失敗したURLを保持して現在の`src`と比較するか、画像のidentityをURL単位にする。別画像への切替で正しく回復することを1件の回帰ケースにする。通常の小さな不具合修正として対応できる。

### 3. [P2・M2前] 合成・探索の開始条件と保存検証の契約を整理する

根拠: [engine.ts:72](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/game/engine.ts#L72)、[save.ts:53](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/persistence/save.ts#L53)、[save.ts:90](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/persistence/save.ts#L90)。

エンジンのプレビューが時間・知識・報酬を決定する一方、保存検証は別実装で、合成時間を基準値と2段階の研究倍率の3値、知識を2値に限定し、探索にも森・薬草等の特例を持つ。現行の効果では整合している。

M2で隣接効果が新しい合法な合成時間を生むと、開始・保存は成功しても再読込でそのjobを拒否し得る。進行中に配置が変わるため、現在の配置から再計算するだけでも開始時条件を保てない。

**最小対応**: 新しい効果の実装と合わせ、versionごとの計算と合法な開始条件・確定結果の検証契約を共通化する。必要な開始条件をjobへ持たせる場合はschema移行も設計する。「旧ジョブ→効果追加／配置変更→再保存・復元」の契約テストを先に置く。現行の検証を単に緩める対応は避ける。

### 4. [P2・次のコード変更前] PR段階のCIを設ける

根拠: [pages.yml:3](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/.github/workflows/pages.yml#L3)、[pages.yml:44](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/.github/workflows/pages.yml#L44)。

現在はmainへのpushと手動実行だけでCIが動く。機能ブランチやPRでは自動検証されず、mainへ入れてから不具合を検出する運用になる。`deploy`はbuild成功を条件にしているため、失敗した成果物をそのまま公開する問題はない。

**最小対応**: 読み取り権限のPR検証を追加し、配信はmainのみに限定する。PRの検証が公開用concurrencyを占有しないようにする。現在の`npm run check`と検証したdistを配信する方針は維持する。

### 5. [P2・性能変更前] 計測・公開確認の実行ソースを追跡する

根拠: [納品記録:36](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/docs/UI-DELIVERY-2026-10-25.md#L36)、[同:40](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/docs/UI-DELIVERY-2026-10-25.md#L40)、[同:60](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/docs/UI-DELIVERY-2026-10-25.md#L60)。

性能値や公開確認は記録済みだが、補助スクリプトはignoredの`.cache/`、fixtureは`/tmp`にある。現在のCloud領域では使えても、新しいチェックアウトから同条件を再現できない。

**最小対応**: ベンチマーク・公開smokeの実行ソース、fixture生成、コマンドを`scripts/`等で追跡する。JSON・画像・動画・取得応答などの出力は引き続きGit対象外にする。今回のようなレビューの一時再現も、修正時には意味のある回帰テストへ取り込む。

### 6. [P2・M3のコンテンツ追加前] 現行ID、公開済み履歴、保存schemaを分離する

根拠: [contentVersions.ts:5](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/game/contentVersions.ts#L5)、[types.ts:32](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/game/types.ts#L32)、[migrate.ts:34](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/persistence/migrate.ts#L34)、[researchPresentation.ts:22](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/ui/researchPresentation.ts#L22)、[Artwork.tsx:90](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/ui/Artwork.tsx#L90)。

- 公開済みの各versionが、現在の`RecipeId`・`DestinationId`全体の`Record`を要求する。新IDを増やすと、凍結したversion 1にも新IDの定義を追加する圧力が生じる。
- inventoryと派遣報酬は現行6種の必須キーを持つ厳密なschema。v2は現行schemaへ直接渡すため、素材をそのまま追加すると既存v2を読めなくなる。
- 現行UIには研究説明の最後のelseや、人物・設備・探索先画像の二択がある。新IDへの対応を忘れると、型検査を通って別の既存コンテンツの説明・画像が表示され得る。

**最小対応**: コンテンツを増やす前に公開済みv2 schemaと固定fixtureを残し、次schemaへの明示移行を作る。履歴のID集合はversionごとに扱い、そのversionにないIDを明示的に拒否する。現行UIの表示定義には網羅的な`Record`等を使い、追加漏れを検出する。IDを増やさない現在のM1を直ちに変更する必要はない。

## 後回しでよい項目

| 項目 | 根拠・影響 | 適切な対応時期 |
| --- | --- | --- |
| CSSの責務と詳細度（P3） | [style.css:659](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/style.css#L659)の`.research-card > p`が[artwork.css:622](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/artwork.css#L622)の`.research-example`より強く、意図した色が適用されないことを確認。通常UIが両ファイルに分散する保守上の問題で、重大な可読性不良は確認していない | 次の該当画面改修時に、通常UIの指定を一か所へ、アート側は画像・装飾・演出へ整理する。CSS方式の全面移行は不要 |
| 原画の永続取得（P3） | [素材記録:9](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/assets/delivery/README.md#L9)はCloud絶対パスを参照。WebP・ハッシュ・書き出し条件は追跡済みだが、原画はリポジトリだけでは取得できない | 次のアート再編集前に、原画を取得できる永続保管先とmanifestを用意する。配信へ原画を含める必要はない |
| 安全整数上限（P3・既知） | [types.ts:31](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/game/types.ts#L31)の上限と[engine.ts:310](https://github.com/TomofumiYabu/Alcemy-Sim1/blob/76765a1f8ca22cacf1882f750fc0cb967e71fd55/src/game/engine.ts#L310)等の算術が一致しない。受理されるMAX_SAFE_INTEGER個の傷薬を売ると、保存成功後の読込がblockedになる境界を隔離プロセスで確認 | 通常プレイでは到達困難。長期数値・大きな経済を入れる前にchecked arithmeticと上限時の挙動を決める。既存PROGRESSでも把握済みの事項 |

## 着手順の提案

1. 案内・フォーカスと画像の小修正を、それぞれの回帰ケースとまとめる。
2. PR用CIと追跡できる計測・公開smokeを整え、次の変更を検証しやすくする。
3. M2で導線を増やす前に移動要求を型付けし、隣接効果を入れる前にjob／tripの開始条件・保存契約を設計する。
4. M3で新IDを増やす際に履歴・schema移行・表示定義を整える。CSSと原画管理は該当変更時に扱う。

これらは実装依頼ではなくレビューによる推奨順。現在の純粋な状態遷移、安定したtick順、開始時の仕事、v1バックアップ、Web Locks取得後の再読込、通常／Pages両パスのE2E、固定依存を守って進める。

## 検証と限界

- 報告書のソース参照23件を対象commitへ固定し、行番号とファイルの存在を確認。READMEとdocsのローカル文書リンク78件、`git diff --check`も確認した。過去レビューの当時の行番号は現行コードの行数と異なるため、新規報告の行参照検査とは分けている。
- 今回は全177件を再実行していない。177件成功は直前の納品時のCloud／CI結果であり、今回の追加検証とは分ける。
- UI担当が本番PagesビルドをChromiumで操作し、画像切替、古い案内、無効対象へのフォーカスを限定再現した。CSSの実色も確認した。結果は`/tmp/alcemy-review-ui-art.json`と`/tmp/alcemy-review-ui-state.jsonl`、一時スクリプトは`.cache/review-ui-art.mjs`と`.cache/review-ui-state.mjs`。証跡はGit対象外、独自previewは終了済み。
- ゲーム・保存担当は安全整数の境界をVite SSRの隔離プロセスで実行確認した。SSR準備でsocket EPERMのログが出たが、検証本体はexit 0で結果を取得した。
- 開始直後にCloud実行環境の接続が途切れたため、同一commitのGitHub読み取りも使用し、復帰後に限定再現を実施した。
- M2／M3の懸念は、対応する新機能を実装して再現したものではなく、現行コードの型・数式・移行経路から評価した設計上の負債。Firefox／WebKit、実機タッチ、新しい性能計測は今回実施していない。
