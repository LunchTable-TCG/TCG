#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION_FILE="$ROOT/SESSION.md"

if [[ ! -f "$SESSION_FILE" ]]; then
  echo "SESSION.md not found at $ROOT"
  exit 1
fi

echo "Current phase:"
awk '
  /^\*\*Current Phase\*\*: / { print "  " $0 }
  /^\*\*Current Stage\*\*: / { print "  " $0 }
  /^\*\*Last Checkpoint\*\*: / { print "  " $0 }
' "$SESSION_FILE"

echo
echo "Program docs:"
echo "  docs/program/EXECUTION_PLAN.md"
echo "  docs/program/CHURN_TRACKER.md"
echo "  docs/program/VERIFICATION_MATRIX.md"
echo "  docs/program/BENCHMARK_BUDGETS.md"

echo
echo "Active phase block:"
awk '
  /^## Phase / && /🔄$/ { printing=1; print; next }
  /^## Phase / && printing { exit }
  printing { print }
' "$SESSION_FILE"

echo
echo "Checkpoint history:"
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$ROOT" log --grep="^checkpoint:" -1 --format="  %h %s" || true
else
  echo "  Git repo not initialized"
fi
