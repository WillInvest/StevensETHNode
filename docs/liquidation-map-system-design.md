# Liquidation Map System Design

## Stevens Blockchain Analytics — Next-Generation Liquidation Intelligence

**Date:** 2026-03-01
**Status:** Design Document — Pre-Implementation

---

## 1. What We Should Build Differently

### 1.1 Our Unfair Advantages

Every existing liquidation map platform (Coinglass, Kingfisher, Hyblock) operates
on the same fundamental limitation: they **estimate** where liquidations *might*
occur based on Open Interest changes and assumed leverage distributions. None of
them have access to actual position data. Our system breaks this paradigm in five
specific ways:

**Advantage 1: Exact On-Chain Position Enumeration**

We have a fully-synced Erigon v3 archive node with `eth_call` access to every
contract on mainnet at any block height. This means we can call:

- `Aave V3 Pool.getUserAccountData(address)` at `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`
  → Returns exact totalCollateralBase, totalDebtBase, healthFactor for every borrower.
  We already have this working in `position_scanner.py` and discover borrowers from
  Shovel-indexed Borrow events.

- `MakerDAO Vat.urns(ilk, address)` at `0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B`
  → Returns exact ink (collateral) and art (normalized debt) for every vault.
  Already partially implemented in `vault_scanner.py`.

- `Compound V3 Comet.borrowBalanceOf(address)` and `Comet.collateralBalanceOf(address, asset)`
  at `0xc3d688B66703497DAA19211EEdff47f25384cdc3` → Returns exact borrow and collateral
  amounts. We have indexed Supply/Withdraw/Absorb events via Shovel but need to build
  the position scanner.

- `Aave V3 Oracle.getAssetPrice(asset)` at `0x54586bE62E3c3580375aE3723C145253060Ca0C2`
  → Real-time oracle prices used by the protocol itself (not third-party price feeds).

These are not estimates. These are the exact same state variables that the protocol's
own liquidation bots read to decide whether to liquidate. No competitor except DefiLlama
does this, and DefiLlama does not combine the data with cascade modeling or CEX data.

**Advantage 2: Market-Implied Price Distribution from Uniswap V3 LP Positioning**

Our `tick_liquidity.py` extracts the full tick-level liquidity distribution from Uniswap
V3 pools by scanning the tick bitmap and reconstructing cumulative liquidity. This
distribution represents billions of dollars of LP capital expressing a collective
view on where ETH price will trade.

No other liquidation map platform uses this data. They show static liquidation levels
without any probability weighting. Our system weights liquidation damage by the
market-implied probability of reaching each price level:

```
F(x) = Integral[ P(price=x) * CascadeDamage(x) ] dx
```

This transforms a static "where are the liquidations" view into a risk-adjusted
"what is the expected damage" metric.

**Advantage 3: Cross-Protocol Cascade Simulation**

Our `cascade.py` engine already implements the feedback loop:

1. Initial price shock triggers liquidations across Aave, Maker, Compound
2. Liquidated collateral is force-sold, a fraction (currently modeled at 30%) hits
   Uniswap V3 AMM pools
3. The AMM sell pressure is computed deterministically by walking down the tick
   liquidity ladder (not estimated — this uses actual on-chain liquidity)
4. New lower price triggers additional liquidations
5. Repeat until convergence

No competitor models this. They show static levels only.

**Advantage 4: Historical State Reconstruction**

With an archive node, we can reconstruct the exact state of all protocols at any
historical block via `eth_call` with a `block` parameter. This enables:

- Backtesting cascade models against actual historical crashes (Mar 2020, May 2021,
  Nov 2022, etc.)
- Computing a historical timeseries of our Fear Index
- Validating our probability distribution model against realized outcomes

**Advantage 5: Hyperliquid Exact Position Data via L1 Integration**

Hyperliquid operates its own L1 chain. While the public REST API only allows
per-address queries (`clearinghouseState`), the Hyperliquid L1 stores all position
data on-chain. We can:

- Monitor `Trade` events on the Hyperliquid L1 to build a list of active traders
- Query each active trader's positions (including exact `liquidationPx`)
- Unlike CEX data where leverage is unknown, Hyperliquid provides the actual
  liquidation price calculated by the exchange itself


### 1.2 What Exactly Is New vs. Existing Platforms

| Capability | Coinglass | Kingfisher | DefiLlama | **Ours** |
|---|---|---|---|---|
| CEX liquidation levels | Estimated | Estimated | No | Phase 4 (estimated) |
| DeFi exact positions | No | No | Yes (11 protocols) | **Yes + cascade** |
| Cascade modeling | No | No | No | **Yes (multi-round)** |
| Cross-protocol correlation | No | No | No | **Yes** |
| Price probability weighting | No | No | No | **Yes (Uniswap V3)** |
| AMM impact simulation | No | No | No | **Yes (tick-level)** |
| Historical backtesting | No | No | No | **Yes (archive node)** |
| Real-time DeFi updates | No | No | ~5 min | **Block-by-block** |


---

## 2. Architecture Recommendation

### 2.1 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA COLLECTION LAYER                       │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Aave V3  │  │ MakerDAO │  │Compound  │  │ Hyperliquid  │   │
│  │ Scanner  │  │ Scanner  │  │V3 Scanner│  │ Scanner      │   │
│  │ (Erigon) │  │ (Erigon) │  │ (Erigon) │  │ (REST API)   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│       │              │              │               │           │
│  ┌────┴──────────────┴──────────────┴───────────────┴────────┐  │
│  │              Position Database (PostgreSQL)                │  │
│  │  Tables: aave_positions, maker_vaults, compound_positions, │  │
│  │          hyperliquid_positions, position_snapshots          │  │
│  └────────────────────────────┬───────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────┴──────────────────────────────┐  │
│  │ Uniswap V3 Tick Liquidity (tick_liquidity.py — existing)  │  │
│  │ Shovel Event Indexing (Borrow/Supply/Repay — existing)     │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────────┐
│                     COMPUTATION LAYER                            │
│                               │                                  │
│  ┌────────────────────────────┴──────────────────────────────┐  │
│  │ Static Liquidation Map Builder (impact.py — existing)      │  │
│  │ Bins positions by liquidation price across all protocols   │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────┴──────────────────────────────┐  │
│  │ Cascade Simulator (cascade.py — existing)                  │  │
│  │ Multi-round feedback: liquidations → AMM sell → new price  │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────┴──────────────────────────────┐  │
│  │ Probability-Weighted Integration (fear_index.py — exists)  │  │
│  │ F = Integral[ P(x) * I_cascade(x) ] dx                    │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────┴──────────────────────────────┐  │
│  │ NEW: Unified Liquidation Map Aggregator                    │  │
│  │ Merges exact on-chain + estimated CEX into single view     │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────────┐
│                        API LAYER (FastAPI)                       │
│                               │                                  │
│  GET /api/liquidation-map/unified                                │
│  GET /api/liquidation-map/protocols/{protocol}                   │
│  GET /api/liquidation-map/cascade?shock_pct=N                    │
│  GET /api/liquidation-map/heatmap                                │
│  GET /api/liquidation-map/positions?protocol=aave&min_debt=N     │
│  GET /api/liquidation-map/historical?block=N                     │
│  WS  /ws/liquidation-map (real-time updates)                     │
└───────────────────────────────┼──────────────────────────────────┘
                                │
