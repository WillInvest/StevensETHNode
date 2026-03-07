#!/usr/bin/env bash
# Stevens Blockchain Analytics — CLI Health Check
set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
RPC_URL="${ERIGON_RPC_URL:-http://127.0.0.1:8545}"

echo "=== Stevens Blockchain Health Check ==="
echo ""

# API health
echo -n "API: "
if curl -sf "$API_URL/api/health" > /dev/null 2>&1; then
    echo "OK"
else
    echo "FAIL"
fi

# Erigon RPC
echo -n "Erigon: "
BLOCK=$(curl -sf -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' "$RPC_URL" 2>/dev/null | python3 -c "import sys,json; print(int(json.load(sys.stdin)['result'],16))" 2>/dev/null || echo "FAIL")
if [ "$BLOCK" != "FAIL" ]; then
    echo "OK (block $BLOCK)"
else
    echo "FAIL"
fi

# PostgreSQL
echo -n "Database: "
if psql -U ethnode -d ethnode -c "SELECT 1" > /dev/null 2>&1; then
    TABLES=$(psql -U ethnode -d ethnode -t -c "SELECT count(*) FROM pg_stat_user_tables" 2>/dev/null | tr -d ' ')
    echo "OK ($TABLES tables)"
else
    echo "FAIL"
fi

# Monitoring endpoint
echo ""
echo "=== Monitoring Details ==="
curl -sf "$API_URL/api/monitoring/status" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "Could not fetch monitoring data"
