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

# Compound V3 (cUSDCv3) — Supply events
# Contract: 0xc3d688B66703497DAA19211EEdff47f25384cdc3
# Topic0 (Supply): 0xd1cf3d156d5f8f0d50f6c122ed609cec09d35c9b9fb3fff6ea0959134dae424e
echo "=== Extracting Compound V3 Supply events ==="
cryo logs --rpc "$RPC_URL" --contract 0xc3d688B66703497DAA19211EEdff47f25384cdc3 --topic0 0xd1cf3d156d5f8f0d50f6c122ed609cec09d35c9b9fb3fff6ea0959134dae424e --blocks 15331586:latest --chunk-size 10000 --output-dir "$DATA_DIR/compound_v3_supply"

# Compound V3 — Withdraw events
# Topic0 (Withdraw): 0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb
echo "=== Extracting Compound V3 Withdraw events ==="
cryo logs --rpc "$RPC_URL" --contract 0xc3d688B66703497DAA19211EEdff47f25384cdc3 --topic0 0x9b1bfa7fa9ee420a16e124f794c35ac9f90472acc99140eb2f6447c714cad8eb --blocks 15331586:latest --chunk-size 10000 --output-dir "$DATA_DIR/compound_v3_withdraw"

# Compound V3 — AbsorbDebt events
# Topic0 (AbsorbDebt): 0x1547a878dc89ad3c89a844c75c4f1332baef25e97f631a37cf2e3e9adaedb684
echo "=== Extracting Compound V3 AbsorbDebt events ==="
cryo logs --rpc "$RPC_URL" --contract 0xc3d688B66703497DAA19211EEdff47f25384cdc3 --topic0 0x1547a878dc89ad3c89a844c75c4f1332baef25e97f631a37cf2e3e9adaedb684 --blocks 15331586:latest --chunk-size 10000 --output-dir "$DATA_DIR/compound_v3_absorb"

# Curve 3pool — TokenExchange events
# Contract: 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7
# Topic0 (TokenExchange): 0x8b3e96f2b889fa771c53c981b40daf005f63f637f1869f707052d15a3dd97140
echo "=== Extracting Curve TokenExchange events ==="
cryo logs --rpc "$RPC_URL" --contract 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7 --topic0 0x8b3e96f2b889fa771c53c981b40daf005f63f637f1869f707052d15a3dd97140 --blocks 10809473:latest --chunk-size 10000 --output-dir "$DATA_DIR/curve_token_exchange"

# Curve 3pool — AddLiquidity events
# Topic0 (AddLiquidity): 0x423f6495a08fc652425cf4ed0d1f9e37e571d9b9529b1c1c23cce780b2e7df0d
echo "=== Extracting Curve AddLiquidity events ==="
cryo logs --rpc "$RPC_URL" --contract 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7 --topic0 0x423f6495a08fc652425cf4ed0d1f9e37e571d9b9529b1c1c23cce780b2e7df0d --blocks 10809473:latest --chunk-size 10000 --output-dir "$DATA_DIR/curve_add_liquidity"

# Lido stETH — Submitted events
# Contract: 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84
# Topic0 (Submitted): 0x96a25c8ce0baabc1fdefd93e9ed25d8e092a3332f3aa9a41722b5697231d1d1a
echo "=== Extracting Lido Submitted events ==="
cryo logs --rpc "$RPC_URL" --contract 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84 --topic0 0x96a25c8ce0baabc1fdefd93e9ed25d8e092a3332f3aa9a41722b5697231d1d1a --blocks 11473216:latest --chunk-size 10000 --output-dir "$DATA_DIR/lido_submitted"

# Lido stETH — TransferShares events
# Topic0 (TransferShares): 0x9d9c909296d9c674451c0c24f02cb64981eb3b727f99865939192f880a755dcb
echo "=== Extracting Lido TransferShares events ==="
cryo logs --rpc "$RPC_URL" --contract 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84 --topic0 0x9d9c909296d9c674451c0c24f02cb64981eb3b727f99865939192f880a755dcb --blocks 11473216:latest --chunk-size 10000 --output-dir "$DATA_DIR/lido_transfer_shares"

# ERC-20 Transfer events — WETH, USDC, USDT, DAI
# Topic0 (Transfer): 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
echo "=== Extracting ERC-20 Transfer events (WETH) ==="
cryo logs --rpc "$RPC_URL" --contract 0xC02aaA39b223FE8D0A5C4F27eAD9083C756Cc2 --topic0 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef --blocks 4719568:latest --chunk-size 10000 --output-dir "$DATA_DIR/erc20_weth"

echo "=== Extracting ERC-20 Transfer events (USDC) ==="
cryo logs --rpc "$RPC_URL" --contract 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --topic0 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef --blocks 6082465:latest --chunk-size 10000 --output-dir "$DATA_DIR/erc20_usdc"

echo "=== Extracting ERC-20 Transfer events (USDT) ==="
cryo logs --rpc "$RPC_URL" --contract 0xdAC17F958D2ee523a2206206994597C13D831ec7 --topic0 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef --blocks 4634748:latest --chunk-size 10000 --output-dir "$DATA_DIR/erc20_usdt"

echo "=== Extracting ERC-20 Transfer events (DAI) ==="
cryo logs --rpc "$RPC_URL" --contract 0x6B175474E89094C44Da98b954EedeAC495271d0F --topic0 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef --blocks 8928158:latest --chunk-size 10000 --output-dir "$DATA_DIR/erc20_dai"

# Arbitrum Bridge — MessageDelivered events
# Contract: 0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a
# Topic0 (MessageDelivered): 0x5e3c1311ea442664e8b1611bfabef659120ea7a0a2cfc0667700bebc69cbffe1
echo "=== Extracting Arbitrum MessageDelivered events ==="
cryo logs --rpc "$RPC_URL" --contract 0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a --topic0 0x5e3c1311ea442664e8b1611bfabef659120ea7a0a2cfc0667700bebc69cbffe1 --blocks 15411056:latest --chunk-size 10000 --output-dir "$DATA_DIR/arb_message_delivered"

# Optimism Portal — TransactionDeposited events
# Contract: 0xbEb5Fc579115071764c7423A4f12eDde41f106Ed
# Topic0 (TransactionDeposited): 0xb3813568d9991fc951961fcb4c784893574240a28925604d09fc577c55bb7c32
echo "=== Extracting Optimism TransactionDeposited events ==="
cryo logs --rpc "$RPC_URL" --contract 0xbEb5Fc579115071764c7423A4f12eDde41f106Ed --topic0 0xb3813568d9991fc951961fcb4c784893574240a28925604d09fc577c55bb7c32 --blocks 17365801:latest --chunk-size 10000 --output-dir "$DATA_DIR/op_tx_deposited"

# Base Portal — TransactionDeposited events
# Contract: 0x49048044D57e1C92A77f79988d21Fa8fAF36f97
echo "=== Extracting Base TransactionDeposited events ==="
cryo logs --rpc "$RPC_URL" --contract 0x49048044D57e1C92A77f79988d21Fa8fAF36f97 --topic0 0xb3813568d9991fc951961fcb4c784893574240a28925604d09fc577c55bb7c32 --blocks 17482143:latest --chunk-size 10000 --output-dir "$DATA_DIR/base_tx_deposited"

echo "=== Done ==="
echo "Run scripts/load_parquet.sh to load into PostgreSQL."