┌───────────────────────────────┼──────────────────────────────────┐
│                      FRONTEND (React)                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ LiquidationMap.jsx — Unified Heatmap Page                 │   │
│  │  - Heatmap: price (y) × time (x), color = volume         │   │
│  │  - Protocol breakdown side panel                          │   │
│  │  - Cascade simulation overlay                             │   │
│  │  - Current price marker + Uniswap liquidity underlay      │   │
│  │  - Position explorer table (sortable, filterable)         │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Collection Layer — Detailed

#### 2.2.1 Aave V3 Position Scanner (Enhancement of Existing)

**Current state:** `protocols-live-state/lending/aave-v3/extractors/position_scanner.py`
already discovers borrowers from Shovel-indexed `aave_v3_borrow` events and calls
`getUserAccountData` for each. Works correctly but is single-threaded and sequential.

**Enhancements needed:**

1. **Batch RPC with `eth_call` multicall:** Group up to 100 `getUserAccountData` calls
   into a single JSON-RPC batch request to the Erigon node. This reduces scan time from
   ~30 minutes (1 call per address, thousands of addresses) to ~2 minutes.

```python
# Proposed batch approach using web3.py batch_requests
async def _batch_fetch_accounts(w3, pool, addresses, batch_size=100):
    results = {}
    for i in range(0, len(addresses), batch_size):
        batch = addresses[i:i+batch_size]
        with w3.batch_requests() as b:
            for addr in batch:
                b.add(pool.functions.getUserAccountData(addr))
            raw = b.execute()
        for addr, data in zip(batch, raw):
            results[addr] = data
    return results
```

2. **Incremental scanning:** After initial full scan, only re-scan addresses that
   appear in new Borrow/Supply/Repay/Liquidation events since last scan block.
   Query: `SELECT DISTINCT user_addr FROM aave_v3_borrow WHERE block_num > $last_scan_block`

3. **Per-asset collateral breakdown:** Currently assumes all collateral is ETH.
   Enhancement: call `PoolDataProvider.getUserReserveData(asset, user)` at
   `0x7B4EB56E7CD4b454BA8ff71E4518426c8fa7972A` for each reserve to get exact
   per-asset collateral. This enables accurate liquidation price computation for
   multi-collateral positions.

4. **Write to PostgreSQL:** Persist position snapshots for historical tracking.

```sql
CREATE TABLE IF NOT EXISTS liq_aave_positions (
    snapshot_block    BIGINT NOT NULL,
    snapshot_time     TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_address      TEXT NOT NULL,
    total_collateral_usd NUMERIC,
    total_debt_usd    NUMERIC,
    health_factor     NUMERIC,
    liq_threshold     NUMERIC,
    liquidation_price NUMERIC,
    eth_collateral_pct NUMERIC,  -- fraction of collateral that is ETH
    PRIMARY KEY (snapshot_block, user_address)
);
CREATE INDEX idx_liq_aave_liqprice ON liq_aave_positions (liquidation_price);
```

**Update frequency:** Every 50 blocks (~10 minutes) for full re-scan. Incremental
event-driven updates between scans.


#### 2.2.2 MakerDAO Vault Scanner (Enhancement of Existing)

**Current state:** `vault_scanner.py` has the contract calls working but
`_discover_vault_owners` returns empty because Maker events are not yet indexed in
Shovel.

**Enhancement path:**

1. **Add Maker CDP Manager events to Shovel config:**

The MakerDAO CDP Manager (`0x5ef30b9986345249bc32d8928B7ee64DE9435E39`) emits
`NewCdp(address indexed usr, address indexed own, uint256 indexed cdp)` events.
Add this integration to `shovel/config.json`.

Alternatively, use the Vat `frob` event topic to discover vault interactions:
`0x...` on the Vat contract `0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B`.

2. **Direct Erigon state enumeration via CDP Manager:**

```python
# CDP Manager at 0x5ef30b9986345249bc32d8928B7ee64DE9435E39
CDP_MANAGER = "0x5ef30b9986345249bc32d8928B7ee64DE9435E39"
CDP_MANAGER_ABI = [
    {"name": "cdpi", "type": "function", "stateMutability": "view",
     "inputs": [], "outputs": [{"name": "", "type": "uint256"}]},
    {"name": "urns", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "cdp", "type": "uint256"}],
     "outputs": [{"name": "", "type": "address"}]},
    {"name": "ilks", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "cdp", "type": "uint256"}],
     "outputs": [{"name": "", "type": "bytes32"}]},
    {"name": "owns", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "cdp", "type": "uint256"}],
     "outputs": [{"name": "", "type": "address"}]},
]
```

Call `cdpi()` to get total number of CDPs ever created, then iterate through
CDP IDs, filter for ETH ilks, and call `Vat.urns(ilk, urn)` to get ink/art.

3. **Liquidation price formula (corrected):**

```python
# MakerDAO liquidation price:
# liq_price = (art * rate * mat) / ink
# where:
#   art = normalized debt (from Vat.urns)
#   rate = accumulated stability fee rate (from Vat.ilks)
#   mat = liquidation ratio (from Spot.ilks) — typically 1.5 for ETH-A
#   ink = collateral in ETH (from Vat.urns)

SPOT_ABI = [
    {"name": "ilks", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "ilk", "type": "bytes32"}],
     "outputs": [
         {"name": "pip", "type": "address"},
         {"name": "mat", "type": "uint256"},
     ]},
]
# mat is in RAY (10^27). ETH-A mat = 1.5e27 (150% collateralization)
```

