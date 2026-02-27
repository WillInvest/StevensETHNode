#!/usr/bin/env bash
# Stevens Blockchain Analytics — Cryo Historical Backfill
# Usage: bash scripts/backfill.sh
set -euo pipefail

RPC_URL="${ERIGON_RPC_URL:-http://127.0.0.1:8545}"
DATA_DIR="./data"
mkdir -p "$DATA_DIR"

# Uniswap V3 USDC/WETH pool — Swap events
# Contract: 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640
# Topic0 (Swap): 0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67
echo "=== Extracting Uniswap V3 Swap events ==="
cryo logs \
  --rpc "$RPC_URL" \
  --contract 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640 \
  --topic0 0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67 \
  --blocks 12376729:latest \
  --chunk-size 10000 \
  --output-dir "$DATA_DIR/uniswap_v3_swaps"

echo "=== Done. Parquet files in $DATA_DIR/uniswap_v3_swaps/ ==="
echo "Run scripts/load_parquet.sh to load into PostgreSQL."
