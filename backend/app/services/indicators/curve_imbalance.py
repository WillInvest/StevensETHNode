"""
Curve 3pool Imbalance Indicator

The Curve 3pool (DAI/USDC/USDT) imbalance is a strong signal of
stablecoin stress. During crises, one stablecoin (usually USDT)
gets dumped into the pool, creating significant deviation from
the ideal 33.3% equilibrium.

3pool: 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7
"""

from web3 import Web3
from typing import Optional


CURVE_3POOL = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7"

# Minimal ABI for balance queries
CURVE_3POOL_ABI = [
    {
        "name": "balances",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "i", "type": "uint256"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

# Token decimals: DAI=18, USDC=6, USDT=6
TOKEN_DECIMALS = [18, 6, 6]
TOKEN_NAMES = ["DAI", "USDC", "USDT"]


def get_curve_3pool_imbalance(
    rpc_url: str = "http://127.0.0.1:8545",
    block: Optional[int] = None,
) -> dict:
    """
    Compute Curve 3pool imbalance.

    Returns:
    - max_deviation: 0-1, where 0 = perfect balance, 1 = single asset
    - balances: dict of {token: balance_usd}
    - weights: dict of {token: weight} (should each be ~0.333)
    - stress_signal: bool, True if any weight > 0.40
    """
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(CURVE_3POOL),
        abi=CURVE_3POOL_ABI,
    )

    balances = []
    call_kwargs = {"block_identifier": block} if block else {}

    for i in range(3):
        raw = contract.functions.balances(i).call(**call_kwargs)
        normalized = raw / (10 ** TOKEN_DECIMALS[i])
        balances.append(normalized)

    total = sum(balances)
    if total <= 0:
        return {
            "max_deviation": 0.0,
            "balances": dict(zip(TOKEN_NAMES, balances)),
            "weights": dict(zip(TOKEN_NAMES, [0.333] * 3)),
            "stress_signal": False,
        }

    weights = [b / total for b in balances]
    ideal = 1.0 / 3
    deviations = [abs(w - ideal) for w in weights]
    max_deviation = max(deviations) / ideal  # normalize to 0-1 range (1 = fully imbalanced)

    return {
        "max_deviation": max_deviation,
        "balances": dict(zip(TOKEN_NAMES, [round(b, 2) for b in balances])),
        "weights": dict(zip(TOKEN_NAMES, [round(w, 4) for w in weights])),
        "stress_signal": any(w > 0.40 for w in weights),
    }
