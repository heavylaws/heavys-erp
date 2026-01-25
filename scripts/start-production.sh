#!/bin/bash
set -e

echo "Highway Cafe POS - Production Startup"
echo "======================================"

# Force production environment with Docker flags
export NODE_ENV=production
export ENABLE_VITE=false
export DATABASE_TYPE=postgres
export REPLIT_DEPLOYMENT=true

# Database connection parameters
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-highway_cafe}
DB_USER=${DB_USER:-postgres}
TIMEOUT=120

echo "Environment: NODE_ENV=$NODE_ENV, ENABLE_VITE=$ENABLE_VITE"
echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."

# Wait for database
counter=0
while [ $counter -lt $TIMEOUT ]; do
if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
echo "Database connection successful!"
break
fi

if [ $((counter % 10)) -eq 0 ]; then
echo "Still waiting for database... ($counter/$TIMEOUT seconds)"
fi

sleep 1
counter=$((counter + 1))
done

if [ $counter -eq $TIMEOUT ]; then
echo "Database connection timeout after $TIMEOUT seconds"
exit 1
fi

echo "Initializing database schema and data..."

# Try TypeScript initialization first, then SQL fallback
if tsx scripts/init-docker-db.ts 2>/dev/null; then
echo "TypeScript database initialization successful"
elif PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /app/init-db.sql >/dev/null 2>&1; then
echo "SQL fallback initialization successful"
else
echo "Database initialization failed - continuing with existing schema"
fi

# Apply any SQL migrations present in the migrations directory (no-op if none exist)
if [ -d "/app/migrations" ]; then
for sqlfile in /app/migrations/*.sql; do
if [ -f "$sqlfile" ]; then
echo "Applying migration: $sqlfile"
PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$sqlfile" || true
fi
done
fi

echo "Verifying production build files..."
ls -la dist/public/ || echo "WARNING: No dist/public directory found"  
ls -la dist/ || echo "WARNING: No dist directory found"

echo "Starting Highway Cafe POS server in PRODUCTION mode..."
# Use the dedicated production server (CommonJS compiled bundle)
exec node dist/production.cjs
