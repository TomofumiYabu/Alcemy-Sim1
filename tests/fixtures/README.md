# 公開済みv1セーブ

MVPの保存形式（レビュー対象 `3d775ed` 以前のschemaVersion 1）から取得した固定JSONです。テスト実行時に現行の生成関数で作り直しません。

- `v1-initial.json`: 新規状態。
- `v1-inflight.json`: イリスの森派遣と、研究前に開始した傷薬の合成が進行中。
- `v1-researched.json`: 全9研究済み、自動再派遣と短縮後の合成・蒸留器を含む状態。

互換性テストのため、コンテンツの数値や現行schemaを変更しても既存ファイルを更新しません。新しい公開形式には別のfixtureを追加します。テスト用の資源を持つ状態も含み、全て旧版のコマンドとシリアライズ処理で生成した有効な保存データです。

## 固定v2セーブ

`v2-inflight.json`と`v2-researched.json`は、リファクタリング前の公開済み実装（アプリケーションは`76765a1`と同じ、採取時HEAD `fbd900f`）でv1 fixtureを移行し、schemaVersion 2として固定したもの。テスト実行時には移行処理から生成し直さない。通常・研究後のjob／trip、開始時条件、残時間を読み戻し、再保存と仕事の完了を確認する。旧v1 fixtureは変更していない。

- `v2-inflight.json`: SHA-256 `10dbb60ef6410ebb4d5f2ce282e9aabb7d7aa467d78963a1ea02ee7489d64997`
- `v2-researched.json`: SHA-256 `cea3a0c30f1d3a26c39bbda618165b91f76756a874d792795bb824f694c3d2b4`
