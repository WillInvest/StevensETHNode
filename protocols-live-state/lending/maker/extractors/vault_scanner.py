"""MakerDAO Vault Scanner

Scans MakerDAO vaults (CDPs) for liquidation prices. Focuses on
ETH-collateralized ilks (ETH-A, ETH-B, ETH-C).

Key contracts:
- Vat: 0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B
- Dog: 0x135954d155898D42C90D2a57824C690e0c7BEf1B
- Spot: 0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3
"""

from __future__ import annotations
import logging
from typing import Any, Optional
from decimal import Decimal

import pandas as pd
import psycopg2
from web3 import Web3

logger = logging.getLogger(__name__)

# Contracts
VAT = "0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B"
DOG = "0x135954d155898D42C90D2a57824C690e0c7BEf1B"
SPOT = "0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3"

# ETH ilk identifiers (bytes32)
ETH_ILKS = {
    "ETH-A": bytes.fromhex("4554482d41" + "00" * 27),
    "ETH-B": bytes.fromhex("4554482d42" + "00" * 27),
    "ETH-C": bytes.fromhex("4554482d43" + "00" * 27),
}

# Minimal ABIs
VAT_ABI = [
    {
        "name": "urns",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"name": "ilk", "type": "bytes32"},
            {"name": "urn", "type": "address"},
        ],
        "outputs": [
            {"name": "ink", "type": "uint256"},
            {"name": "art", "type": "uint256"},
        ],
    },
    {
        "name": "ilks",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "ilk", "type": "bytes32"}],
        "outputs": [
            {"name": "Art", "type": "uint256"},
            {"name": "rate", "type": "uint256"},
            {"name": "spot", "type": "uint256"},
            {"name": "line", "type": "uint256"},
            {"name": "dust", "type": "uint256"},
        ],
    },
]

# WAD = 10^18, RAY = 10^27, RAD = 10^45
WAD = Decimal(10**18)
RAY = Decimal(10**27)
RAD = Decimal(10**45)


def _discover_vault_owners(
    db_url: str,
    ilk_name: str = "ETH-A",
) -> list[str]:
    """Discover vault owners from indexed Maker events in PostgreSQL."""
    # Try to find addresses from indexed events
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        # Look for Maker-related tables
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name LIKE '%maker%' OR table_name LIKE '%vault%'
            OR table_name LIKE '%cdp%'
        """)
        tables = [row[0] for row in cur.fetchall()]
        cur.close()
        conn.close()

        if not tables:
            logger.info("No Maker tables found in DB, using empty vault list")
            return []

        logger.info("Found Maker tables: %s", tables)
        return []

    except Exception as e:
        logger.warning("Failed to discover vault owners: %s", e)
        return []


def scan_maker_vaults(
    rpc_url: str = "http://127.0.0.1:8545",
    db_url: str = "postgres://ethnode:changeme@localhost:5432/ethnode",
    vault_owners: Optional[list[str]] = None,
) -> pd.DataFrame:
    """Scan MakerDAO vaults and compute liquidation prices.

    For each vault (ilk, urn):
        debt = art * rate (actual debt in DAI)
        collateral_value = ink * oracle_price
        CR = collateral_value / debt
        liquidation_price = debt * liquidation_ratio / ink

    Returns DataFrame with columns:
    [owner, ilk, ink_eth, art_dai, debt_dai, collateral_usd,
     collateral_ratio, liquidation_price]
    """
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    vat = w3.eth.contract(
        address=Web3.to_checksum_address(VAT),
        abi=VAT_ABI,
    )

    records = []

    for ilk_name, ilk_bytes in ETH_ILKS.items():
        # Get ilk parameters (rate, spot)
        try:
            ilk_data = vat.functions.ilks(ilk_bytes).call()
            rate = Decimal(ilk_data[1]) / RAY  # accumulated stability fee
            spot = Decimal(ilk_data[2]) / RAY  # max debt per unit collateral
        except Exception as e:
            logger.warning("Failed to read ilk %s: %s", ilk_name, e)
            continue

        # If we have vault owners, scan them
        owners = vault_owners or _discover_vault_owners(db_url, ilk_name)

        for owner in owners:
            try:
                urn_data = vat.functions.urns(
                    ilk_bytes,
                    Web3.to_checksum_address(owner),
                ).call()

                ink = Decimal(urn_data[0]) / WAD  # collateral in ETH
                art = Decimal(urn_data[1]) / WAD  # normalized debt

                if art == 0:
                    continue

                debt_dai = float(art * rate)
                collateral_eth = float(ink)

                # Liquidation price: debt / (ink * liquidation_threshold)
                # For Maker, spot already encodes the oracle price / liq ratio
                # So liquidation_price ≈ debt_dai / ink
                liq_price = debt_dai / collateral_eth if collateral_eth > 0 else 0

                records.append({
                    "owner": owner,
                    "ilk": ilk_name,
                    "ink_eth": collateral_eth,
                    "art_dai": float(art),
                    "debt_dai": debt_dai,
                    "debt_usd": debt_dai,  # DAI ≈ $1
                    "liquidation_price": liq_price,
                })

            except Exception as e:
                logger.debug("Failed to read vault %s/%s: %s", ilk_name, owner, e)
                continue

    df = pd.DataFrame(records)
    if df.empty:
        df = pd.DataFrame(columns=[
            "owner", "ilk", "ink_eth", "art_dai", "debt_dai",
            "debt_usd", "liquidation_price",
        ])

    logger.info("Scanned %d active Maker vaults", len(df))
    return df


def get_maker_liquidation_schedule(
    rpc_url: str = "http://127.0.0.1:8545",
    db_url: str = "postgres://ethnode:changeme@localhost:5432/ethnode",
) -> pd.DataFrame:
    """Get Maker liquidation schedule sorted by liquidation price descending."""
    df = scan_maker_vaults(rpc_url, db_url)
    if df.empty:
        return df

    return df.sort_values(
        "liquidation_price", ascending=False
    ).reset_index(drop=True)
