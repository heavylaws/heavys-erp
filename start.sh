#!/usr/bin/env bash
set -euo pipefail

echo "Highway Cafe POS - Generic Startup Script"
echo "========================================"

# Default environment values (can be overridden externally)
NODE_ENV=${NODE_ENV:-development}
ENABLE_VITE=${ENABLE_VITE:-true}
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-highway_cafe}
DB_USER=${DB_USER:-postgres}
TIMEOUT=${TIMEOUT:-120}

echo "Starting in NODE_ENV=$NODE_ENV (ENABLE_VITE=$ENABLE_VITE)"

# Wait for Postgres to be available (best-effort) if postgres client available
if command -v psql >/dev/null 2>&1; then
  echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT (up to $TIMEOUT seconds)..."
  counter=0
  while [ $counter -lt $TIMEOUT ]; do
    if PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
      echo "Database connection successful"
      break
    fi
    if [ $((counter % 10)) -eq 0 ]; then
      echo "Still waiting for database... ($counter/$TIMEOUT seconds)"
    fi
    sleep 1
    counter=$((counter + 1))
  done

  if [ $counter -eq $TIMEOUT ]; then
    echo "Database connection timeout ($TIMEOUT seconds) - continuing anyway"
  fi
else
  echo "psql not available - skipping DB wait (if you need DB checks, install postgresql-client)"
fi

echo "Verifying build artifacts..."
if [ -d "dist" ]; then
  ls -la dist || true
else
  echo "No dist directory found"
fi

echo "Starting server..."
if [ "$NODE_ENV" = "production" ]; then
  # Use production bundle if present
  if [ -f "dist/production.cjs" ]; then
    exec node dist/production.cjs
  elif [ -f "dist/index.cjs" ]; then
    exec node dist/index.cjs
  else
    echo "No compiled production bundle found; attempting to run with tsx (requires tsx installed)"
    exec tsx server/production.ts
  fi
else
  # In development, prefer running the compiled bundle for consistency; otherwise, fallback to tsx
  if [ -f "dist/index.cjs" ]; then
    exec node dist/index.cjs
  elif [ -f "dist/production.cjs" ]; then
    exec node dist/production.cjs
  else
    echo "No compiled bundle found; using tsx to run server/index.ts"
    exec tsx server/index.ts
  fi
fi
