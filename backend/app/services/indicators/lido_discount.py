"""
Lido stETH/ETH Discount Indicator

The stETH/ETH peg is a key systemic risk signal. During stress events
(e.g., FTX collapse, 3AC), stETH depegged significantly. The discount
reflects both liquidity risk and Ethereum staking sentiment.

Curve stETH/ETH pool: 0xDC24316b9AE028F1497c275EB9192a3Ea0f67022
Lido Withdrawal Queue: 0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1
stETH: 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84
"""

from web3 import Web3
from typing import Optional


CURVE_STETH_POOL = "0xDC24316b9AE028F1497c275EB9192a3Ea0f67022"
LIDO_WITHDRAWAL_QUEUE = "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1"

CURVE_STETH_ABI = [
    {
        "name": "get_dy",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"name": "i", "type": "int128"},
            {"name": "j", "type": "int128"},
            {"name": "dx", "type": "uint256"},
        ],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "balances",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "i", "type": "uint256"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

WITHDRAWAL_QUEUE_ABI = [
    {
        "name": "unfinalizedStETH",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "getLastRequestId",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]


def get_steth_eth_discount(
    rpc_url: str = "http://127.0.0.1:8545",
    block: Optional[int] = None,
) -> dict:
    """
    Compute stETH/ETH discount from Curve pool.

    Returns:
    - discount: 1 - (ETH output per stETH). Positive = stETH trades below ETH.
    - premium: Negative discount means stETH > ETH (rare)
    - pool_balance_ratio: stETH/ETH in pool (>1 = stETH surplus)
    - withdrawal_queue_eth: Unfinalized withdrawal queue in stETH
    - stress_signal: True if discount > 0.5%
    """
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    call_kwargs = {"block_identifier": block} if block else {}

    # Get stETH → ETH exchange rate from Curve
    pool = w3.eth.contract(
        address=Web3.to_checksum_address(CURVE_STETH_POOL),
        abi=CURVE_STETH_ABI,
    )

    one_steth = 10**18
    try:
        eth_output = pool.functions.get_dy(1, 0, one_steth).call(**call_kwargs)
        discount = 1 - (eth_output / one_steth)
    except Exception:
        discount = 0.0
        eth_output = one_steth

    # Pool balance ratio
    try:
        eth_balance = pool.functions.balances(0).call(**call_kwargs) / 1e18
        steth_balance = pool.functions.balances(1).call(**call_kwargs) / 1e18
        balance_ratio = steth_balance / eth_balance if eth_balance > 0 else 1.0
    except Exception:
        eth_balance = 0
        steth_balance = 0
        balance_ratio = 1.0

    # Withdrawal queue
    withdrawal_queue_steth = 0.0
    try:
        wq = w3.eth.contract(
            address=Web3.to_checksum_address(LIDO_WITHDRAWAL_QUEUE),
            abi=WITHDRAWAL_QUEUE_ABI,
        )
        unfinalized = wq.functions.unfinalizedStETH().call(**call_kwargs)
        withdrawal_queue_steth = unfinalized / 1e18
    except Exception:
        pass

    return {
        "discount": round(discount, 6),
        "discount_bps": round(discount * 10000, 2),
        "pool_eth_balance": round(eth_balance, 2),
        "pool_steth_balance": round(steth_balance, 2),
        "pool_balance_ratio": round(balance_ratio, 4),
        "withdrawal_queue_steth": round(withdrawal_queue_steth, 2),
        "stress_signal": discount > 0.005,  # > 0.5% discount
    }
