#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: ./scripts/generate-release-notes.sh <version>" >&2
  exit 1
fi

PREVIOUS_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
if [[ -n "$PREVIOUS_TAG" ]]; then
  RANGE="${PREVIOUS_TAG}..HEAD"
else
  RANGE="HEAD"
fi

collect_section() {
  local pattern="$1"
  git log --format='- %h %s' "$RANGE" --grep="$pattern" || true
}

FEATURES="$(collect_section '^feat:')"
FIXES="$(collect_section '^fix:')"
DOCS_AND_INFRA="$(git log --format='- %h %s' "$RANGE" --grep='^(docs|chore|checkpoint|test):' --extended-regexp || true)"
OTHER_CHANGES="$(git log --format='- %h %s' "$RANGE" --invert-grep --grep='^(feat|fix|docs|chore|checkpoint|test):' --extended-regexp || true)"

echo "# Release ${VERSION}"
echo
if [[ -n "$PREVIOUS_TAG" ]]; then
  echo "Range: \`${PREVIOUS_TAG}..HEAD\`"
else
  echo "Range: initial release through \`HEAD\`"
fi
echo

echo "## Features"
if [[ -n "$FEATURES" ]]; then
  echo "$FEATURES"
else
  echo "- No new feature commits in this range."
fi
echo

echo "## Fixes"
if [[ -n "$FIXES" ]]; then
  echo "$FIXES"
else
  echo "- No fix commits in this range."
fi
echo

echo "## Docs And Infra"
if [[ -n "$DOCS_AND_INFRA" ]]; then
  echo "$DOCS_AND_INFRA"
else
  echo "- No docs or infrastructure commits in this range."
fi
echo

echo "## Other Changes"
if [[ -n "$OTHER_CHANGES" ]]; then
  echo "$OTHER_CHANGES"
else
  echo "- No uncategorized commits in this range."
fi
