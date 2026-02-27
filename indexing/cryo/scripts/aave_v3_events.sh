#!/usr/bin/env bash
# Cryo extraction for Aave V3 events (Borrow, Repay, Supply, LiquidationCall)
# Pool: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
# Deploy block: ~16291127 (March 2023 migration)

set -euo pipefail

RPC="${ETH_RPC_URL:-http://127.0.0.1:8545}"
OUTPUT_BASE="data/parquet/aave_v3"
POOL="0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"
START_BLOCK=16291127

echo "=== Extracting Aave V3 Borrow events ==="
cryo logs \
    --contract "$POOL" \
    --event-signature "Borrow(address,address,address,uint256,uint8,uint256,uint16)" \
    --blocks "$START_BLOCK:latest" \
    --output-dir "$OUTPUT_BASE/borrow_events/" \
    --rpc "$RPC" \
    --chunk-size 10000 || true

echo "=== Extracting Aave V3 Repay events ==="
cryo logs \
    --contract "$POOL" \
    --event-signature "Repay(address,address,address,uint256,bool)" \
    --blocks "$START_BLOCK:latest" \
    --output-dir "$OUTPUT_BASE/repay_events/" \
    --rpc "$RPC" \
    --chunk-size 10000 || true

echo "=== Extracting Aave V3 Supply events ==="
cryo logs \
    --contract "$POOL" \
    --event-signature "Supply(address,address,address,uint256,uint16)" \
    --blocks "$START_BLOCK:latest" \
    --output-dir "$OUTPUT_BASE/supply_events/" \
    --rpc "$RPC" \
    --chunk-size 10000 || true

echo "=== Extracting Aave V3 LiquidationCall events ==="
cryo logs \
    --contract "$POOL" \
    --event-signature "LiquidationCall(address,address,address,uint256,uint256,address,bool)" \
    --blocks "$START_BLOCK:latest" \
    --output-dir "$OUTPUT_BASE/liquidation_events/" \
    --rpc "$RPC" \
    --chunk-size 10000 || true

echo "Done. Output in $OUTPUT_BASE/"
