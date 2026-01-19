#!/usr/bin/env bash
# Helper: run psql inside the postgres service defined in docker-compose.production.yml
# Usage: ./scripts/docker-psql.sh -c "SELECT now();"
set -euo pipefail
SERVICE=${SERVICE:-postgres}
DB=${DB:-highway_cafe}
USER=${USER:-postgres}
EXTRA_ARGS=()
while [[ $# -gt 0 ]]; do
  case $1 in
    -c)
      EXTRA_ARGS+=("-c" "$2"); shift 2;;
    -d|--db)
      DB="$2"; shift 2;;
    --) shift; break;;
    *) EXTRA_ARGS+=("$1"); shift;;
  esac
done
exec docker compose exec "$SERVICE" psql -U "$USER" -d "$DB" "${EXTRA_ARGS[@]}" "$@"
