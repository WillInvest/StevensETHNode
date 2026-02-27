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

# Aave V3 Pool — Supply events
# Contract: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
# Topic0 (Supply): 0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61
echo "=== Extracting Aave V3 Supply events ==="
cryo logs --rpc "$RPC_URL" --contract 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 --topic0 0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61 --blocks 16291127:latest --chunk-size 10000 --output-dir "$DATA_DIR/aave_v3_supply"

# Aave V3 Pool — Borrow events
# Topic0 (Borrow): 0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0
echo "=== Extracting Aave V3 Borrow events ==="
cryo logs --rpc "$RPC_URL" --contract 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 --topic0 0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0 --blocks 16291127:latest --chunk-size 10000 --output-dir "$DATA_DIR/aave_v3_borrow"

# Aave V3 Pool — Repay events
# Topic0 (Repay): 0xa534c8dbe71f871f9f3f77571f15f067af254a02ed17c201b13d8f2a4bb71533
echo "=== Extracting Aave V3 Repay events ==="
cryo logs --rpc "$RPC_URL" --contract 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 --topic0 0xa534c8dbe71f871f9f3f77571f15f067af254a02ed17c201b13d8f2a4bb71533 --blocks 16291127:latest --chunk-size 10000 --output-dir "$DATA_DIR/aave_v3_repay"

# Aave V3 Pool — LiquidationCall events
# Topic0 (LiquidationCall): 0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286
echo "=== Extracting Aave V3 LiquidationCall events ==="
cryo logs --rpc "$RPC_URL" --contract 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 --topic0 0xe413a321e8681d831f4dbccbca790d2952b56f977908e45be37335533e005286 --blocks 16291127:latest --chunk-size 10000 --output-dir "$DATA_DIR/aave_v3_liquidation"

echo "=== Done ==="
echo "Run scripts/load_parquet.sh to load into PostgreSQL."