**Update frequency:** Every 100 blocks (~20 minutes). Maker positions change
slowly compared to perps.


#### 2.2.3 Compound V3 Position Scanner (New — To Build)

**Current state:** Shovel indexes Supply, Withdraw, and Absorb events for Compound V3
Comet at `0xc3d688B66703497DAA19211EEdff47f25384cdc3`. No position scanner exists.

**Implementation:**

```python
COMET = "0xc3d688B66703497DAA19211EEdff47f25384cdc3"
COMET_ABI = [
    # Get borrow balance for a user
    {"name": "borrowBalanceOf", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "account", "type": "address"}],
     "outputs": [{"name": "", "type": "uint256"}]},
    # Get collateral balance for a specific asset
    {"name": "collateralBalanceOf", "type": "function", "stateMutability": "view",
     "inputs": [
         {"name": "account", "type": "address"},
         {"name": "asset", "type": "address"},
     ],
     "outputs": [{"name": "", "type": "uint128"}]},
    # Check if a position is liquidatable
    {"name": "isLiquidatable", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "account", "type": "address"}],
     "outputs": [{"name": "", "type": "bool"}]},
    # Get asset info for liquidation factor
    {"name": "getAssetInfoByAddress", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "asset", "type": "address"}],
     "outputs": [
         {"name": "", "type": "tuple", "components": [
             {"name": "offset", "type": "uint8"},
             {"name": "asset", "type": "address"},
             {"name": "priceFeed", "type": "address"},
             {"name": "scale", "type": "uint64"},
             {"name": "borrowCollateralFactor", "type": "uint64"},
             {"name": "liquidateCollateralFactor", "type": "uint64"},
             {"name": "liquidationFactor", "type": "uint64"},
             {"name": "supplyCap", "type": "uint128"},
         ]}
     ]},
    # Get price from Comet's price feed
    {"name": "getPrice", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "priceFeed", "type": "address"}],
     "outputs": [{"name": "", "type": "uint256"}]},
]

# WETH collateral on Compound V3:
WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C68d76B"
```

**Borrower discovery:** From Shovel-indexed events:
```sql
SELECT DISTINCT encode(src, 'hex') AS addr FROM compound_v3_withdraw
UNION
SELECT DISTINCT encode(from_addr, 'hex') AS addr FROM compound_v3_supply
```

Then filter to those with `borrowBalanceOf > 0`.

**Liquidation price calculation:**
```python
# Compound V3 liquidation occurs when:
# sum(collateral_i * price_i * liquidateCollateralFactor_i) < borrowBalance * basePrice
#
# For ETH collateral specifically:
# liq_price_eth = (borrow_balance * base_price) / (eth_collateral * liq_factor)
```

**Update frequency:** Every 50 blocks (~10 minutes).


#### 2.2.4 Hyperliquid Position Scanner (Enhancement of Existing)

**Current state:** `position_scanner.py` can query individual user positions via
the Hyperliquid REST API, and `liquidation_estimator.py` builds an estimated
heatmap from aggregate OI and leverage buckets. The limitation is discovering
active traders — currently requires a `known_users` list.

**Enhancement strategy — Multi-source address discovery:**

1. **Hyperliquid L1 Event Monitoring:**
   The Hyperliquid L1 publishes trade events. Monitor the Hyperliquid API's
   `userFills` and `allMids` endpoints, combined with the `clearinghouseState`
   for recently active addresses. We can also use:

```python
def _discover_hl_traders():
    """Discover active Hyperliquid traders from multiple sources."""
    # Source 1: Leaderboard — top traders by PnL
    leaders = _hl_request({"type": "leaderboard", "timeWindow": "day"})

    # Source 2: Recent large liquidations
    liquidations = _hl_request({"type": "userFills", "user": "0x0..."})
    # Note: No bulk liquidation endpoint exists; we monitor via WebSocket

    # Source 3: Whale alert services and known addresses
    # Hyperliquid publishes clearinghouse addresses publicly

    # Source 4: On-chain deposits to the Hyperliquid bridge
    # Bridge contract on Ethereum mainnet — index deposit events via Shovel
    HYPERLIQUID_BRIDGE = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7"
```

2. **WebSocket streaming for real-time position updates:**

```python
import websockets

async def stream_hl_trades():
    async with websockets.connect("wss://api.hyperliquid.xyz/ws") as ws:
        await ws.send(json.dumps({
            "method": "subscribe",
            "subscription": {"type": "trades", "coin": "ETH"}
        }))
        async for msg in ws:
            trade = json.loads(msg)
            # Extract trader address, update position database
```

3. **Hybrid approach:** Use the existing `liquidation_estimator.py` OI-based model
   as the baseline, then overlay exact positions for discovered traders on top.
   The exact positions replace the estimated ones at matching price levels, improving
   accuracy incrementally as we discover more traders.

**Update frequency:** WebSocket streaming (real-time), full position re-scan every
60 seconds.


### 2.3 Computation Layer — Detailed

#### 2.3.1 Unified Static Liquidation Map

The existing `impact.py` `build_static_liquidation_map()` already accepts DataFrames
from all four protocols and bins them by price level. Enhancement:

1. **Finer price granularity:** Change default `price_step` from $10 to $5 for
   better heatmap resolution near the current price.

2. **Confidence scoring:** Each price level gets a confidence metric:
   - Exact on-chain positions (Aave, Maker, Compound): confidence = 1.0
   - Exact Hyperliquid positions (queried per-address): confidence = 0.95
   - Estimated Hyperliquid positions (from OI model): confidence = 0.4
   - Estimated CEX positions (Phase 4): confidence = 0.2

3. **Side labeling:** Clearly distinguish long vs. short liquidations.
   Currently only applies to Hyperliquid (perps have sides); lending protocol
   liquidations are always "long" (borrower gets liquidated on price decline).

#### 2.3.2 Enhanced Cascade Simulator

The existing `cascade.py` `simulate_cascade()` is already well-designed. Enhancements:

1. **Cross-protocol feedback loops:**

