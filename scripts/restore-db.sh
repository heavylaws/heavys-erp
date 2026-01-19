#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/restore-db.sh <backup-file>
# Accepts either a .sql, .sql.gz, or pg_dump custom format (.custom)
# Restores into running docker compose postgres service.

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file>" >&2
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "[ERROR] Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if command -v docker &>/dev/null && docker compose version &>/dev/null; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  echo "[ERROR] docker compose not found" >&2
  exit 1
fi

DB_NAME=${DB_NAME:-highway_cafe}
DB_USER=${DB_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-highway_cafe_2024}

EXT="${BACKUP_FILE##*.}"
BASE="$(basename "$BACKUP_FILE")"

echo "[INFO] Restoring '$BASE' into database '$DB_NAME'..."
case "$EXT" in
  gz)
    echo "[INFO] Detected gzipped SQL dump"
    gunzip -c "$BACKUP_FILE" | $COMPOSE exec -T postgres env PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME"
    ;;
  sql)
    echo "[INFO] Detected plain SQL dump"
    $COMPOSE exec -T postgres env PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
    ;;
  custom|custom")
    echo "[INFO] Detected pg_dump custom format"
    cat "$BACKUP_FILE" | $COMPOSE exec -T postgres env PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists
    ;;
  *)
    if [[ "$BACKUP_FILE" == *.custom ]]; then
      echo "[INFO] Detected pg_dump custom format (by suffix)"
      cat "$BACKUP_FILE" | $COMPOSE exec -T postgres env PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists
    else
      echo "[ERROR] Unknown backup file extension: $EXT" >&2
      exit 1
    fi
    ;;
 esac

echo "[INFO] Restore complete."