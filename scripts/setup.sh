#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

node --input-type=module -e '
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major !== 24 || minor < 19) {
    console.error("Node.js 24.19.0以上の24.xが必要です。.node-versionを参照してください。");
    process.exit(1);
  }
'
npm ci --no-audit --no-fund
browser_path="${CHROMIUM_PATH:-/usr/bin/chromium}"
if [[ ! -x "$browser_path" ]]; then
  echo 'Chromiumが必要です。CHROMIUM_PATHにインストール済み実行ファイルを指定してください。' >&2
  exit 1
fi
"$browser_path" --version
echo '依存関係の準備完了。npm run check で検証、npm run dev で起動します。'