Currently the cascade treats all liquidations uniformly. In reality:
- Aave/Compound liquidations release ETH collateral (sold for stablecoins)
- This selling primarily hits Uniswap V3 (modeled by tick walking — already done)
- Maker liquidations go through Maker's own Dutch auction system (Clipper contracts)
- Hyperliquid liquidations are internal to Hyperliquid's matching engine

Enhancement: separate the AMM impact by liquidation source:
```python
dex_fractions = {
    "aave": 0.50,      # ~50% of Aave liquidation collateral hits DEXes
    "compound": 0.50,   # Similar to Aave
    "maker": 0.20,      # Maker auctions absorb most; less DEX impact
    "hyperliquid": 0.05, # Internal matching engine; minimal DEX spillover
}
```

2. **Multi-asset cascade chains:**

A large ETH liquidation on Aave may cascade into:
- stETH depegging (if stETH is collateral on other positions)
- WBTC price impact (cross-asset correlation during stress)

Model this as a second-order effect with configurable correlation matrix.

3. **Order book depth integration:**

For Hyperliquid, we already fetch the L2 order book. For the DEX side, the
Uniswap V3 tick liquidity IS the order book. The cascade simulator should
consume both to determine realistic price impact.


### 2.4 API Layer — Detailed

#### New Router: `web/routers/liquidation_map.py`

```python
router = APIRouter(prefix="/liquidation-map", tags=["liquidation-map"])

@router.get("/unified")
async def get_unified_liquidation_map(
    price_range_pct: float = Query(0.30, ge=0.05, le=0.50),
    price_step: float = Query(5.0, ge=1.0, le=50.0),
    include_protocols: str = Query("all"),  # "all", "aave,maker", etc.
):
    """
    Returns the unified liquidation map across all protocols.

    Response shape:
    {
        "current_price": 2500.00,
        "block_number": 19500000,
        "timestamp": "2026-03-01T...",
        "total_monitored_debt_usd": 1_234_567_890,
        "total_monitored_collateral_usd": 3_456_789_012,
        "protocols": {
            "aave_v3": {"positions": 4523, "total_debt_usd": 890_000_000, "data_quality": "exact"},
            "maker":   {"positions": 1234, "total_debt_usd": 234_000_000, "data_quality": "exact"},
            "compound":{"positions": 2100, "total_debt_usd": 110_567_890, "data_quality": "exact"},
            "hyperliquid": {"positions": 890, "total_oi_usd": 456_000_000, "data_quality": "mixed"},
        },
        "levels": [
            {
                "price": 2495.00,
                "pct_from_current": -0.2,
                "aave_usd": 1_200_000,
                "maker_usd": 300_000,
                "compound_usd": 150_000,
                "hyperliquid_long_usd": 500_000,
                "hyperliquid_short_usd": 0,
                "total_usd": 2_150_000,
                "num_positions": 12,
                "confidence": 0.92,
                "cumulative_usd": 2_150_000,
            },
            ...
        ],
    }
    """

@router.get("/protocols/{protocol}")
async def get_protocol_positions(
    protocol: str,  # "aave", "maker", "compound", "hyperliquid"
    min_debt_usd: float = Query(0),
    sort_by: str = Query("liquidation_price", regex="^(liquidation_price|debt_usd|health_factor)$"),
    limit: int = Query(100, ge=1, le=1000),
):
    """
    Returns individual positions for a specific protocol.
    Enables a position explorer table in the frontend.
    """

@router.get("/cascade")
async def simulate_cascade_endpoint(
    shock_pct: float = Query(5.0, ge=0.5, le=50.0),
    dex_fraction: float = Query(0.3, ge=0.0, le=1.0),
    max_rounds: int = Query(20, ge=1, le=100),
):
    """
    Run cascade simulation from current state.
    Returns round-by-round breakdown with protocol attribution.
    """

@router.get("/heatmap")
async def get_heatmap_data(
    resolution: int = Query(120, ge=20, le=500),
):
    """
    Returns data optimized for 2D heatmap rendering.
    X-axis: price levels
    Y-axis: protocol breakdown (stacked)
    Color intensity: volume
    """

@router.get("/historical")
async def get_historical_snapshot(
    block: int = Query(..., ge=15000000),
):
    """
    Reconstruct liquidation map at a historical block.
    Only available because of archive node.
    """

@router.get("/whale-watch")
async def get_whale_positions(
    min_collateral_usd: float = Query(1_000_000),
):
    """
    List the largest individual positions across all protocols.
    These are the positions that move markets when liquidated.
    """
```

#### Caching Strategy

```python
# Tiered caching based on data freshness requirements:

CACHE_TIERS = {
    # Position data: refresh every 5 minutes (50 blocks)
    "positions": {"ttl": 300, "refresh_interval": 300},

    # Unified liquidation map: computed from position data, same TTL
    "unified_map": {"ttl": 300, "refresh_interval": 300},

    # Hyperliquid OI/funding: refresh every 30 seconds
    "hyperliquid_market": {"ttl": 30, "refresh_interval": 30},

    # Uniswap tick liquidity: refresh every 90 seconds (existing)
    "tick_liquidity": {"ttl": 300, "refresh_interval": 90},

    # Cascade simulation: computed on-demand, cached 60 seconds
    "cascade": {"ttl": 60, "refresh_interval": None},

    # Historical snapshots: cached indefinitely (immutable)
    "historical": {"ttl": None, "refresh_interval": None},
}
```

Background refresh tasks pre-warm position caches so API responses are always fast:

```python
async def _position_refresh_loop():
    """Runs in background, refreshes all protocol positions periodically."""
    while True:
        try:
            # Parallel scan of all protocols
            aave_task = asyncio.to_thread(scan_aave_positions, RPC_URL, DB_URL)
            maker_task = asyncio.to_thread(scan_maker_vaults, RPC_URL, DB_URL)
            compound_task = asyncio.to_thread(scan_compound_positions, RPC_URL, DB_URL)
            hl_task = asyncio.to_thread(scan_hyperliquid_positions)

            aave, maker, compound, hl = await asyncio.gather(
                aave_task, maker_task, compound_task, hl_task
            )

            # Build unified map and cache it
            unified = build_static_liquidation_map(aave, maker, hl, compound, current_price)
            _cache["positions"] = {"aave": aave, "maker": maker, "compound": compound, "hl": hl}
            _cache["unified_map"] = unified
            _cache["positions_ts"] = time.time()

        except Exception as e:
            logger.error("Position refresh failed: %s", e)

        await asyncio.sleep(300)  # 5 minutes
```


