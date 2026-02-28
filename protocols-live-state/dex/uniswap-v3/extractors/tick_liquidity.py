"""Extract tick-level liquidity from Uniswap V3 pools via Ethereum RPC.

Connects to an Erigon archive node and reads on-chain state for Uniswap V3
pool contracts.  Iterates through every initialized tick to reconstruct the
full liquidity distribution, then converts to human-readable prices and USD
estimates.

Exports
-------
POOL_CONFIGS : dict
    Metadata for each tracked pool (address, tokens, fee tier, decimals).
get_tick_liquidity(pool_address, rpc_url) -> pandas.DataFrame
    Full tick-level liquidity for a single pool.
get_all_pools_liquidity(rpc_url) -> dict[str, pandas.DataFrame]
    Tick-level liquidity for every pool in POOL_CONFIGS.

Usage
-----
    from tick_liquidity import get_tick_liquidity, POOL_CONFIGS

    df = get_tick_liquidity(POOL_CONFIGS["ETH/USDC 0.05%"]["address"])
    print(df.head())
"""

from __future__ import annotations

import logging
import math
from typing import Any

import pandas as pd
from web3 import Web3

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default RPC endpoint (Erigon archive node)
# ---------------------------------------------------------------------------
DEFAULT_RPC_URL = "http://127.0.0.1:8545"

# ---------------------------------------------------------------------------
# Pool configurations
# ---------------------------------------------------------------------------
POOL_CONFIGS: dict[str, dict[str, Any]] = {
    "ETH/USDC 0.05%": {
        "address": "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
        "token0": {"symbol": "USDC", "decimals": 6},
        "token1": {"symbol": "WETH", "decimals": 18},
        "fee": 500,
        "description": "Highest-volume ETH/USDC pool (5 bps fee tier)",
    },
    "ETH/USDC 0.3%": {
        "address": "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
        "token0": {"symbol": "USDC", "decimals": 6},
        "token1": {"symbol": "WETH", "decimals": 18},
        "fee": 3000,
        "description": "ETH/USDC pool at 30 bps fee tier",
    },
    "ETH/USDT 0.3%": {
        "address": "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
        "token0": {"symbol": "USDT", "decimals": 6},
        "token1": {"symbol": "WETH", "decimals": 18},
        "fee": 3000,
        "description": "ETH/USDT pool at 30 bps fee tier",
    },
    "WBTC/ETH 0.3%": {
        "address": "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",
        "token0": {"symbol": "WBTC", "decimals": 8},
        "token1": {"symbol": "WETH", "decimals": 18},
        "fee": 3000,
        "description": "WBTC/ETH pool at 30 bps fee tier",
    },
}

