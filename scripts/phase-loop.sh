#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATUS=""
STAGE=""
SUMMARY=""
NEXT_ACTION=""
PUSH=0
ADVANCE=0
SKIP_CHECKS=0

usage() {
  cat <<'EOF'
Usage: ./scripts/phase-loop.sh --status "<status>" --summary "<summary>" --next "<next action>" [options]

Options:
  --status "<status>"   Required. Commit status, for example "Complete"
  --stage "<stage>"     Optional. SESSION stage before the checkpoint commit
  --summary "<text>"    Required. Checkpoint summary
  --next "<text>"       Required. Next action for the tracker
  --advance             Optional. Advance to the next phase after the checkpoint
  --push                Optional. Push after the checkpoint if a remote exists
  --skip-checks         Optional. Skip fast/full/regression checks
EOF
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --status)
      STATUS="${2:-}"
      shift 2
      ;;
    --stage)
      STAGE="${2:-}"
      shift 2
      ;;
    --summary)
      SUMMARY="${2:-}"
      shift 2
      ;;
    --next)
      NEXT_ACTION="${2:-}"
      shift 2
      ;;
    --advance)
      ADVANCE=1
      shift
      ;;
    --push)
      PUSH=1
      shift
      ;;
    --skip-checks)
      SKIP_CHECKS=1
      shift
      ;;
    *)
      usage
      ;;
  esac
done

if [[ -z "$STATUS" || -z "$SUMMARY" || -z "$NEXT_ACTION" ]]; then
  usage
fi

if [[ $SKIP_CHECKS -eq 0 ]]; then
  "$ROOT/scripts/phase-check.sh" fast
  "$ROOT/scripts/phase-check.sh" full
  "$ROOT/scripts/phase-check.sh" regression
fi

CHECKPOINT_ARGS=(
  --status "$STATUS"
  --summary "$SUMMARY"
  --next "$NEXT_ACTION"
)

if [[ -n "$STAGE" ]]; then
  CHECKPOINT_ARGS+=(--stage "$STAGE")
fi

if [[ $PUSH -eq 1 ]]; then
  CHECKPOINT_ARGS+=(--push)
fi

"$ROOT/scripts/checkpoint.sh" "${CHECKPOINT_ARGS[@]}"

if [[ $ADVANCE -eq 1 ]]; then
  "$ROOT/scripts/advance-phase.sh" --next-action "$NEXT_ACTION"
fi
