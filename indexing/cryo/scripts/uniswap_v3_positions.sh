#!/usr/bin/env bash
# Cryo extraction for Uniswap V3 LP events (Mint, Burn, Swap)
# Used for historical P(x) reconstruction.
#
# Pools:
# - ETH/USDC 0.05%: 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640
# - ETH/USDC 0.3%:  0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8
# - ETH/USDT 0.3%:  0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36
# - WBTC/ETH 0.3%:  0xCBCdF9626bC03E24f779434178A73a0B4bad62eD

set -euo pipefail

RPC="${ETH_RPC_URL:-http://127.0.0.1:8545}"
OUTPUT_BASE="data/parquet/uniswap_v3"

POOLS=(
    "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640"
    "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
    "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36"
    "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD"
)

for POOL in "${POOLS[@]}"; do
    echo "=== Extracting Mint events for $POOL ==="
    cryo logs \
        --contract "$POOL" \
        --event-signature "Mint(address,address,int24,int24,uint128,uint256,uint256)" \
        --blocks 12370000:latest \
        --output-dir "$OUTPUT_BASE/mint_events/$POOL/" \
        --rpc "$RPC" \
        --chunk-size 10000 || true

    echo "=== Extracting Burn events for $POOL ==="
    cryo logs \
        --contract "$POOL" \
        --event-signature "Burn(address,int24,int24,uint128,uint256,uint256)" \
        --blocks 12370000:latest \
        --output-dir "$OUTPUT_BASE/burn_events/$POOL/" \
        --rpc "$RPC" \
        --chunk-size 10000 || true

    echo "=== Extracting Swap events for $POOL ==="
    cryo logs \
        --contract "$POOL" \
        --event-signature "Swap(address,address,int256,int256,uint160,uint128,int24)" \
        --blocks 12370000:latest \
        --output-dir "$OUTPUT_BASE/swap_events/$POOL/" \
        --rpc "$RPC" \
        --chunk-size 10000 || true
done

echo "Done. Output in $OUTPUT_BASE/"
