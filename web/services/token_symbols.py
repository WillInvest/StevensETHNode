"""Well-known token symbols and fee tier labels for Uniswap V3 pool resolution."""

# Lowercase token address -> symbol
TOKEN_SYMBOLS: dict[str, str] = {
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
    "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
    "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "WBTC",
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "UNI",
    "0x514910771af9ca656af840dff83e8264ecf986ca": "LINK",
    "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0": "wstETH",
    "0xae78736cd615f374d3085123a210448e74fc6393": "rETH",
    "0xbe9895146f7af43049ca1c1ae358b0541ea49704": "cbETH",
    "0x5a98fcbea516cf06857215779fd812ca3bef1b32": "LDO",
    "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2": "MKR",
    "0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e": "YFI",
    "0xd533a949740bb3306d119cc777fa900ba034cd52": "CRV",
    "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b": "CVX",
    "0xba100000625a3754423978a60c9317c58a424e3d": "BAL",
    "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72": "ENS",
    "0x111111111117dc0aa78b770fa6a738034120c302": "1INCH",
}

# Fee tier (in bps * 100, i.e. raw fee value) -> display label
FEE_LABELS: dict[int, str] = {
    100: "0.01%",
    500: "0.05%",
    3000: "0.30%",
    10000: "1.00%",
}


def get_symbol(address: str) -> str | None:
    """Return known symbol for a token address, or None."""
    return TOKEN_SYMBOLS.get(address.lower())


def get_fee_label(fee: int) -> str:
    """Return human-readable fee tier label."""
    return FEE_LABELS.get(fee, f"{fee / 10000:.2f}%")
