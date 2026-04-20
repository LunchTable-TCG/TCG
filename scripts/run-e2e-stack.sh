#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT"

export OPERATOR_EMAIL_ALLOWLIST="${OPERATOR_EMAIL_ALLOWLIST:-@example.com}"

is_convex_running() {
  lsof -nP -iTCP:3210 -sTCP:LISTEN >/dev/null 2>&1
}

if [[ ! -f ".env.local" ]] || ! rg -q '^VITE_CONVEX_URL=' ".env.local"; then
  bunx convex dev --once --typecheck disable --tail-logs disable
fi

bun run setup:convex-auth-local --sync
bunx convex env set OPERATOR_EMAIL_ALLOWLIST "$OPERATOR_EMAIL_ALLOWLIST" >/dev/null

if is_convex_running; then
  exec bash ./scripts/run-web-and-bot.sh --host 127.0.0.1 --port 4173
fi

exec bunx convex dev \
  --until-success \
  --typecheck disable \
  --tail-logs disable \
  --run-sh 'bash ./scripts/run-web-and-bot.sh --host 127.0.0.1 --port 4173'
