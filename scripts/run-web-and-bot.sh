#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${LUNCHTABLE_WEB_HOST:-127.0.0.1}"
PORT="${LUNCHTABLE_WEB_PORT:-4173}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

cd "$ROOT"

if [[ -f ".env.local" ]]; then
  while IFS= read -r line; do
    if [[ -z "$line" ]] || [[ "$line" == \#* ]]; then
      continue
    fi
    export "$line"
  done < ".env.local"
fi

cleanup() {
  if [[ -n "${WEB_PID:-}" ]]; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
  if [[ -n "${BOT_PID:-}" ]]; then
    kill "$BOT_PID" 2>/dev/null || true
  fi
  wait "${WEB_PID:-}" "${BOT_PID:-}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

bun run dev:web -- --host "$HOST" --port "$PORT" &
WEB_PID=$!

bun run dev:bot &
BOT_PID=$!

while kill -0 "$WEB_PID" 2>/dev/null && kill -0 "$BOT_PID" 2>/dev/null; do
  sleep 1
done

STATUS=0
if ! wait "$WEB_PID"; then
  STATUS=$?
fi
if ! wait "$BOT_PID"; then
  STATUS=$?
fi

exit "$STATUS"