### 2.5 Frontend Visualization

#### New Page: `LiquidationMap.jsx`

The page should have four main sections:

**Section 1: Summary Dashboard (Top Row)**

Four stat cards:
- Total Monitored Debt (across all protocols)
- Total At-Risk Positions (health factor < 1.2 or within 5% of liquidation)
- Current ETH Price (from Aave oracle)
- Max Single-Position Risk (largest position that could be liquidated)

**Section 2: Unified Liquidation Heatmap (Main Chart)**

A stacked bar chart similar to what EthDistribution.jsx already has, but enhanced:

- X-axis: ETH price levels ($5 buckets)
- Y-axis: Liquidation volume in USD
- Bars stacked by protocol: Aave (blue), Maker (orange), Compound (green),
  Hyperliquid Long (emerald), Hyperliquid Short (red, inverted)
- Vertical dashed line at current price
- Color intensity gradient based on confidence score (exact = solid, estimated = semi-transparent)
- Overlay: Uniswap V3 liquidity distribution as a subtle area chart behind the bars
  (showing the "safety net" — where AMM liquidity can absorb forced selling)

**Section 3: Cascade Simulation Panel**

- Shock slider: 1% to 50%
- "Run Cascade" button
- Result visualization:
  - Price waterfall chart showing round-by-round price decline
  - Protocol breakdown pie chart for each round
  - Amplification factor badge
  - Convergence indicator

**Section 4: Position Explorer Table**

- Filterable by protocol, min debt, health factor range
- Columns: Protocol, Address (truncated), Collateral USD, Debt USD,
  Health Factor, Liquidation Price, Distance to Liquidation (%)
- Sortable by any column
- Click to expand shows per-asset breakdown

**Recharts components to use** (already in project dependencies):
- `BarChart` with `stackId` for stacked protocol bars
- `ComposedChart` with `Area` + `Bar` for liquidity underlay
- `LineChart` for cascade price trajectory
- `Tooltip` with custom content (existing pattern in `EthDistribution.jsx`)


---

## 3. Phased Implementation Plan

### Phase 1: Exact On-Chain DeFi Liquidation Map (MVP)
**Estimated effort: 2-3 weeks**

#### 1a. Compound V3 Position Scanner (New)
- Create `protocols-live-state/lending/compound-v3/extractors/position_scanner.py`
- Discover borrowers from Shovel-indexed `compound_v3_supply`/`compound_v3_withdraw` events
- Call `Comet.borrowBalanceOf()` and `Comet.collateralBalanceOf()` for each
- Compute liquidation prices using `liquidateCollateralFactor`
- Output: DataFrame matching the same schema as `scan_aave_positions()`

#### 1b. MakerDAO Scanner Fix
- Add CDP Manager `NewCdp` event to `shovel/config.json` for address discovery
- Alternative: iterate `cdpi()` range via CDP Manager to enumerate all vaults
- Fix `_discover_vault_owners()` to return actual vault addresses
- Add `Spot.ilks()` call to get correct `mat` (liquidation ratio) per ilk

#### 1c. Batch RPC for Aave Scanner
- Add `web3.batch_requests()` to `_fetch_user_account_data()` for 10-50x speedup
- Add per-asset breakdown via `PoolDataProvider.getUserReserveData()`

#### 1d. Unified Map Endpoint
- Create `web/routers/liquidation_map.py` with `/unified` endpoint
- Background refresh task scanning all three protocols every 5 minutes
- PostgreSQL table `liq_positions` for persistent snapshots

#### 1e. Basic Frontend
- New page `LiquidationMap.jsx` with stacked bar chart and stat cards
- Add route to `App.jsx` navigation
- Protocol color coding: Aave=#6366f1, Maker=#f59e0b, Compound=#34d399

**MVP Deliverable:** A page showing exact liquidation levels from Aave V3 + MakerDAO +
Compound V3, refreshed every 5 minutes, with stacked bars per protocol and current
price marker. This alone surpasses DefiLlama by adding cascade modeling and probability
weighting, and surpasses Coinglass/Kingfisher by using exact positions instead of estimates.


### Phase 2: Enhanced Hyperliquid Integration
**Estimated effort: 1-2 weeks**

#### 2a. Trader Discovery
- Index Hyperliquid bridge deposit events via Shovel
  (bridge contract `0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7`)
- Implement leaderboard scraping for top traders
- Build address database with last-seen timestamps

#### 2b. Position Scanning
- Implement rate-limited concurrent `clearinghouseState` queries
- For discovered traders, store exact positions with `liquidationPx`
- Merge exact positions with OI-estimated model:
  - Known positions: use exact data
  - Remaining OI (total OI minus known positions): use estimation model

#### 2c. WebSocket Streaming
- Subscribe to Hyperliquid trade WebSocket for real-time trader discovery
- Update position database incrementally on each trade
- Emit WebSocket updates to frontend via existing FastAPI WebSocket infrastructure

#### 2d. Unified Map Integration
- Integrate Hyperliquid exact positions into the unified liquidation map
- Add confidence scoring: exact positions get high confidence, estimated get low
- Frontend: render confidence as opacity gradient on heatmap bars


### Phase 3: Cascade Modeling Across Protocols
**Estimated effort: 2-3 weeks**

#### 3a. Enhanced Cascade Engine
- Per-protocol DEX fraction parameters (already designed in Section 2.3.2)
- Multi-round simulation that distinguishes between Aave collateral liquidations
  (releases ETH for sale) vs. Maker auctions (less immediate DEX impact)
- Integration with live Uniswap V3 tick liquidity for deterministic price impact

#### 3b. Cross-Protocol Correlation
- Model how ETH price decline on Aave triggers cascading effects on Maker and Compound
- Factor in stETH/ETH correlation: large stETH collateral on Aave can depeg during
  stress, amplifying cascades
- Hyperliquid funding rate feedback: large spot selling increases funding skew,
  potentially triggering more perpetual liquidations

#### 3c. Probability-Weighted Cascade Integration
- Connect the existing `probability.py` P(x) distribution with the cascade simulator
- Compute the integrated risk metric:
  `Expected_Cascade_Damage = Integral[ P(price=x) * CascadeDamage(x) ] dx`
- This becomes the core "fear score" for the liquidation map

