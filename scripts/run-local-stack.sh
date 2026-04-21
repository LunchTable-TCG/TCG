#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT"

is_convex_running() {
  lsof -nP -iTCP:3210 -sTCP:LISTEN >/dev/null 2>&1
}

bootstrap_local_convex() {
  local bootstrap_log
  bootstrap_log="$(mktemp)"

  if CONVEX_AGENT_MODE=anonymous \
    bunx convex dev --once --typecheck disable --tail-logs disable 2>&1 | tee "$bootstrap_log"; then
    rm -f "$bootstrap_log"
    return 0
  fi

  if ! rg -q 'used in auth config file but its value was not set' "$bootstrap_log"; then
    rm -f "$bootstrap_log"
    return 1
  fi

  rm -f "$bootstrap_log"
  bun run setup:convex-auth-local --sync
  bunx convex dev --once --typecheck disable --tail-logs disable
}

if [[ ! -f ".env.local" ]] || ! rg -q '^VITE_CONVEX_URL=' ".env.local"; then
  bootstrap_local_convex
fi

bun run setup:convex-auth-local --sync

if is_convex_running; then
  exec bash ./scripts/run-web-and-bot.sh --host 127.0.0.1 --port 4173
fi

exec bunx convex dev \
  --until-success \
  --typecheck disable \
  --tail-logs disable \
  --run-sh 'bash ./scripts/run-web-and-bot.sh --host 127.0.0.1 --port 4173'
