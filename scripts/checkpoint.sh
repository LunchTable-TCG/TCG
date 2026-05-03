#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION_FILE="$ROOT/docs/program/SESSION.md"

STATUS=""
STAGE=""
SUMMARY=""
NEXT_ACTION=""
PUSH=0

usage() {
  cat <<'EOF'
Usage: ./scripts/checkpoint.sh --status "<status>" --summary "<summary>" [options]

Options:
  --status "<status>"   Required. Commit status, for example "Complete" or "In Progress"
  --stage "<stage>"     Optional. SESSION current stage
  --summary "<text>"    Required. Session summary for the checkpoint commit
  --next "<text>"       Optional. Next action to store in docs/program/SESSION.md
  --push                Optional. Push after commit if a remote exists
EOF
  exit 1
}

replace_line_by_prefix() {
  local prefix="$1"
  local replacement="$2"
  awk -v prefix="$prefix" -v replacement="$replacement" '
    index($0, prefix) == 1 { print replacement; next }
    { print }
  ' "$SESSION_FILE" > "$SESSION_FILE.tmp"
  mv "$SESSION_FILE.tmp" "$SESSION_FILE"
}

update_current_next_action() {
  local phase_number="$1"
  local next_text="$2"
  awk -v phase="$phase_number" -v next_text="$next_text" '
    $0 ~ "^## Phase " phase ":" { in_phase=1; print; next }
    in_phase && /^\*\*Next Action\*\*: / { print "**Next Action**: " next_text; in_phase=0; next }
    in_phase && /^## Phase / { in_phase=0 }
    { print }
  ' "$SESSION_FILE" > "$SESSION_FILE.tmp"
  mv "$SESSION_FILE.tmp" "$SESSION_FILE"
}

current_phase_number() {
  awk '/^\*\*Current Phase\*\*: Phase / { sub(/^\*\*Current Phase\*\*: Phase /, ""); print; exit }' "$SESSION_FILE"
}

current_phase_name() {
  local phase_number="$1"
  awk -v phase="$phase_number" '
    $0 ~ "^## Phase " phase ":" {
      sub("^## Phase " phase ": ", "")
      sub(/ [^ ]+$/, "")
      print
      exit
    }
  ' "$SESSION_FILE"
}

current_branch() {
  git -C "$ROOT" rev-parse --abbrev-ref HEAD
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
    --push)
      PUSH=1
      shift
      ;;
    *)
      usage
      ;;
  esac
done

if [[ -z "$STATUS" || -z "$SUMMARY" ]]; then
  usage
fi

if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Git repository not initialized at $ROOT"
  exit 1
fi

PHASE_NUMBER="$(current_phase_number)"
PHASE_NAME="$(current_phase_name "$PHASE_NUMBER")"

if [[ -n "$STAGE" ]]; then
  replace_line_by_prefix "**Current Stage**:" "**Current Stage**: $STAGE"
fi

if [[ -n "$NEXT_ACTION" ]]; then
  update_current_next_action "$PHASE_NUMBER" "$NEXT_ACTION"
fi

git -C "$ROOT" add -A

COMMIT_BODY=$(cat <<EOF
checkpoint: Phase ${PHASE_NUMBER} ${STATUS} - ${PHASE_NAME}

Phase: ${PHASE_NUMBER} - ${PHASE_NAME}
Status: ${STATUS}
Session: ${SUMMARY}

Next: ${NEXT_ACTION:-Continue the current phase from the next unchecked task.}
EOF
)

git -C "$ROOT" commit -m "$COMMIT_BODY"

COMMIT_HASH="$(git -C "$ROOT" rev-parse --short HEAD)"
CHECKPOINT_DATE="$(date +%Y-%m-%d)"
replace_line_by_prefix "**Last Checkpoint**:" "**Last Checkpoint**: ${COMMIT_HASH} (${CHECKPOINT_DATE})"

if [[ $PUSH -eq 1 ]]; then
  if git -C "$ROOT" remote get-url origin >/dev/null 2>&1; then
    git -C "$ROOT" push origin "$(current_branch)"
  else
    echo "No git remote configured. Skipping push."
  fi
fi

echo "Checkpoint commit created: ${COMMIT_HASH}"
echo "docs/program/SESSION.md updated with the checkpoint hash as an uncommitted change."