# ---------------------------------------------------------------------------
# Minimal ABI fragments for Uniswap V3 Pool
# ---------------------------------------------------------------------------
POOL_ABI = [
    {
        "inputs": [],
        "name": "slot0",
        "outputs": [
            {"internalType": "uint160", "name": "sqrtPriceX96", "type": "uint160"},
            {"internalType": "int24", "name": "tick", "type": "int24"},
            {"internalType": "uint16", "name": "observationIndex", "type": "uint16"},
            {
                "internalType": "uint16",
                "name": "observationCardinality",
                "type": "uint16",
            },
            {
                "internalType": "uint16",
                "name": "observationCardinalityNext",
                "type": "uint16",
            },
            {"internalType": "uint8", "name": "feeProtocol", "type": "uint8"},
            {"internalType": "bool", "name": "unlocked", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "liquidity",
        "outputs": [
            {"internalType": "uint128", "name": "", "type": "uint128"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "tickSpacing",
        "outputs": [
            {"internalType": "int24", "name": "", "type": "int24"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "int24", "name": "tick", "type": "int24"},
        ],
        "name": "ticks",
        "outputs": [
            {
                "internalType": "uint128",
                "name": "liquidityGross",
                "type": "uint128",
            },
            {
                "internalType": "int128",
                "name": "liquidityNet",
                "type": "int128",
            },
            {
                "internalType": "uint256",
                "name": "feeGrowthOutside0X128",
                "type": "uint256",
            },
            {
                "internalType": "uint256",
                "name": "feeGrowthOutside1X128",
                "type": "uint256",
            },
            {
                "internalType": "int56",
                "name": "tickCumulativeOutside",
                "type": "int56",
            },
            {
                "internalType": "uint160",
                "name": "secondsPerLiquidityOutsideX128",
                "type": "uint160",
            },
            {
                "internalType": "uint32",
                "name": "secondsOutside",
                "type": "uint32",
            },
            {
                "internalType": "bool",
                "name": "initialized",
                "type": "bool",
            },
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "int16", "name": "wordPosition", "type": "int16"},
        ],
        "name": "tickBitmap",
        "outputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
]

# ---------------------------------------------------------------------------
# Uniswap V3 tick math constants
# ---------------------------------------------------------------------------
MIN_TICK = -887272
MAX_TICK = 887272
Q96 = 2**96


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _tick_to_price(tick: int, decimals0: int, decimals1: int) -> float:
    """Convert a Uniswap V3 tick to a human-readable price.

    In Uniswap V3, ``1.0001 ** tick = token1_base / token0_base``.
    To get the price of token1 in token0 (human units), e.g. ETH price
    in USDC for a USDC/WETH pool:

        price = 10**(decimals1 - decimals0) / (1.0001 ** tick)

    Returns the price of token1 in terms of token0.
    """
    raw_price = 1.0001**tick  # token1_base / token0_base
    if raw_price == 0:
        return 0.0
    decimal_adjustment = 10 ** (decimals1 - decimals0)
    return decimal_adjustment / raw_price


def _price_to_tick(price: float, decimals0: int, decimals1: int) -> float:
    """Convert a human-readable price to the corresponding Uniswap V3 tick.

    Inverse of ``_tick_to_price``::

        tick = log(10^(decimals1 - decimals0) / price) / log(1.0001)
    """
    if price <= 0:
        return 0.0
    decimal_adjustment = 10 ** (decimals1 - decimals0)
    return math.log(decimal_adjustment / price) / math.log(1.0001)


def _sqrt_price_to_price(
    sqrt_price_x96: int, decimals0: int, decimals1: int
) -> float:
    """Convert sqrtPriceX96 to a human-readable price of token1 in token0.

    In Uniswap V3, ``(sqrtPriceX96 / 2**96)**2 = token1_base / token0_base``.
    To get token1 price in token0 terms (e.g. ETH in USDC):

        price = 10**(decimals1 - decimals0) / raw_price
    """
    price_raw = (sqrt_price_x96 / Q96) ** 2  # token1_base / token0_base
    if price_raw == 0:
        return 0.0
    decimal_adjustment = 10 ** (decimals1 - decimals0)
    return decimal_adjustment / price_raw


def _get_initialized_ticks_from_bitmap(
    contract, tick_spacing: int, *, w3: Web3 | None = None,
    tick_range: tuple[int, int] | None = None,
) -> list[int]:
    """Scan the tick bitmap to find every initialized tick.

    The Uniswap V3 tick bitmap stores 256 ticks per word.  Each word position
    corresponds to a range of ``256 * tick_spacing`` ticks.  We iterate over
    the full word-position range implied by MIN_TICK / MAX_TICK, fetch each
    non-zero bitmap word, and decode the set bit positions into tick indices.

    Uses batch RPC (web3.py 7.12+) when a Web3 instance is provided,
    sending up to 200 tickBitmap calls per batch for ~10-50x speedup.

    Parameters
    ----------
    contract : web3 Contract
        Bound Uniswap V3 pool contract instance.
    tick_spacing : int
        The pool's tick spacing (e.g. 10 for 0.05%, 60 for 0.3%).
    w3 : Web3 | None
        Web3 instance for batch requests. Falls back to sequential if None.
    tick_range : tuple[int, int] | None
        Optional (min_tick, max_tick) to limit the bitmap scan.  When provided,
        only word positions covering this range are fetched, dramatically
        reducing RPC calls for narrow price windows.

    Returns
    -------
    list[int]
        Sorted list of every initialized tick index.
    """
    if tick_range is not None:
        min_word = math.floor(tick_range[0] / tick_spacing) >> 8
        max_word = math.ceil(tick_range[1] / tick_spacing) >> 8
    else:
        min_word = math.floor(MIN_TICK / tick_spacing) >> 8
        max_word = math.ceil(MAX_TICK / tick_spacing) >> 8

    all_word_positions = list(range(min_word, max_word + 1))
    initialized_ticks: list[int] = []

    BITMAP_BATCH_SIZE = 200

    if w3 is not None and hasattr(w3, "batch_requests"):
        # Batch RPC path
        for batch_start in range(0, len(all_word_positions), BITMAP_BATCH_SIZE):
            batch_words = all_word_positions[batch_start:batch_start + BITMAP_BATCH_SIZE]
            try:
                with w3.batch_requests() as batch:
                    for wp in batch_words:
                        batch.add(contract.functions.tickBitmap(wp))
                    results = batch.execute()

                for wp, bitmap in zip(batch_words, results):
                    if bitmap == 0:
                        continue
                    for bit_pos in range(256):
                        if bitmap & (1 << bit_pos):
                            compressed = (wp << 8) + bit_pos
                            tick = compressed * tick_spacing
                            if MIN_TICK <= tick <= MAX_TICK:
                                initialized_ticks.append(tick)
            except Exception as exc:
                logger.warning("Batch bitmap failed, falling back to sequential: %s", exc)
                for wp in batch_words:
                    bitmap = contract.functions.tickBitmap(wp).call()
                    if bitmap == 0:
                        continue
                    for bit_pos in range(256):
                        if bitmap & (1 << bit_pos):
                            compressed = (wp << 8) + bit_pos
                            tick = compressed * tick_spacing
                            if MIN_TICK <= tick <= MAX_TICK:
                                initialized_ticks.append(tick)
    else:
        # Sequential fallback (original behavior)
        for word_pos in all_word_positions:
            bitmap: int = contract.functions.tickBitmap(word_pos).call()
            if bitmap == 0:
                continue
            for bit_pos in range(256):
                if bitmap & (1 << bit_pos):
                    compressed = (word_pos << 8) + bit_pos
                    tick = compressed * tick_spacing
                    if MIN_TICK <= tick <= MAX_TICK:
                        initialized_ticks.append(tick)

    initialized_ticks.sort()
    return initialized_ticks


def _estimate_liquidity_usd(
    liquidity: int,
    sqrt_price_x96: int,
    tick: int,
    decimals0: int,
    decimals1: int,
    eth_price_usd: float,
    pool_name: str,
) -> float:
    """Rough USD estimate for the liquidity at a given tick.

    Uses the relationship between liquidity (L), sqrtPrice, and token amounts
    to estimate the virtual reserves at the current price, then converts to
    USD.  This is an approximation -- exact accounting would require computing
    the amounts within the specific tick range.

    For a tick range [tick_lower, tick_upper] with the current price inside:
        amount0 = L * (1/sqrt(price) - 1/sqrt(price_upper))
        amount1 = L * (sqrt(price) - sqrt(price_lower))

    We simplify by estimating total value as ``L * 2 * sqrt(price)`` in base
    units, then adjust for decimals and USD conversion.
    """
    if liquidity == 0:
        return 0.0

    sqrt_price = sqrt_price_x96 / Q96
    if sqrt_price == 0:
        return 0.0

    # Approximate: for a concentrated position near the current price, value
    # is proportional to L.  We use the geometric-mean approach.
    #   virtual_amount1 = L * sqrt_price / 10^decimals1
    #   virtual_amount0 = L / sqrt_price / 10^decimals0
    #   total ≈ 2 * L / sqrt_price / 10^decimals0 (in token0 units)
    # Then convert to USD.
    try:
        virtual_amount0 = liquidity / sqrt_price / (10**decimals0)
        virtual_amount1 = liquidity * sqrt_price / (10**decimals1)

        # Convert to USD depending on what the tokens are
        if "USDC" in pool_name or "USDT" in pool_name:
            # token0 is the stablecoin
            usd_value = virtual_amount0 + virtual_amount1 * eth_price_usd
        elif "WBTC" in pool_name:
            # WBTC/ETH -- both need conversion to USD
            usd_value = (
                virtual_amount0 * eth_price_usd * 20  # rough BTC/ETH ≈ 20
                + virtual_amount1 * eth_price_usd
            )
        else:
            usd_value = virtual_amount0 + virtual_amount1
        return usd_value
    except (OverflowError, ZeroDivisionError):
        return 0.0


def _fetch_eth_price_usd(w3: Web3) -> float:
    """Fetch approximate ETH/USD price from the ETH/USDC 0.05% pool.

    Uses the sqrtPriceX96 from slot0 as the most liquid on-chain price
    source.  Falls back to a hardcoded estimate on error.
    """
    try:
        pool = w3.eth.contract(
            address=Web3.to_checksum_address(
                POOL_CONFIGS["ETH/USDC 0.05%"]["address"]
            ),
            abi=POOL_ABI,
        )
        slot0 = pool.functions.slot0().call()
        sqrt_price_x96 = slot0[0]
        # USDC (6 decimals) is token0, WETH (18 decimals) is token1
        price = _sqrt_price_to_price(sqrt_price_x96, 6, 18)
        logger.info("ETH price from on-chain: $%.2f", price)
        return price
    except Exception as exc:
        logger.warning(
            "Failed to fetch ETH price on-chain, using fallback: %s", exc
        )
        return 2500.0  # reasonable fallback


# ---------------------------------------------------------------------------
# Main extraction functions
# ---------------------------------------------------------------------------


def get_tick_liquidity(
    pool_address: str,
    rpc_url: str = DEFAULT_RPC_URL,
    *,
    block_identifier: str | int = "latest",
    price_pct_range: float | None = None,
) -> pd.DataFrame:
    """Extract tick-level liquidity for a single Uniswap V3 pool.

    Connects to the Ethereum RPC, reads the pool's slot0 (current tick and
    sqrtPriceX96), fetches tickSpacing, iterates through the tick bitmap to
    discover all initialized ticks, then queries each tick's liquidityNet.
    Cumulative liquidity is reconstructed by summing liquidityNet from the
    lowest initialized tick up to each subsequent tick.

    Parameters
    ----------
    pool_address : str
        Checksummed or non-checksummed Ethereum address of the pool.
    rpc_url : str
        JSON-RPC endpoint URL.  Defaults to the local Erigon archive node.
    block_identifier : str | int
        Block number or "latest".  Useful for historical snapshots on an
        archive node.

    Returns
    -------
    pandas.DataFrame
        Columns: tick, price, liquidity, liquidity_usd, liquidity_net,
                 is_current_tick.
        Sorted by tick ascending.

    Raises
    ------
    ConnectionError
        If the RPC endpoint is unreachable.
    ValueError
        If the pool address is invalid or the contract does not respond.
    """
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise ConnectionError(f"Cannot connect to RPC at {rpc_url}")

    address = Web3.to_checksum_address(pool_address)
    contract = w3.eth.contract(address=address, abi=POOL_ABI)

    # Resolve pool metadata from POOL_CONFIGS, falling back to generic values
    pool_meta = None
    for name, cfg in POOL_CONFIGS.items():
        if Web3.to_checksum_address(cfg["address"]) == address:
            pool_meta = cfg
            pool_name = name
            break
    if pool_meta is None:
        logger.warning(
            "Pool %s not in POOL_CONFIGS; using default decimals (18/18)",
            address,
        )
        pool_meta = {
            "token0": {"symbol": "TOKEN0", "decimals": 18},
            "token1": {"symbol": "TOKEN1", "decimals": 18},
        }
        pool_name = "UNKNOWN"

    decimals0 = pool_meta["token0"]["decimals"]
    decimals1 = pool_meta["token1"]["decimals"]

    # ------------------------------------------------------------------
    # Step 1: Read current pool state from slot0 and liquidity()
    # ------------------------------------------------------------------
    logger.info("Reading slot0 for pool %s ...", address)
    slot0 = contract.functions.slot0().call(block_identifier=block_identifier)
    sqrt_price_x96: int = slot0[0]
    current_tick: int = slot0[1]

    current_liquidity: int = contract.functions.liquidity().call(
        block_identifier=block_identifier
    )
    tick_spacing: int = contract.functions.tickSpacing().call(
        block_identifier=block_identifier
    )

    current_price = _sqrt_price_to_price(sqrt_price_x96, decimals0, decimals1)
    logger.info(
        "Pool %s: tick=%d, sqrtPriceX96=%d, liquidity=%d, tickSpacing=%d, "
        "price=%.4f",
        pool_name,
        current_tick,
        sqrt_price_x96,
        current_liquidity,
        tick_spacing,
        current_price,
    )

    # ------------------------------------------------------------------
    # Step 2: Discover all initialized ticks via the bitmap
    # ------------------------------------------------------------------
    tick_range = None
    if price_pct_range is not None and current_price > 0:
        low_price = current_price * (1 - price_pct_range)
        high_price = current_price * (1 + price_pct_range)
        # Price is inversely related to tick: lower price → higher tick
        tick_high = int(math.ceil(_price_to_tick(low_price, decimals0, decimals1)))
        tick_low = int(math.floor(_price_to_tick(high_price, decimals0, decimals1)))
        tick_range = (tick_low, tick_high)
        logger.info(
            "Price range $%.2f–$%.2f → tick range %d to %d",
            low_price, high_price, tick_low, tick_high,
        )

    logger.info("Scanning tick bitmap%s ...", f" (filtered)" if tick_range else "")
    initialized_ticks = _get_initialized_ticks_from_bitmap(
        contract, tick_spacing, w3=w3, tick_range=tick_range
    )
    logger.info("Found %d initialized ticks.", len(initialized_ticks))

    if not initialized_ticks:
        logger.warning("No initialized ticks found for pool %s", address)
        return pd.DataFrame(
            columns=[
                "tick",
                "price",
                "liquidity",
                "liquidity_usd",
                "liquidity_net",
                "is_current_tick",
            ]
        )

    # ------------------------------------------------------------------
    # Step 3: Fetch liquidityNet for every initialized tick
    # ------------------------------------------------------------------
    logger.info("Fetching liquidityNet for %d ticks ...", len(initialized_ticks))
    tick_data: list[dict[str, Any]] = []
    TICK_BATCH_SIZE = 100

    if hasattr(w3, "batch_requests"):
        # Batch RPC path
        for batch_start in range(0, len(initialized_ticks), TICK_BATCH_SIZE):
            batch_ticks = initialized_ticks[batch_start:batch_start + TICK_BATCH_SIZE]
            try:
                with w3.batch_requests() as batch:
                    for t in batch_ticks:
                        batch.add(contract.functions.ticks(t))
                    results = batch.execute()

                for t, info in zip(batch_ticks, results):
                    tick_data.append({
                        "tick": t,
                        "liquidity_gross": info[0],
                        "liquidity_net": info[1],
                    })
            except Exception as exc:
                logger.warning("Batch ticks failed, falling back to sequential: %s", exc)
                for t in batch_ticks:
                    info = contract.functions.ticks(t).call(block_identifier=block_identifier)
                    tick_data.append({
                        "tick": t,
                        "liquidity_gross": info[0],
                        "liquidity_net": info[1],
                    })
    else:
        # Sequential fallback
        for t in initialized_ticks:
            info = contract.functions.ticks(t).call(block_identifier=block_identifier)
            tick_data.append({
                "tick": t,
                "liquidity_gross": info[0],
                "liquidity_net": info[1],
            })

    # ------------------------------------------------------------------
    # Step 4: Reconstruct cumulative liquidity
    #
    # Uniswap V3 stores liquidityNet at each initialized tick.  When the
    # price crosses a tick going left-to-right (increasing tick), the
    # active liquidity is adjusted by += liquidityNet.
    #
    # To reconstruct L at every tick:
    #   - Start with L = 0 below the lowest initialized tick.
    #   - At each tick, L += liquidityNet.
    #   - The value after processing a tick is the liquidity active in the
    #     range [tick, next_tick).
    #
    # Verification: L at the current tick range should equal the pool's
    # reported liquidity().
    # ------------------------------------------------------------------
    logger.info("Reconstructing cumulative liquidity ...")

    # When scanning a subrange, we don't have ticks below the range so
    # cumulative starting from 0 would be wrong.  Use pool.liquidity()
    # (the active liquidity at the current tick) to compute the correct
    # starting offset.
    starting_liquidity = 0
    if tick_range is not None:
        partial_sum = sum(
            entry["liquidity_net"]
            for entry in tick_data
            if entry["tick"] <= current_tick
        )
        starting_liquidity = current_liquidity - partial_sum

    cumulative_liquidity = starting_liquidity
    rows: list[dict[str, Any]] = []

    # Fetch ETH price for USD estimates
    eth_price_usd = _fetch_eth_price_usd(w3)

    for entry in tick_data:
        t = entry["tick"]
        net = entry["liquidity_net"]
        cumulative_liquidity += net

        price = _tick_to_price(t, decimals0, decimals1)
        liq_usd = _estimate_liquidity_usd(
            cumulative_liquidity,
            sqrt_price_x96,
            t,
            decimals0,
            decimals1,
            eth_price_usd,
            pool_name,
        )

        # Identify whether this tick range contains the current tick
        is_current = False
        idx = tick_data.index(entry)
        if idx < len(tick_data) - 1:
            next_tick = tick_data[idx + 1]["tick"]
            is_current = t <= current_tick < next_tick
        else:
            is_current = t <= current_tick

        rows.append(
            {
                "tick": t,
                "price": price,
                "liquidity": cumulative_liquidity,
                "liquidity_usd": liq_usd,
                "liquidity_net": net,
                "is_current_tick": is_current,
            }
        )

    df = pd.DataFrame(rows)

    # ------------------------------------------------------------------
    # Step 5: Sanity check -- cumulative L at the current tick should
    # match pool.liquidity().
    # ------------------------------------------------------------------
    current_range_rows = df[df["is_current_tick"]]
    if not current_range_rows.empty:
        reconstructed_l = int(current_range_rows.iloc[0]["liquidity"])
        if reconstructed_l != current_liquidity:
            logger.warning(
                "Liquidity mismatch at current tick: reconstructed=%d, "
                "pool.liquidity()=%d (delta=%d). This can happen if the "
                "pool state changed between RPC calls.",
                reconstructed_l,
                current_liquidity,
                abs(reconstructed_l - current_liquidity),
            )
        else:
            logger.info(
                "Liquidity verification passed: reconstructed matches "
                "pool.liquidity() = %d",
                current_liquidity,
            )

    # Add pool metadata to the DataFrame attrs for downstream consumers
    df.attrs["pool_address"] = address
    df.attrs["pool_name"] = pool_name
    df.attrs["current_tick"] = current_tick
    df.attrs["current_price"] = current_price
    df.attrs["sqrt_price_x96"] = sqrt_price_x96
    df.attrs["tick_spacing"] = tick_spacing
    df.attrs["block_identifier"] = block_identifier

    logger.info(
        "Extraction complete for %s: %d tick rows, current price=%.2f",
        pool_name,
        len(df),
        current_price,
    )
    return df


def get_all_pools_liquidity(
    rpc_url: str = DEFAULT_RPC_URL,
    *,
    block_identifier: str | int = "latest",
) -> dict[str, pd.DataFrame]:
    """Extract tick-level liquidity for all pools in POOL_CONFIGS.

    Parameters
    ----------
    rpc_url : str
        JSON-RPC endpoint URL.
    block_identifier : str | int
        Block number or "latest".

    Returns
    -------
    dict[str, pandas.DataFrame]
        Mapping from pool name (e.g. "ETH/USDC 0.05%") to the tick
        liquidity DataFrame.  Pools that fail extraction are logged and
        omitted from the result.
    """
    results: dict[str, pd.DataFrame] = {}
    for name, cfg in POOL_CONFIGS.items():
        logger.info("--- Extracting %s ---", name)
        try:
            df = get_tick_liquidity(
                cfg["address"],
                rpc_url=rpc_url,
                block_identifier=block_identifier,
            )
            results[name] = df
            logger.info(
                "%s: %d ticks extracted.", name, len(df)
            )
        except Exception as exc:
            logger.error("Failed to extract %s: %s", name, exc, exc_info=True)
    return results


# ---------------------------------------------------------------------------
# CLI convenience
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    pool_arg = sys.argv[1] if len(sys.argv) > 1 else None
    rpc = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_RPC_URL

    if pool_arg and pool_arg.startswith("0x"):
        # Direct address mode
        df = get_tick_liquidity(pool_arg, rpc_url=rpc)
        print(f"\n{df.attrs.get('pool_name', pool_arg)}")
        print(f"Current price: {df.attrs.get('current_price', 'N/A')}")
        print(f"Rows: {len(df)}")
        print(df.to_string(index=False, max_rows=40))
    elif pool_arg and pool_arg in POOL_CONFIGS:
        # Named pool mode
        df = get_tick_liquidity(
            POOL_CONFIGS[pool_arg]["address"], rpc_url=rpc
        )
        print(f"\n{pool_arg}")
        print(f"Current price: {df.attrs.get('current_price', 'N/A')}")
        print(f"Rows: {len(df)}")
        print(df.to_string(index=False, max_rows=40))
    else:
        # All pools
        if pool_arg:
            print(f"Unknown pool '{pool_arg}'. Extracting all pools.")
        results = get_all_pools_liquidity(rpc_url=rpc)
        for name, df in results.items():
            print(f"\n{'='*60}")
            print(f"{name}")
            print(f"Current price: {df.attrs.get('current_price', 'N/A')}")
            print(f"Rows: {len(df)}")
            print(df.head(20).to_string(index=False))
            print("...")
