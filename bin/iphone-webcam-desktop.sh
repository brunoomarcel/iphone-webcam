#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE="$ROOT/runtime/node"
if [ ! -x "$NODE" ]; then
  NODE="$(command -v node)"
fi
SERVER="$ROOT/server.mjs"
STATE="$HOME/.local/state/iphone-linux-webcam"
LOG="$STATE/desktop.log"
PIDFILE="$STATE/server.pid"
URL="http://localhost:8765/"
HEALTH_URL="http://localhost:8765/api/info"

mkdir -p "$STATE"

{
  echo ""
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] abrindo iPhone Webcam"

  if ! "$NODE" -e "fetch('$HEALTH_URL').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    echo "servico nao estava rodando ou esta desatualizado; iniciando"
    if [ -f "$PIDFILE" ]; then
      OLD_PID="$(cat "$PIDFILE" 2>/dev/null || true)"
      if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" >/dev/null 2>&1; then
        kill "$OLD_PID" >/dev/null 2>&1 || true
        sleep 1
      fi
    fi
    nohup "$NODE" "$SERVER" >> "$STATE/server.log" 2>&1 &
    echo "$!" > "$PIDFILE"
    sleep 1
  else
    echo "servico ja estava rodando"
  fi

  if command -v google-chrome >/dev/null 2>&1; then
    google-chrome "$URL" >/dev/null 2>&1 &
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  fi
} >> "$LOG" 2>&1
