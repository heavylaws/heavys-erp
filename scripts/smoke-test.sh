#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:5000}

echo "Running smoke tests against: $BASE_URL"

function check() {
  local name=$1
  local method=${2:-GET}
  local path=$3
  shift 3 || true
  local extra=($@)
  local status_code
  status_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$path" "${extra[@]}" || true)
  if [ "$status_code" -lt 200 ] || [ "$status_code" -ge 400 ]; then
    echo "[FAIL] $name ($method $path) returned status $status_code"
    return 1
  fi
  echo "[OK] $name ($method $path) returned $status_code"
}

check "Health" GET /health
check "Root page" GET /
check "Products API" GET /api/products
if [ -n "${AUTH_COOKIE:-}" ]; then
  echo "Using AUTH_COOKIE: *** (hidden)"
  check "Favorites API (auth)" "GET" "/api/favorites" -H "Cookie: $AUTH_COOKIE"
else
  echo "Skipping favorites API (requires authentication). Set AUTH_COOKIE env var to test it."
fi
check "Index JS asset" GET /assets/index---4IHZDY.js
check "Products API (Accept JSON)" "GET" "/api/products?limit=1"

# Optional authenticated tests for auto-send-to-barista behavior
if [ -n "${AUTH_COOKIE:-}" ]; then
  if command -v jq >/dev/null 2>&1; then
    echo "Running auto-send-to-barista tests as authenticated user..."
    # Pick a product
    product_id=$(curl -sS -H "Cookie: $AUTH_COOKIE" "$BASE_URL/api/products" | jq -r '.[0].id')
    if [ -z "$product_id" ] || [ "$product_id" = "null" ]; then
      echo "[WARN] No product to test with; skipping auto-send tests"
    else
      # Ensure setting is disabled
      curl -sS -X PUT -H "Content-Type: application/json" -H "Cookie: $AUTH_COOKIE" -d '{"autoSendToBaristaOnCash":false}' "$BASE_URL/api/users/me/settings" >/dev/null || true
      # Create order
      create_resp=$(curl -sS -X POST -H "Content-Type: application/json" -H "Cookie: $AUTH_COOKIE" -d '{"order": {"subtotal": "1.00", "tax":"0.00", "total":"1.00", "status":"pending", "isDelivery":false}, "items": [{"productId":"'"$product_id"'", "quantity":1, "unitPrice":"1.00", "total":"1.00"}]}' "$BASE_URL/api/orders")
      order_id=$(echo "$create_resp" | jq -r '.id')
      if [ -z "$order_id" ] || [ "$order_id" = "null" ]; then
        echo "[WARN] Failed to create order for auto-send test; server response: $create_resp";
      else
        # Process payment as cash
        curl -sS -X PATCH -H "Content-Type: application/json" -H "Cookie: $AUTH_COOKIE" -d '{"paymentMethod":"cash"}' "$BASE_URL/api/orders/$order_id" >/dev/null || true
        # Verify sentToBarista should be false (setting disabled)
        order_get=$(curl -sS -H "Cookie: $AUTH_COOKIE" "$BASE_URL/api/orders/$order_id")
        is_sent=$(echo "$order_get" | jq -r '.sentToBarista')
        if [ "$is_sent" = "true" ]; then
          echo "[FAIL] Order $order_id was sent to barista despite auto-send disabled";
          exit 1
        else
          echo "[OK] Order $order_id not sent to barista with setting disabled"
        fi

        # Enable auto send setting
        curl -sS -X PUT -H "Content-Type: application/json" -H "Cookie: $AUTH_COOKIE" -d '{"autoSendToBaristaOnCash":true}' "$BASE_URL/api/users/me/settings" >/dev/null || true
        # Create new order
        create_resp=$(curl -sS -X POST -H "Content-Type: application/json" -H "Cookie: $AUTH_COOKIE" -d '{"order": {"subtotal": "1.00", "tax":"0.00", "total":"1.00", "status":"pending", "isDelivery":false}, "items": [{"productId":"'"$product_id"'", "quantity":1, "unitPrice":"1.00", "total":"1.00"}]}' "$BASE_URL/api/orders")
        order_id2=$(echo "$create_resp" | jq -r '.id')
        # Process payment
        curl -sS -X PATCH -H "Content-Type: application/json" -H "Cookie: $AUTH_COOKIE" -d '{"paymentMethod":"cash"}' "$BASE_URL/api/orders/$order_id2" >/dev/null || true
        order_get2=$(curl -sS -H "Cookie: $AUTH_COOKIE" "$BASE_URL/api/orders/$order_id2")
        is_sent2=$(echo "$order_get2" | jq -r '.sentToBarista')
        if [ "$is_sent2" != "true" ]; then
          echo "[FAIL] Order $order_id2 was NOT sent to barista after enabling auto-send";
          exit 1
        else
          echo "[OK] Order $order_id2 sent to barista with setting enabled"
        fi
      fi
    fi
  else
    echo "Skipping auto-send-to-barista tests (jq not installed)"
  fi
else
  echo "Skipping auto-send-to-barista tests (requires AUTH_COOKIE)"
fi

echo "All smoke tests passed."
