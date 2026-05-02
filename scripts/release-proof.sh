#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/.phase-loop/logs"
CONVEX_LOG="$LOG_DIR/release-proof-convex.log"
CONVEX_PID=""

cd "$ROOT"
mkdir -p "$LOG_DIR"

is_convex_running() {
  lsof -nP -iTCP:3210 -sTCP:LISTEN >/dev/null 2>&1
}

has_local_convex_env() {
  [[ -f "$ROOT/.env.local" ]] && rg -q '^VITE_CONVEX_URL=' "$ROOT/.env.local"
}

ensure_playwright_chromium() {
  if [[ -f "$ROOT/playwright.config.ts" ]]; then
    bunx playwright install --with-deps chromium
  fi
}

reset_local_convex_state() {
  rm -rf "$ROOT/.convex/local"
  rm -f "$ROOT/.env.local"
}

bootstrap_log_requires_auth_sync() {
  local log_path="$1"
  rg -q 'used in auth config file but its value was not set' "$log_path"
}

bootstrap_log_requires_local_reset() {
  local log_path="$1"
  rg -q 'This deployment is using an older version of the Convex backend\. Upgrade now\?' "$log_path"
}

stop_convex_backend() {
  if [[ -n "$CONVEX_PID" ]]; then
    kill "$CONVEX_PID" >/dev/null 2>&1 || true
    wait "$CONVEX_PID" >/dev/null 2>&1 || true
    CONVEX_PID=""
  fi
}

bootstrap_local_convex_once() {
  local bootstrap_log
  bootstrap_log="$(mktemp)"

  if CONVEX_AGENT_MODE=anonymous \
    bunx convex dev --once --typecheck disable --tail-logs disable 2>&1 | tee "$bootstrap_log"; then
    rm -f "$bootstrap_log"
    return 0
  fi

  if bootstrap_log_requires_auth_sync "$bootstrap_log"; then
    rm -f "$bootstrap_log"
    bun run setup:convex-auth-local --sync
    bunx convex dev --once --typecheck disable --tail-logs disable
    return 0
  fi

  if bootstrap_log_requires_local_reset "$bootstrap_log"; then
    rm -f "$bootstrap_log"
    reset_local_convex_state
    CONVEX_AGENT_MODE=anonymous \
      bunx convex dev --once --typecheck disable --tail-logs disable
    bun run setup:convex-auth-local --sync
    return 0
  fi

  rm -f "$bootstrap_log"
  return 1
}

bootstrap_local_convex() {
  local attempt

  for attempt in 1 2 3; do
    if bootstrap_local_convex_once; then
      return 0
    fi
    echo "Convex bootstrap failed (attempt $attempt/3); retrying." >&2
    sleep 2
  done

  return 1
}

start_convex_backend_once() {
  local startup_log
  startup_log="$(mktemp)"

  : >"$CONVEX_LOG"
  bunx convex dev --typecheck disable --tail-logs disable >"$CONVEX_LOG" 2>&1 &
  CONVEX_PID=$!

  for _ in {1..60}; do
    if is_convex_running; then
      rm -f "$startup_log"
      return 0
    fi
    if [[ -f "$CONVEX_LOG" ]]; then
      cp "$CONVEX_LOG" "$startup_log" 2>/dev/null || true
      if bootstrap_log_requires_local_reset "$startup_log"; then
        kill "$CONVEX_PID" >/dev/null 2>&1 || true
        wait "$CONVEX_PID" >/dev/null 2>&1 || true
        CONVEX_PID=""
        reset_local_convex_state
        bootstrap_local_convex
        rm -f "$startup_log"
        : >"$CONVEX_LOG"
        bunx convex dev --typecheck disable --tail-logs disable >"$CONVEX_LOG" 2>&1 &
        CONVEX_PID=$!
      fi
      if ! kill -0 "$CONVEX_PID" >/dev/null 2>&1; then
        rm -f "$startup_log"
        return 1
      fi
    fi
    sleep 1
  done

  rm -f "$startup_log"
  return 1
}

start_convex_backend() {
  local attempt

  for attempt in 1 2 3; do
    if start_convex_backend_once; then
      return 0
    fi
    stop_convex_backend
    echo "Convex backend start failed (attempt $attempt/3); retrying." >&2
    sleep 2
  done

  return 1
}

cleanup() {
  stop_convex_backend
}

trap cleanup EXIT

warn_if_dirty() {
  local dirty
  dirty="$(git status --short --untracked-files=no | rg -v '^ ?M SESSION\.md$' || true)"
  if [[ -n "$dirty" ]]; then
    echo "Warning: release proof is running on a dirty working tree." >&2
    echo "$dirty" >&2
  fi
}

if ! has_local_convex_env; then
  echo "==> Bootstrapping local Convex deployment"
  bootstrap_local_convex
fi

echo "==> Syncing local Convex auth variables"
bun run setup:convex-auth-local --sync

if ! is_convex_running; then
  echo "==> Bootstrapping local Convex backend"
  if ! start_convex_backend; then
    echo "Convex backend did not start. Recent log output:" >&2
    tail -n 40 "$CONVEX_LOG" >&2 || true
    exit 1
  fi
fi

echo "==> Generating Convex bindings"
bunx convex codegen

echo "==> Ensuring Playwright Chromium"
ensure_playwright_chromium

echo "==> Proving lunchtable CLI package"
./scripts/proof-lunchtable-cli-package.sh

echo "==> Running full gate"
./scripts/phase-check.sh full

echo "==> Running regression gate"
./scripts/phase-check.sh regression

warn_if_dirty

echo "Release proof complete for $(git rev-parse --short HEAD)"
echo "Suggested next step: git tag -a v0.1.0 -m \"Lunch-Table release v0.1.0\""
