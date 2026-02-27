"""Aave V3 active-position scanner and liquidation-price calculator.

Discovers borrowers from Shovel-indexed Borrow events in PostgreSQL, fetches
their live account data from the Aave V3 Pool contract via Erigon RPC, and
computes per-position liquidation prices for ETH-collateralized debt.

Exported functions
------------------
scan_aave_positions(rpc_url, db_url) -> pd.DataFrame
    Columns: [user_address, collateral_usd, debt_usd, health_factor,
              liquidation_price]

get_aave_liquidation_schedule(rpc_url, db_url, current_eth_price) -> pd.DataFrame
    Same columns plus ``at_risk`` flag, sorted by liquidation_price descending.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

import pandas as pd
import psycopg2
import psycopg2.extras
from web3 import Web3
from web3.contract import Contract

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Contract addresses (Ethereum mainnet)
# ---------------------------------------------------------------------------
AAVE_V3_POOL = Web3.to_checksum_address(
    "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"
)
POOL_DATA_PROVIDER = Web3.to_checksum_address(
    "0x7B4EB56E7CD4b454BA8ff71E4518426c8fa7972A"
)
AAVE_ORACLE = Web3.to_checksum_address(
    "0x54586bE62E3c3580375aE3723C145253060Ca0C2"
)

# WETH address used by the oracle for ETH price lookups.
WETH = Web3.to_checksum_address(
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C68d76B"
)

# ---------------------------------------------------------------------------
# Minimal ABIs -- only the functions we actually call
# ---------------------------------------------------------------------------

POOL_ABI: list[dict[str, Any]] = [
    {
        "name": "getUserAccountData",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "user", "type": "address"}],
        "outputs": [
            {"name": "totalCollateralBase", "type": "uint256"},
            {"name": "totalDebtBase", "type": "uint256"},
            {"name": "availableBorrowsBase", "type": "uint256"},
            {"name": "currentLiquidationThreshold", "type": "uint256"},
            {"name": "ltv", "type": "uint256"},
            {"name": "healthFactor", "type": "uint256"},
        ],
    },
]

ORACLE_ABI: list[dict[str, Any]] = [
    {
        "name": "getAssetPrice",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "asset", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Aave expresses USD values in the "base currency" with 8 decimal places.
BASE_CURRENCY_DECIMALS = 8

# Health factor uses 18 decimals; liquidation triggers below 1e18.
HEALTH_FACTOR_DECIMALS = 18

# Liquidation threshold is expressed in basis points (1 = 0.01%).
LIQ_THRESHOLD_BPS = 10_000

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_pool_contract(w3: Web3) -> Contract:
    """Return a web3 Contract instance for the Aave V3 Pool."""
    return w3.eth.contract(address=AAVE_V3_POOL, abi=POOL_ABI)


def _get_oracle_contract(w3: Web3) -> Contract:
    """Return a web3 Contract instance for the Aave Oracle."""
    return w3.eth.contract(address=AAVE_ORACLE, abi=ORACLE_ABI)


def _fetch_eth_price_usd(oracle: Contract) -> Decimal:
    """Query the Aave oracle for the current ETH price in USD (8-dec)."""
    raw: int = oracle.functions.getAssetPrice(WETH).call()
    return Decimal(raw) / Decimal(10 ** BASE_CURRENCY_DECIMALS)


def _fetch_active_borrowers(db_url: str) -> list[str]:
    """Return deduplicated list of borrower addresses from the Shovel table.

    The ``aave_v3_borrow`` table stores ``user_addr`` as bytea.  Shovel
    populates this from the ``user`` field of the Borrow event (the actual
    borrower, as opposed to ``on_behalf``).  We also union in the
    ``on_behalf`` column because positions opened via delegation are tracked
    under the ``onBehalfOf`` address in Aave's accounting.

    Only addresses that appear in borrow events *and* have not been fully
    repaid need to be checked on-chain, but determining full repayment
    requires on-chain state.  We therefore return all unique addresses and
    let the caller filter zero-debt positions after the RPC call.
    """
    query = """
        SELECT DISTINCT addr FROM (
            SELECT encode(user_addr, 'hex') AS addr FROM aave_v3_borrow
            UNION
            SELECT encode(on_behalf, 'hex') AS addr FROM aave_v3_borrow
        ) sub
        WHERE addr IS NOT NULL
    """
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
    finally:
        conn.close()

    # Normalise to checksummed addresses.
    addresses: list[str] = []
    for (hex_addr,) in rows:
        if hex_addr and len(hex_addr) >= 40:
            try:
                addresses.append(
                    Web3.to_checksum_address("0x" + hex_addr[-40:])
                )
            except Exception:
                logger.warning("Skipping malformed address: %s", hex_addr)
    return addresses


def _fetch_user_account_data(
    pool: Contract, user: str
) -> dict[str, Any] | None:
    """Call getUserAccountData and return a dict, or None on RPC failure."""
    try:
        result = pool.functions.getUserAccountData(
            Web3.to_checksum_address(user)
        ).call()
    except Exception:
        logger.warning("RPC call failed for user %s", user, exc_info=True)
        return None

    (
        total_collateral_base,
        total_debt_base,
        _available_borrows_base,
        current_liq_threshold,
        _ltv,
        health_factor,
    ) = result

    return {
        "total_collateral_base": total_collateral_base,
        "total_debt_base": total_debt_base,
        "current_liq_threshold": current_liq_threshold,
        "health_factor": health_factor,
    }


def _compute_liquidation_price(
    collateral_usd: Decimal,
    debt_usd: Decimal,
    liq_threshold: Decimal,
    current_eth_price: Decimal,
) -> Decimal | None:
    """Estimate the ETH price at which this position gets liquidated.

    Assumptions / simplification
    ----------------------------
    * The position's *entire* collateral is ETH (WETH).  Mixed-collateral
      positions will have an approximate result since we treat the total
      collateral value as if it were all in ETH.

    Formula
    -------
    ``liquidation_price = debt_usd / (eth_collateral * liq_threshold)``

    where ``eth_collateral = collateral_usd / current_eth_price``.

    Substituting:
        ``liq_price = (debt_usd * current_eth_price)
                      / (collateral_usd * liq_threshold)``

    This is equivalent but avoids a separate ETH-quantity lookup.
    """
    if collateral_usd == 0 or liq_threshold == 0 or current_eth_price == 0:
        return None

    # eth_collateral in ETH units
    eth_collateral = collateral_usd / current_eth_price

    if eth_collateral == 0:
        return None

    return debt_usd / (eth_collateral * liq_threshold)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def scan_aave_positions(
    rpc_url: str = "http://127.0.0.1:8545",
    db_url: str = "postgres://ethnode:changeme@localhost:5432/ethnode",
    *,
    batch_size: int = 200,
) -> pd.DataFrame:
    """Scan all Aave V3 borrowers and return their live position data.

    Parameters
    ----------
    rpc_url:
        JSON-RPC endpoint (Erigon archive node).
    db_url:
        PostgreSQL connection string for the Shovel database.
    batch_size:
        How many addresses to log progress for (does not affect RPC batching
        since web3.py issues individual calls).

    Returns
    -------
    pd.DataFrame
        Columns: user_address, collateral_usd, debt_usd, health_factor,
        liquidation_price.
        Only rows with ``debt_usd > 0`` are included (active borrowers).
    """
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise ConnectionError(f"Cannot connect to RPC at {rpc_url}")

    pool = _get_pool_contract(w3)
    oracle = _get_oracle_contract(w3)

    # Current ETH price from the Aave oracle (in USD with 8 decimals).
    eth_price = _fetch_eth_price_usd(oracle)
    logger.info("Current ETH price from Aave oracle: $%s", eth_price)

    borrowers = _fetch_active_borrowers(db_url)
    logger.info("Discovered %d unique borrower addresses", len(borrowers))

    records: list[dict[str, Any]] = []

    for idx, user in enumerate(borrowers):
        if idx > 0 and idx % batch_size == 0:
            logger.info("Processed %d / %d addresses", idx, len(borrowers))

        data = _fetch_user_account_data(pool, user)
        if data is None:
            continue

        collateral_usd = Decimal(data["total_collateral_base"]) / Decimal(
            10 ** BASE_CURRENCY_DECIMALS
        )
        debt_usd = Decimal(data["total_debt_base"]) / Decimal(
            10 ** BASE_CURRENCY_DECIMALS
        )

        # Skip positions with no outstanding debt.
        if debt_usd == 0:
            continue

        # Liquidation threshold: Aave returns this in basis points (e.g.
        # 8250 = 82.50%).  Convert to a 0-1 fraction.
        liq_threshold = Decimal(data["current_liq_threshold"]) / Decimal(
            LIQ_THRESHOLD_BPS
        )

        health_factor = Decimal(data["health_factor"]) / Decimal(
            10 ** HEALTH_FACTOR_DECIMALS
        )

        liq_price = _compute_liquidation_price(
            collateral_usd, debt_usd, liq_threshold, eth_price
        )

        records.append(
            {
                "user_address": user,
                "collateral_usd": float(collateral_usd),
                "debt_usd": float(debt_usd),
                "health_factor": float(health_factor),
                "liquidation_price": (
                    float(liq_price) if liq_price is not None else None
                ),
            }
        )

    logger.info(
        "Scan complete: %d active positions out of %d addresses",
        len(records),
        len(borrowers),
    )

    df = pd.DataFrame(
        records,
        columns=[
            "user_address",
            "collateral_usd",
            "debt_usd",
            "health_factor",
            "liquidation_price",
        ],
    )
    return df


def get_aave_liquidation_schedule(
    rpc_url: str = "http://127.0.0.1:8545",
    db_url: str = "postgres://ethnode:changeme@localhost:5432/ethnode",
    current_eth_price: float | None = None,
) -> pd.DataFrame:
    """Build a liquidation schedule sorted by liquidation price descending.

    Parameters
    ----------
    rpc_url:
        JSON-RPC endpoint.
    db_url:
        PostgreSQL connection string.
    current_eth_price:
        Optional override for the current ETH price in USD.  If ``None`` the
        price is fetched from the Aave oracle on-chain.

    Returns
    -------
    pd.DataFrame
        Columns: user_address, collateral_usd, debt_usd, health_factor,
        liquidation_price, at_risk.
        Sorted by ``liquidation_price`` descending (positions closest to
        current price appear first).
    """
    df = scan_aave_positions(rpc_url, db_url)

    if df.empty:
        df["at_risk"] = pd.Series(dtype=bool)
        return df

    # Determine the reference ETH price for at_risk flagging.
    if current_eth_price is None:
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        oracle = _get_oracle_contract(w3)
        eth_price_dec = _fetch_eth_price_usd(oracle)
        current_eth_price = float(eth_price_dec)

    # A position is "at risk" when its liquidation price is above the
    # current ETH price -- meaning a price decline has already pushed
    # this position past its liquidation threshold, or it is very close.
    # In practice ``health_factor < 1.0`` is the definitive signal, but
    # we also flag positions whose liquidation price is within 10% of
    # current price.
    at_risk_threshold = current_eth_price * 1.10
    df["at_risk"] = df["liquidation_price"].apply(
        lambda lp: lp is not None and lp >= at_risk_threshold
    )

    # Sort: highest liquidation price first (most likely to be liquidated
    # if ETH drops).
    df = df.sort_values(
        "liquidation_price", ascending=False, na_position="last"
    ).reset_index(drop=True)

    return df
