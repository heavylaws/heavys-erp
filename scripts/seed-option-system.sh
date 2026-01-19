#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILES=(-f docker-compose.production.yml -f docker-compose.override.autogen.yml)
compose() { docker compose "${COMPOSE_FILES[@]}" "$@"; }

echo "[1/8] Building app image (if needed)";
compose build app >/dev/null

echo "[2/8] Starting services";
compose up -d

echo "[3/8] Ensuring Postgres is healthy";
tries=0; until compose exec postgres pg_isready -U postgres -d highway_cafe >/dev/null 2>&1; do
  tries=$((tries+1)); if [ $tries -gt 30 ]; then echo "Postgres not ready after 30 checks" >&2; exit 1; fi; sleep 2; done

echo "[4/8] Applying option system table migration (idempotent)";
if [ -f migrations/20250921_option_system.sql ]; then
  compose exec -T postgres sh -c "cat > /tmp/20250921_option_system.sql" < migrations/20250921_option_system.sql
  compose exec postgres psql -U postgres -d highway_cafe -f /tmp/20250921_option_system.sql >/dev/null
else
  echo "Missing local migrations/20250921_option_system.sql" >&2; exit 1;
fi

echo "[5/8] Applying is_optional column migration (idempotent)";
if [ -f migrations/20250921_add_is_optional_to_recipe_ingredients.sql ]; then
  compose exec -T postgres sh -c "cat > /tmp/20250921_add_is_optional_to_recipe_ingredients.sql" < migrations/20250921_add_is_optional_to_recipe_ingredients.sql
  compose exec postgres psql -U postgres -d highway_cafe -f /tmp/20250921_add_is_optional_to_recipe_ingredients.sql >/dev/null || true
else
  echo "Missing local migrations/20250921_add_is_optional_to_recipe_ingredients.sql" >&2
fi

echo "[6/8] Seeding sample option group + options (idempotent)";
compose exec -T postgres psql -U postgres -d highway_cafe <<'SQL'
-- Create sample option group if not exists
INSERT INTO option_groups (id,name,selection_type,required,is_active)
SELECT 'og-sample','Milk Type','single',true,true
WHERE NOT EXISTS (SELECT 1 FROM option_groups WHERE id='og-sample');

-- Create sample options
INSERT INTO options (id, option_group_id, name, price_adjust, is_default, is_active, display_order)
SELECT 'opt-whole','og-sample','Whole','0',true,true,1
WHERE NOT EXISTS (SELECT 1 FROM options WHERE id='opt-whole');

INSERT INTO options (id, option_group_id, name, price_adjust, is_default, is_active, display_order)
SELECT 'opt-skim','og-sample','Skim','0.20',false,true,2
WHERE NOT EXISTS (SELECT 1 FROM options WHERE id='opt-skim');

INSERT INTO options (id, option_group_id, name, price_adjust, is_default, is_active, display_order)
SELECT 'opt-soy','og-sample','Soy','0.50',false,true,3
WHERE NOT EXISTS (SELECT 1 FROM options WHERE id='opt-soy');

-- Attach to Cappuccino (prod-002) or first ingredient_based product fallback
WITH target AS (
  SELECT id FROM products WHERE id='prod-002' UNION ALL
  SELECT id FROM products WHERE type='ingredient_based' LIMIT 1
), chosen AS (
  SELECT id FROM target LIMIT 1
)
INSERT INTO product_option_groups (id, product_id, option_group_id, display_order, required)
SELECT 'pog-cap-milk', chosen.id, 'og-sample', 1, true
FROM chosen
WHERE NOT EXISTS (SELECT 1 FROM product_option_groups WHERE id='pog-cap-milk');
SQL

echo "[7/8] Verifying installation";
compose exec postgres psql -U postgres -d highway_cafe -c "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' AND tablename LIKE 'option_%' ORDER BY 1;" | sed 's/^/[tables] /'
compose exec postgres psql -U postgres -d highway_cafe -c "SELECT column_name FROM information_schema.columns WHERE table_name='recipe_ingredients';" | sed 's/^/[recipe_cols] /'
compose exec postgres psql -U postgres -d highway_cafe -c "SELECT p.name AS product, og.name AS group_name FROM product_option_groups pog JOIN products p ON p.id=pog.product_id JOIN option_groups og ON og.id= pog.option_group_id WHERE pog.id='pog-cap-milk';" | sed 's/^/[attachment] /'
compose exec postgres psql -U postgres -d highway_cafe -c "SELECT name, price_adjust FROM options WHERE option_group_id='og-sample' ORDER BY display_order;" | sed 's/^/[options] /'

echo "[8/8] Done. Next: place an order in UI picking a Soy option to test pricing.";
echo "If you want inventory deduction, link Soy to Milk:"
echo "docker compose -f docker-compose.production.yml -f docker-compose.override.autogen.yml exec postgres psql -U postgres -d highway_cafe -c \"INSERT INTO option_ingredients (id, option_id, ingredient_id, quantity) VALUES (gen_random_uuid(),'opt-soy','ing-002',150.000) ON CONFLICT DO NOTHING;\""