#### 3d. Historical Backtesting
- Implement `compute_fear_index_timeseries()` (currently a stub in `fear_index.py`)
- For each historical block: reconstruct positions via archive node `eth_call`,
  compute liquidation map, run cascade simulation
- Validate against actual liquidation events (already indexed in `aave_v3_liquidation`
  and `compound_v3_absorb` tables)

#### 3e. Frontend Cascade Visualization
- Cascade simulation panel with shock slider and "Run" button
- Price waterfall chart showing iterative cascade rounds
- Protocol breakdown per round (which protocol contributed most to each cascade step)
- Amplification factor display


### Phase 4: CEX Estimation Layer (Optional Enhancement)
**Estimated effort: 1-2 weeks**

#### 4a. OI Change Monitoring
- Use CCXT library to fetch Open Interest from Binance, Bybit, OKX for ETH futures
- Track OI changes at each price level to infer new position entries
- Apply leverage distribution model (similar to existing `liquidation_estimator.py`)

#### 4b. Leverage Distribution Calibration
- Use Hyperliquid exact data (where we have ground truth) to calibrate the leverage
  distribution model for CEX estimation
- Compare estimated vs. actual on Hyperliquid to tune bucket weights
- Apply calibrated model to CEX OI data

#### 4c. Unified View
- Merge CEX estimated levels with DeFi exact levels
- Clear visual distinction: exact data shown solid, estimated shown with pattern/opacity
- Total market view: DeFi + CeFi liquidation landscape in one chart

#### 4d. Frontend Labels
- Badge system: "Exact" (green) vs. "Estimated" (yellow) on each data source
- Tooltip showing data quality and source for each liquidation level


---

## 4. Technical Challenges and Solutions

### 4.1 Efficient Position Enumeration

**Challenge:** Aave V3 has thousands of active borrowers. Calling `getUserAccountData`
for each one sequentially is too slow (~30+ minutes).

**Solution: Batch JSON-RPC**

Erigon supports JSON-RPC batching. web3.py 7.x exposes `batch_requests()`:

```python
async def scan_positions_batched(w3, pool, addresses, batch_size=100):
    """Scan positions using batched RPC calls."""
    all_results = []
    for i in range(0, len(addresses), batch_size):
        batch_addrs = addresses[i:i+batch_size]
        with w3.batch_requests() as batch:
            for addr in batch_addrs:
                batch.add(pool.functions.getUserAccountData(addr))
            results = batch.execute()
        for addr, result in zip(batch_addrs, results):
            if result is not None:
                all_results.append((addr, result))
    return all_results
```

This reduces ~4000 sequential RPC calls (30+ minutes) to ~40 batch calls (~2 minutes).

**Alternative: Multicall3 Contract**

For even more efficiency, use the Multicall3 contract at
`0xcA11bde05977b3631167028862bE2a173976CA11` to pack multiple `eth_call` targets
into a single RPC call:

```python
MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11"
MULTICALL3_ABI = [
    {"name": "aggregate3", "type": "function", "stateMutability": "payable",
     "inputs": [{"name": "calls", "type": "tuple[]", "components": [
         {"name": "target", "type": "address"},
         {"name": "allowFailure", "type": "bool"},
         {"name": "callData", "type": "bytes"},
     ]}],
     "outputs": [{"name": "returnData", "type": "tuple[]", "components": [
         {"name": "success", "type": "bool"},
         {"name": "returnData", "type": "bytes"},
     ]}]},
]

# Encode getUserAccountData calls for 200 users into one multicall
calls = [
    {
        "target": AAVE_V3_POOL,
        "allowFailure": True,
        "callData": pool.functions.getUserAccountData(addr).build_transaction()["data"],
    }
    for addr in addresses[:200]
]
# Single eth_call → 200 results
results = multicall.functions.aggregate3(calls).call()
```

This brings the scan from 30 minutes to ~20 seconds.


### 4.2 Hyperliquid Per-Address API Limitation

**Challenge:** Hyperliquid has no bulk position query. `clearinghouseState` only
works for one address at a time, and there is no public endpoint to list all
active traders.

**Solution: Progressive Address Discovery + Rate-Limited Querying**

1. **Multiple discovery sources** (see Section 2.2.4):
   - Bridge deposit events (indexed via Shovel)
   - Leaderboard data (top traders by PnL)
   - WebSocket trade stream (discover new addresses as they trade)
   - Known whale addresses (community-maintained lists)

2. **Rate-limited concurrent queries:**

```python
import asyncio
import aiohttp

RATE_LIMIT = 20  # requests per second (Hyperliquid's limit)

async def scan_hl_positions(addresses: list[str], concurrency: int = 10):
    semaphore = asyncio.Semaphore(concurrency)
    rate_limiter = asyncio.Semaphore(RATE_LIMIT)
    results = []

    async def query_one(addr):
        async with semaphore:
            async with rate_limiter:
                await asyncio.sleep(1.0 / RATE_LIMIT)  # rate limit
                try:
                    data = await _async_hl_request({
                        "type": "clearinghouseState",
                        "user": addr,
                    })
                    return addr, data
                except Exception:
                    return addr, None

    tasks = [query_one(addr) for addr in addresses]
    results = await asyncio.gather(*tasks)
    return [r for r in results if r[1] is not None]
```

3. **Hybrid model:** Track the total OI from `metaAndAssetCtxs` (one call, returns
   all assets). Subtract the sum of known positions' OI. Distribute the remainder
   using the estimation model. This means coverage improves monotonically as we
   discover more addresses, without ever losing the aggregate OI baseline.

4. **Prioritized scanning:** Sort addresses by last-known position value descending.
   Scan the largest positions first (highest market impact). A position scan of the
   top 500 traders (by size) captures ~80% of the liquidation risk on Hyperliquid.


### 4.3 Keeping Data Fresh Without Overwhelming the RPC

**Challenge:** Scanning thousands of positions every block would overload even an
Erigon node.

**Solution: Tiered Refresh Strategy**

```python
REFRESH_TIERS = {
    "critical": {
        # Positions with health_factor < 1.2 (close to liquidation)
        "interval_blocks": 5,       # ~1 minute
        "description": "Near-liquidation positions",
    },
    "active": {
        # Positions with health_factor < 2.0
        "interval_blocks": 50,      # ~10 minutes
        "description": "Active borrowers with moderate risk",
    },
    "stable": {
        # Positions with health_factor >= 2.0
        "interval_blocks": 300,     # ~1 hour
        "description": "Well-collateralized positions",
    },
    "dormant": {
        # Positions with very high health_factor or tiny debt
        "interval_blocks": 1800,    # ~6 hours
        "description": "Minimal risk positions",
    },
}
```

