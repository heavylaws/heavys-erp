#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE_ARG=${COMPOSE_FILE_ARG:-}

echo "[patch] Ensuring currency_rates.is_active column exists and state normalized"

run_psql () {
  local sql="$1"
  if command -v docker &>/dev/null && docker compose ls &>/dev/null; then
    # Try production compose file first if present
    if [ -f docker-compose.production.yml ]; then
      docker compose -f docker-compose.production.yml exec -T postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-highway_cafe} -v ON_ERROR_STOP=1 -c "$sql"
    else
      docker compose exec -T postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-highway_cafe} -v ON_ERROR_STOP=1 -c "$sql"
    fi
  else
    echo "Docker compose not available in PATH or not initialized. Run manually inside the postgres container:" >&2
    echo "psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-highway_cafe}" >&2
    exit 1
  fi
}

run_psql "ALTER TABLE currency_rates ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;"
run_psql "CREATE INDEX IF NOT EXISTS idx_currency_rates_active ON currency_rates (base_currency, target_currency, is_active, updated_at);"
run_psql "WITH ranked AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY base_currency, target_currency ORDER BY updated_at DESC, created_at DESC) rn FROM currency_rates) UPDATE currency_rates c SET is_active = (ranked.rn = 1) FROM ranked WHERE ranked.id = c.id;"
run_psql "COMMENT ON COLUMN currency_rates.is_active IS 'True indicates the latest active exchange rate for a currency pair';"

echo "[patch] Completed successfully"
