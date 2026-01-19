#!/bin/bash
set -eo pipefail

# Configuration
BACKUP_DIR="/backups"
KEEP_DAYS=${BACKUP_KEEP_DAYS:-7}
SLEEP_SECONDS=${BACKUP_INTERVAL_SECONDS:-86400} # Default 24h
DB_HOST=${DB_HOST:-postgres}
DB_USER=${DB_USER:-postgres}
DB_NAME=${DB_NAME:-highway_cafe}

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "[INFO] Starting Backup Daemon..."
echo "[INFO] Target: postgres://$DB_USER@$DB_HOST/$DB_NAME"
echo "[INFO] Interval: $SLEEP_SECONDS seconds"
echo "[INFO] Rotation: +$KEEP_DAYS days"

# Wait for Postgres to be ready
until pg_isready -h "$DB_HOST" -U "$DB_USER"; do
  echo "[INFO] Waiting for database to be ready..."
  sleep 5
done

while true; do
  DATE=$(date +%Y%m%d_%H%M%S)
  FILE="$BACKUP_DIR/backup_$DATE.sql.gz"
  
  echo "[INFO] Starting backup: $FILE"
  
  if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" | gzip > "$FILE"; then
    echo "[INFO] Backup successful: $(du -h "$FILE" | cut -f1)"
    
    # Rotation
    echo "[INFO] Cleaning up backups older than $KEEP_DAYS days..."
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$KEEP_DAYS -delete
    
  else
    echo "[ERROR] Backup failed!"
    # Don't exit, retry next cycle (or could add logic to retry sooner)
  fi
  
  echo "[INFO] Sleeping for $SLEEP_SECONDS seconds..."
  sleep "$SLEEP_SECONDS"
done
