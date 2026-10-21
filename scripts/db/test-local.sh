#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres (with a small Supabase stub),
# then runs the RLS tests or regenerates the TypeScript types.
# Needs the Postgres server binaries (initdb, pg_ctl).
#   scripts/db/test-local.sh          -> run scripts/db/rls-test.sql
#   scripts/db/test-local.sh types    -> rewrite src/types/database.ts
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PATH="$PG_BIN:$PATH"
WORKDIR="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"

cleanup() {
  pg_ctl -D "$WORKDIR/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  # Postgres refuses to run as root.
  chown -R postgres "$WORKDIR" 2>/dev/null || true
  RUN_AS=(runuser -u postgres --)
fi

"${RUN_AS[@]}" env PATH="$PATH" initdb -D "$WORKDIR/data" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" env PATH="$PATH" pg_ctl -D "$WORKDIR/data" -o "-p $PORT -k $WORKDIR -c listen_addresses=''" -l "$WORKDIR/log" start >/dev/null

PSQL=(psql -h "$WORKDIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -f "$ROOT/scripts/db/supabase-stub.sql"
for file in "$ROOT"/supabase/migrations/*.sql; do
  echo "migration: $(basename "$file")"
  "${PSQL[@]}" -f "$file"
done
if [ "${1:-test}" = "types" ]; then
  "${RUN_AS[@]}" env PATH="$PATH" pg_ctl -D "$WORKDIR/data" -m fast stop >/dev/null
  "${RUN_AS[@]}" env PATH="$PATH" pg_ctl -D "$WORKDIR/data" -o "-p $PORT -k $WORKDIR -c listen_addresses=localhost" -l "$WORKDIR/log" start >/dev/null
  npx supabase gen types typescript \
    --db-url "postgresql://postgres@localhost:$PORT/postgres?sslmode=disable" \
    --schema public > "$ROOT/src/types/database.ts"
  npx --yes oxfmt "$ROOT/src/types/database.ts" >/dev/null
  echo "src/types/database.ts updated"
else
  "${PSQL[@]}" -o /dev/null -f "$ROOT/scripts/db/rls-test.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
fi
