#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION_FILE="$ROOT/SESSION.md"
NEXT_ACTION=""

usage() {
  echo "Usage: ./scripts/advance-phase.sh --next-action \"<text>\""
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

next_pending_phase_number() {
  awk '
    /^## Phase / && /⏸️$/ {
      sub(/^## Phase /, "")
      sub(/:.*/, "")
      print
      exit
    }
  ' "$SESSION_FILE"
}

update_phase_icon() {
  local phase_number="$1"
  local icon="$2"
  awk -v phase="$phase_number" -v icon="$icon" '
    $0 ~ "^## Phase " phase ":" {
      sub(/ [^ ]+$/, " " icon)
      print
      next
    }
    { print }
  ' "$SESSION_FILE" > "$SESSION_FILE.tmp"
  mv "$SESSION_FILE.tmp" "$SESSION_FILE"
}

update_phase_next_action() {
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --next-action)
      NEXT_ACTION="${2:-}"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

if [[ -z "$NEXT_ACTION" ]]; then
  usage
fi

CURRENT_PHASE="$(current_phase_number)"
CURRENT_NAME="$(current_phase_name "$CURRENT_PHASE")"
NEXT_PHASE="$(next_pending_phase_number)"

if [[ -z "$NEXT_PHASE" ]]; then
  update_phase_icon "$CURRENT_PHASE" "✅"
  replace_line_by_prefix "**Current Stage**:" "**Current Stage**: Complete"
  echo "No pending phase found. Marked Phase ${CURRENT_PHASE} complete."
  exit 0
fi

update_phase_icon "$CURRENT_PHASE" "✅"
update_phase_icon "$NEXT_PHASE" "🔄"
replace_line_by_prefix "**Current Phase**:" "**Current Phase**: Phase ${NEXT_PHASE}"
replace_line_by_prefix "**Current Stage**:" "**Current Stage**: Implementation"
update_phase_next_action "$NEXT_PHASE" "$NEXT_ACTION"

echo "Advanced from Phase ${CURRENT_PHASE} (${CURRENT_NAME}) to Phase ${NEXT_PHASE}."
