#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/backup-db.sh [output-dir]
# Creates a compressed backup of the postgres database running in docker compose (service name: postgres)
# Output file naming pattern: backup_YYYYmmdd_HHMMSS.sql.gz
# Requires: docker compose (v2) or docker-compose alias; pg_dump inside container image.

OUTPUT_DIR=${1:-backups}
mkdir -p "$OUTPUT_DIR"

# Resolve docker compose command (compose v2 plugin preferred)
if command -v docker &>/dev/null && docker compose version &>/dev/null; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  echo "[ERROR] docker compose not found" >&2
  exit 1
fi

TS=$(date +%Y%m%d_%H%M%S)
FILE="${OUTPUT_DIR}/backup_${TS}.sql"
GZFILE="${FILE}.gz"

DB_NAME=${DB_NAME:-highway_cafe}
DB_USER=${DB_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-highway_cafe_2024}

echo "[INFO] Creating logical backup of database '$DB_NAME' from container 'postgres'..."
# Use env var injection so pg_dump doesn't prompt
$COMPOSE exec -T postgres env PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "${FILE}.custom"
$COMPOSE exec -T postgres env PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges > "$FILE"

# Compress plain SQL dump (keep custom format too)
gzip -f "$FILE"

# Optionally compute checksums
sha256sum "${FILE}.gz" > "${FILE}.gz.sha256"
sha256sum "${FILE}.custom" > "${FILE}.custom.sha256"

echo "[INFO] Backup complete:"
ls -lh "${FILE}.gz" "${FILE}.custom" || true

echo "[INFO] Files generated:"
echo " - ${FILE}.gz (plain SQL gzipped)"
echo " - ${FILE}.gz.sha256 (checksum)"
echo " - ${FILE}.custom (pg_dump custom format)"
echo " - ${FILE}.custom.sha256 (checksum)"

echo "[INFO] To restore (plain SQL) on target host with docker compose running postgres service:"
echo "  gunzip -c ${FILE##*/}.gz | docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME"

echo "[INFO] To restore (custom format) with pg_restore (will replace objects):"
echo "  docker compose exec -T postgres env PGPASSWORD=... pg_restore -U $DB_USER -d $DB_NAME --clean --if-exists < ${FILE##*/}.custom"
