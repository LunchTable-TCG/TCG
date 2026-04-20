#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="$ROOT/.phase-loop/releases"

cd "$ROOT"

VERSION="${1:-}"
MODE="${2:-}"

if [[ -z "$VERSION" ]]; then
  echo "Usage: ./scripts/cut-release.sh <version> [--dry-run|--push]" >&2
  exit 1
fi

if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Version must use v<major>.<minor>.<patch> format." >&2
  exit 1
fi

if git rev-parse "$VERSION" >/dev/null 2>&1; then
  echo "Tag $VERSION already exists." >&2
  exit 1
fi

DIRTY_TREE="$(git status --short --untracked-files=no | rg -v '^ ?M SESSION\.md$' || true)"
if [[ -n "$DIRTY_TREE" ]]; then
  echo "Release cut requires a clean working tree." >&2
  echo "$DIRTY_TREE" >&2
  exit 1
fi

mkdir -p "$RELEASE_DIR"
NOTES_PATH="$RELEASE_DIR/${VERSION}.md"

echo "==> Running release proof"
bash ./scripts/release-proof.sh

echo "==> Generating release notes"
bash ./scripts/generate-release-notes.sh "$VERSION" >"$NOTES_PATH"

if [[ "$MODE" == "--dry-run" ]]; then
  echo "Dry run complete. Release notes written to $NOTES_PATH"
  echo "Suggested next step: git tag -a $VERSION -F $NOTES_PATH"
  exit 0
fi

echo "==> Creating annotated tag $VERSION"
git tag -a "$VERSION" -F "$NOTES_PATH"

if [[ "$MODE" == "--push" ]]; then
  echo "==> Pushing tag $VERSION"
  git push origin "$VERSION"
fi

echo "Release tag created: $VERSION"
echo "Release notes path: $NOTES_PATH"