Additionally:
- **Event-driven updates:** When Shovel indexes a new Borrow/Repay/Liquidation event,
  immediately re-scan that specific address (not a full re-scan).
- **Block header monitoring:** Watch for large ETH price moves (>1% since last scan).
  If detected, trigger immediate re-scan of "active" tier.
- **Uniswap tick liquidity:** Already uses `price_pct_range=0.3` to limit bitmap
  scanning to +-30% around current price, reducing RPC calls from ~700 to ~4.


### 4.4 Cross-Protocol Cascade Modeling

**Challenge:** How does an Aave ETH liquidation affect Hyperliquid positions, and
vice versa?

**Solution: Shared Price Impact Model**

The key insight is that all protocols reference the same underlying ETH/USD price.
A large liquidation on any protocol sells ETH, which depresses the price observed
by all other protocols:

```python
def cross_protocol_cascade(
    shock_pct: float,
    current_price: float,
    aave_positions: pd.DataFrame,
    maker_vaults: pd.DataFrame,
    compound_positions: pd.DataFrame,
    hl_positions: pd.DataFrame,
    tick_liquidity: pd.DataFrame,
):
    """
    Cross-protocol cascade simulation.

    Key difference from single-protocol cascade:
    1. Liquidations from ALL protocols contribute to sell pressure
    2. Sell pressure is split: DeFi liquidations → Uniswap, HL → internal
    3. But Uniswap price impact affects the reference price for ALL protocols
    4. So even Hyperliquid positions get liquidated when Uniswap price drops
       (because Hyperliquid uses its own oracle, but the oracle tracks spot)
    """
    price = current_price * (1 - shock_pct / 100)
    prev_price = current_price

    for round_num in range(1, MAX_ROUNDS + 1):
        # 1. Compute liquidations triggered on each protocol
        aave_liqs = liquidations_in_range(aave_positions, price, prev_price)
        maker_liqs = liquidations_in_range(maker_vaults, price, prev_price)
        comp_liqs = liquidations_in_range(compound_positions, price, prev_price)
        hl_liqs = liquidations_in_range(hl_positions, price, prev_price)

        # 2. Compute total sell pressure hitting Uniswap V3
        dex_sell_volume = (
            aave_liqs * 0.50 +    # Aave bot sells 50% on DEX
            maker_liqs * 0.20 +   # Maker auctions absorb 80%
            comp_liqs * 0.50 +    # Compound similar to Aave
            hl_liqs * 0.05        # HL matching engine absorbs 95%
        )

        # 3. Walk down tick liquidity to compute price impact
        new_price, impact = compute_amm_market_impact(
            dex_sell_volume, tick_liquidity, price
        )

        # 4. Oracle lag factor: Hyperliquid oracle tracks spot with ~30s delay
        # During cascade, HL positions may get liquidated slightly later
        hl_oracle_price = price * 0.995 + new_price * 0.005  # blended

        # 5. Check for convergence
        if total_new_liqs < CONVERGENCE_THRESHOLD:
            break

        prev_price = price
        price = new_price
```

**Second-order effects to model:**

1. **stETH depeg risk:** If Aave has significant stETH collateral, large liquidations
   can cause stETH/ETH to depeg (as happened in June 2022). Model this by checking:
   - Total stETH collateral on Aave (from `getUserReserveData` for stETH reserve)
   - Curve stETH/ETH pool balance (already available via `curve_imbalance.py`)
   - If stETH sold > X% of Curve pool, apply depeg multiplier

2. **Gas price spikes:** During cascades, gas prices spike (competing liquidator bots).
   Higher gas costs mean smaller positions become unprofitable to liquidate, delaying
   their resolution. Model this using `gas_stress.py` (existing indicator).


---

## 5. Competitive Moat

### What makes our approach fundamentally better and hard to replicate:

**1. Archive Node Access**

Running a fully-synced Erigon v3 archive node is expensive (~$3,000/year in
hardware + ~2TB SSD + ~2 weeks initial sync). This is a significant barrier that
prevents most competitors from offering exact on-chain position data with historical
reconstruction. DefiLlama does on-chain reads but relies on subgraphs (which can lag
and miss data) rather than direct archive node access.

**2. Integrated Data Pipeline**

Our competitive advantage is not any single component — it is the integration:

```
Uniswap V3 Ticks  ──→  P(x) distribution  ──┐
                                              │
Aave + Maker + Compound ──→ Exact I(x) map ──┼──→ F = ∫ P(x)·I_cascade(x) dx
                                              │
Hyperliquid ──→ Exact + Estimated positions ──┤
                                              │
Cascade Simulator ──→ Dynamic I_cascade(x) ──┘
```

No competitor has this full pipeline. To replicate it, they would need:
- An archive node (expensive, slow to sync)
- Shovel event indexing for address discovery (custom infrastructure)
- Per-protocol scanner implementations (contract-specific code)
- Cascade simulation with AMM tick-walking (novel algorithm)
- Probability weighting from LP distribution (novel application)

**3. Cross-Protocol Intelligence**

The market is fragmented: Coinglass does CEX, DefiLlama does DeFi protocols
individually, Glassnode does Hyperliquid. Nobody combines them. Our unified view
shows the full risk picture: how much total collateral is at risk across the
entire ETH lending and perps ecosystem, and how liquidations cascade across
protocol boundaries through the shared DEX price impact channel.

**4. Cascade Modeling as a Unique Feature**

Every other platform shows static liquidation levels: "if price reaches $X, $Y
gets liquidated." Our system shows the dynamic reality: "if price reaches $X,
$Y gets liquidated, causing $Z of forced selling, pushing price to $W, triggering
$V more liquidations..." This feedback loop is what causes actual market crashes,
and we are the only platform that models it.

**5. Verifiable and Backtestable**

Because we use exact on-chain data and have archive node access:
- Every number we show can be independently verified by anyone with an Ethereum node
- Our cascade model can be backtested against historical liquidation events
- Our probability distribution (from Uniswap V3 LP data) can be validated against
  realized price movements

