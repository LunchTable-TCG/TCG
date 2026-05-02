#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/lunchtable-cli-package.XXXXXX)"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

cd "$ROOT"

bun run --cwd packages/cli build >/dev/null

TARBALL="$(cd packages/cli && bun pm pack --destination "$TMP_DIR" --ignore-scripts --quiet | tail -n 1)"
TARGET="$TMP_DIR/proof-dice-game"

bunx --package "$TARBALL" lunchtable init "$TARGET" --template dice --yes >/dev/null
bunx --package "$TARBALL" lunchtable validate "$TARGET" --json >/dev/null
bunx --package "$TARBALL" lunchtable eval "$TARGET" --json >/dev/null

echo "lunchtable package proof passed: $TARBALL"
