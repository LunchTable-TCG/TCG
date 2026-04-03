#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-full}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/.phase-loop/logs"
PACKAGE_JSON="$ROOT/package.json"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${MODE}-$(date +%Y%m%d-%H%M%S).log"

declare -a COMMANDS=()
declare -a FAST_FEEDBACK_COMMANDS=()
declare -a VALIDATION_COMMANDS=()
declare -a REGRESSION_COMMANDS=()

if [[ -f "$ROOT/phase-loop.conf" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/phase-loop.conf"
fi

usage() {
  echo "Usage: ./scripts/phase-check.sh [fast|full|regression]"
  exit 1
}

has_package_script() {
  local script_name="$1"
  [[ -f "$PACKAGE_JSON" ]] && rg -q "\"${script_name}\"[[:space:]]*:" "$PACKAGE_JSON"
}

append_default_commands() {
  local script_name
  local candidates=()

  case "$MODE" in
    fast)
      candidates=(typecheck test:unit test)
      ;;
    full)
      candidates=(lint typecheck test)
      ;;
    regression)
      candidates=(test:rules test:convex test:replay test:e2e)
      ;;
    *)
      usage
      ;;
  esac

  for script_name in "${candidates[@]}"; do
    if has_package_script "$script_name"; then
      COMMANDS+=("bun run $script_name")
    fi
  done
}

case "$MODE" in
  fast)
    if [[ ${#FAST_FEEDBACK_COMMANDS[@]} -gt 0 ]]; then
      COMMANDS=("${FAST_FEEDBACK_COMMANDS[@]}")
    fi
    ;;
  full)
    if [[ ${#VALIDATION_COMMANDS[@]} -gt 0 ]]; then
      COMMANDS=("${VALIDATION_COMMANDS[@]}")
    fi
    ;;
  regression)
    if [[ ${#REGRESSION_COMMANDS[@]} -gt 0 ]]; then
      COMMANDS=("${REGRESSION_COMMANDS[@]}")
    fi
    ;;
  *)
    usage
    ;;
esac

if [[ ${#COMMANDS[@]} -eq 0 ]]; then
  append_default_commands
fi

if [[ ${#COMMANDS[@]} -eq 0 ]]; then
  echo "No ${MODE} commands configured or auto-detected. Skipping." | tee "$LOG_FILE"
  exit 0
fi

echo "Running ${MODE} checks..." | tee "$LOG_FILE"
for cmd in "${COMMANDS[@]}"; do
  echo "==> $cmd" | tee -a "$LOG_FILE"
  (
    cd "$ROOT"
    eval "$cmd"
  ) 2>&1 | tee -a "$LOG_FILE"
done

echo "Completed ${MODE} checks. Log: $LOG_FILE"