This transparency is a trust advantage over proprietary platforms like Coinglass
whose models are black boxes.

**6. Academic Rigor**

The `F = Integral[ P(x) * I_cascade(x) ] dx` framework has a solid theoretical
foundation (expected value of cascade damage under the risk-neutral measure). This
makes the project publishable and citable, attracting attention from the DeFi
research community and potential collaborators.


---

## Appendix A: Contract Addresses Reference

| Contract | Address | Usage |
|---|---|---|
| Aave V3 Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` | `getUserAccountData()` |
| Aave V3 Pool Data Provider | `0x7B4EB56E7CD4b454BA8ff71E4518426c8fa7972A` | `getUserReserveData()` |
| Aave V3 Oracle | `0x54586bE62E3c3580375aE3723C145253060Ca0C2` | `getAssetPrice()` |
| MakerDAO Vat | `0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B` | `urns()`, `ilks()` |
| MakerDAO Spot | `0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3` | `ilks()` → mat |
| MakerDAO Dog | `0x135954d155898D42C90D2a57824C690e0c7BEf1B` | Liquidation engine |
| MakerDAO CDP Manager | `0x5ef30b9986345249bc32d8928B7ee64DE9435E39` | `cdpi()`, `urns()`, `owns()` |
| Compound V3 cUSDCv3 | `0xc3d688B66703497DAA19211EEdff47f25384cdc3` | `borrowBalanceOf()`, `isLiquidatable()` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | Batch call aggregation |
| Uniswap V3 ETH/USDC 0.05% | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` | Price + tick liquidity |
| Uniswap V3 ETH/USDC 0.3% | `0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8` | Price + tick liquidity |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C68d76B` | Collateral asset |
| Hyperliquid Bridge | `0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7` | Trader discovery |


## Appendix B: Database Schema Additions

```sql
-- Persistent position snapshots for historical tracking
CREATE TABLE IF NOT EXISTS liq_positions (
    id              BIGSERIAL PRIMARY KEY,
    snapshot_block  BIGINT NOT NULL,
    snapshot_time   TIMESTAMPTZ NOT NULL DEFAULT now(),
    protocol        TEXT NOT NULL,  -- 'aave_v3', 'maker', 'compound_v3', 'hyperliquid'
    user_address    TEXT NOT NULL,
    asset           TEXT,           -- collateral asset symbol
    collateral_usd  NUMERIC,
    debt_usd        NUMERIC,
    health_factor   NUMERIC,
    liquidation_price NUMERIC,
    leverage        NUMERIC,
    side            TEXT,           -- 'long', 'short' (for perps)
    confidence      NUMERIC DEFAULT 1.0,
    raw_data        JSONB           -- full protocol-specific data
);

CREATE INDEX idx_liq_positions_block ON liq_positions (snapshot_block);
CREATE INDEX idx_liq_positions_protocol ON liq_positions (protocol);
CREATE INDEX idx_liq_positions_liqprice ON liq_positions (liquidation_price);
CREATE INDEX idx_liq_positions_user ON liq_positions (user_address);

-- Aggregated liquidation map snapshots (pre-computed for fast API responses)
CREATE TABLE IF NOT EXISTS liq_map_snapshots (
    snapshot_block  BIGINT NOT NULL,
    snapshot_time   TIMESTAMPTZ NOT NULL DEFAULT now(),
    price_level     NUMERIC NOT NULL,
    aave_usd        NUMERIC DEFAULT 0,
    maker_usd       NUMERIC DEFAULT 0,
    compound_usd    NUMERIC DEFAULT 0,
    hyperliquid_long_usd  NUMERIC DEFAULT 0,
    hyperliquid_short_usd NUMERIC DEFAULT 0,
    total_usd       NUMERIC DEFAULT 0,
    num_positions   INT DEFAULT 0,
    confidence      NUMERIC DEFAULT 1.0,
    PRIMARY KEY (snapshot_block, price_level)
);

-- Discovered Hyperliquid trader addresses
CREATE TABLE IF NOT EXISTS hl_known_traders (
    address         TEXT PRIMARY KEY,
    discovery_source TEXT,  -- 'bridge', 'leaderboard', 'websocket', 'manual'
    first_seen      TIMESTAMPTZ DEFAULT now(),
    last_scanned    TIMESTAMPTZ,
    last_position_value_usd NUMERIC DEFAULT 0,
    is_active       BOOLEAN DEFAULT true
);
CREATE INDEX idx_hl_traders_value ON hl_known_traders (last_position_value_usd DESC);
```


## Appendix C: Existing Code Inventory

Files already built that feed into this system:

| File | Status | Function |
|---|---|---|
| `protocols-live-state/dex/uniswap-v3/extractors/tick_liquidity.py` | Complete | Uniswap V3 tick-level liquidity extraction with batch RPC |
| `protocols-live-state/lending/aave-v3/extractors/position_scanner.py` | Complete | Aave V3 position scanning via `getUserAccountData()` |
| `protocols-live-state/lending/maker/extractors/vault_scanner.py` | Partial | Maker vault scanning (address discovery not working) |
| `protocols-live-state/perps/hyperliquid/extractors/position_scanner.py` | Complete | Per-address Hyperliquid position queries |
| `protocols-live-state/perps/hyperliquid/extractors/liquidation_estimator.py` | Complete | OI-based estimated liquidation map + cascade sim |
| `backend/app/services/probability.py` | Complete | P(x) — LP liquidity → price distribution |
| `backend/app/services/impact.py` | Complete | I(x) — Static liquidation map builder |
| `backend/app/services/cascade.py` | Complete | I_cascade(x) — Multi-round cascade simulator |
| `backend/app/services/fear_index.py` | Complete | F = integral of P(x) * I_cascade(x) |
| `web/routers/eth_distribution.py` | Complete | API for ticks, liquidation map, cascade sim |
| `web/routers/fear_index.py` | Complete | API for fear index, stress test, heatmap |
| `web/frontend/src/pages/EthDistribution.jsx` | Complete | Frontend with liquidity chart, liq map, cascade viz |
| `shovel/config.json` | Complete | 16 Shovel integrations including Aave/Compound events |
| `db/schema/02_aave_v3.sql` | Complete | Aave V3 event tables (Supply, Borrow, Repay, Liquidation) |
| `db/schema/03_compound_v3.sql` | Complete | Compound V3 event tables (Supply, Withdraw, Absorb) |
