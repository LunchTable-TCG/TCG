#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/lunchtable-cli-package.XXXXXX)"
PACK_DIR="$TMP_DIR/packs"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

cd "$ROOT"

mkdir -p "$PACK_DIR"
bun run scripts/release-public-packages.ts --dry-run --pack-destination "$PACK_DIR" >/dev/null

TARBALL="$(find "$PACK_DIR" -name 'lunchtable-[0-9]*.tgz' -type f | head -n 1)"
TARGET="$TMP_DIR/proof-dice-game"
SIDE_TARGET="$TMP_DIR/proof-side-scroller"

bunx --package "$TARBALL" lunchtable init "$TARGET" --template dice --yes >/dev/null
bunx --package "$TARBALL" lunchtable validate "$TARGET" --json >/dev/null
bunx --package "$TARBALL" lunchtable eval "$TARGET" --json >/dev/null

bunx --package "$TARBALL" lunchtable init "$SIDE_TARGET" --template side-scroller --yes >/dev/null
mkdir -p "$SIDE_TARGET/node_modules/@lunchtable"
extract_package() {
  local tarball="$1"
  local target="$2"
  mkdir -p "$target"
  tar -xzf "$tarball" -C "$target" --strip-components=1
}

extract_package "$PACK_DIR/lunchtable-games-ai-0.1.1.tgz" "$SIDE_TARGET/node_modules/@lunchtable/games-ai"
extract_package "$PACK_DIR/lunchtable-games-assets-0.1.1.tgz" "$SIDE_TARGET/node_modules/@lunchtable/games-assets"
extract_package "$PACK_DIR/lunchtable-games-core-0.1.1.tgz" "$SIDE_TARGET/node_modules/@lunchtable/games-core"
extract_package "$PACK_DIR/lunchtable-games-render-0.1.1.tgz" "$SIDE_TARGET/node_modules/@lunchtable/games-render"
extract_package "$PACK_DIR/lunchtable-games-side-scroller-0.1.1.tgz" "$SIDE_TARGET/node_modules/@lunchtable/games-side-scroller"
extract_package "$PACK_DIR/lunchtable-games-tabletop-0.1.1.tgz" "$SIDE_TARGET/node_modules/@lunchtable/games-tabletop"
ln -s "$ROOT/node_modules/@types" "$SIDE_TARGET/node_modules/@types"
ln -s "$ROOT/node_modules/vitest" "$SIDE_TARGET/node_modules/vitest"

bunx tsc --noEmit -p "$SIDE_TARGET/tsconfig.json"
bunx vitest run --root "$SIDE_TARGET"
(
  cd "$SIDE_TARGET"
  MCP_OUTPUT="$(printf '%s\n%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"proof","version":"0.1.1"}}}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' |
    bun run --silent mcp:stdio)"
  rg '"protocolVersion":"2025-11-25"' <<<"$MCP_OUTPUT" >/dev/null
  rg '"listAssets"' <<<"$MCP_OUTPUT" >/dev/null
  rg '"submitAction"' <<<"$MCP_OUTPUT" >/dev/null
)

echo "lunchtable package proof passed: $TARBALL"
