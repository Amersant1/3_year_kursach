#!/usr/bin/env bash
# Wait for Postgres, optionally apply Aerich migrations, then exec the
# service command. Only the backend runs migrations (RUN_MIGRATIONS=1) so
# worker/beat don't race on the same DB.
set -euo pipefail

PG_HOST="${POSTGRES_HOST:-postgres}"
PG_PORT="${POSTGRES_PORT:-5432}"

echo "[entrypoint] waiting for postgres ${PG_HOST}:${PG_PORT} ..."
python - <<'PY'
import os, socket, time, sys
host = os.environ.get("POSTGRES_HOST", "postgres")
port = int(os.environ.get("POSTGRES_PORT", "5432"))
deadline = time.time() + 60
while time.time() < deadline:
    try:
        with socket.create_connection((host, port), timeout=2):
            print("[entrypoint] postgres is up")
            sys.exit(0)
    except OSError:
        time.sleep(1)
print("[entrypoint] postgres not reachable in time", file=sys.stderr)
sys.exit(1)
PY

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] applying Aerich migrations (idempotent) ..."
  aerich upgrade
fi

echo "[entrypoint] exec: $*"
exec "$@"
