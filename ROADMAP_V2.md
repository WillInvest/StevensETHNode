# Stevens Blockchain Analytics — Crypto Fear Index (CFI)
# Comprehensive Roadmap & Implementation Specification
# For Claude Code Agent — February 2026

---

## PROJECT OVERVIEW

We are building a **Crypto Fear Index (CFI)** — a "crypto VIX" constructed entirely from on-chain data primitives rather than options markets. The core innovation is combining two observable on-chain functions:

1. **P(x)** — market-implied probability distribution of future ETH prices, extracted from Uniswap V3 concentrated liquidity position distributions
2. **I(x)** — "if price reaches x, how much systemic damage occurs?" computed by aggregating liquidation triggers across DeFi lending protocols and perp DEXes

The fear index is their integral:

```
F = ∫ P(x) · I_cascade(x) dx
```

This computes the **risk-neutral expected liquidation cascade** — the probability-weighted anticipated systemic damage. Unlike the traditional VIX (which measures expected magnitude of movement), our index measures expected systemic cascade damage.

### Two Final Deliverables
1. **Queryable on-chain database** — multi-protocol indexed blockchain data accessible via SQL editor + API
2. **Live Crypto Fear Index (CFI)** — forward-looking fear index updated per-block, with dashboard, methodology docs, and academic paper

### Infrastructure We Have
- Ethereum archive node (Erigon, migrating to Reth recommended) with mempool access
- Large SSD storage, good memory
- Cryo, Shovel, DuckDB already installed
- PostgreSQL database running
- FastAPI backend + React frontend (Phase 1 MVP complete)
- Shovel configs for Uniswap V3 Swap events already working

---

## PROJECT STRUCTURE

```
stevens-blockchain-analytics/
├── CLAUDE.md                          # Agent instructions
├── ROADMAP.md                         # This file
├── docker-compose.yml                 # Service orchestration
│
├── data/
│   ├── parquet/                       # Cryo historical extractions
│   │   ├── uniswap_v3/
│   │   ├── aave_v3/
│   │   ├── curve/
│   │   ├── lido/
│   │   ├── maker/
│   │   ├── bridges/
│   │   ├── erc20_transfers/
│   │   └── blocks/
│   ├── mempool/                       # Mempool captures (append-only parquet, partitioned by date)
│   └── external/                      # CEX API snapshots (funding rates, options, etc.)
│
├── protocols-live-state/              # Research docs per protocol
│   ├── README.md                      # Overview of all protocols and their fear signals
│   ├── dex/
│   │   ├── uniswap-v3/
│   │   │   ├── RESEARCH.md            # What state → fear signal, methodology
│   │   │   ├── contracts.json         # Addresses, ABIs, event signatures
│   │   │   └── extractors/            # Python scripts for data extraction
│   │   └── curve/
│   │       ├── RESEARCH.md
│   │       ├── contracts.json
│   │       └── extractors/
│   ├── lending/
│   │   ├── aave-v3/
│   │   │   ├── RESEARCH.md
│   │   │   ├── contracts.json
│   │   │   └── extractors/
│   │   ├── compound-v3/
│   │   │   ├── RESEARCH.md
│   │   │   ├── contracts.json
│   │   │   └── extractors/
│   │   └── maker/
│   │       ├── RESEARCH.md
│   │       ├── contracts.json
│   │       └── extractors/
│   ├── staking/
│   │   └── lido/
│   │       ├── RESEARCH.md
│   │       ├── contracts.json
│   │       └── extractors/
│   ├── perps/
│   │   └── hyperliquid/
│   │       ├── RESEARCH.md
│   │       ├── contracts.json
│   │       └── extractors/
│   ├── bridges/
│   │   ├── arbitrum/
│   │   ├── optimism/
│   │   └── base/
│   └── network/
│       ├── gas-fees/
│       │   └── RESEARCH.md
│       └── mempool/
│           └── RESEARCH.md
│
├── indexing/
│   ├── cryo/
│   │   ├── scripts/                   # Batch extraction scripts per protocol
│   │   └── configs/
│   ├── shovel/
│   │   ├── config.json                # Real-time event indexing config
│   │   └── migrations/
│   └── mempool/
│       └── capture.py                 # WebSocket mempool listener
│
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app
│   │   ├── routers/
│   │   │   ├── tables.py              # Table browsing endpoints (existing)
│   │   │   ├── query.py               # SQL editor endpoint
│   │   │   ├── fear_index.py          # CFI endpoints (current value, history, components)
│   │   │   └── stress_test.py         # What-if cascade simulation API
│   │   ├── services/
│   │   │   ├── probability.py         # P(x): Uniswap V3 implied distribution
│   │   │   ├── impact.py              # I(x): Static liquidation map
│   │   │   ├── cascade.py             # I_cascade(x): Dynamic cascade simulator
│   │   │   ├── fear_index.py          # F = ∫ P(x) · I(x) dx computation
│   │   │   └── indicators/
│   │   │       ├── uniswap_iv.py      # Lambert formula IV + LP distribution analysis
│   │   │       ├── curve_imbalance.py # 3pool imbalance
│   │   │       ├── aave_health.py     # Utilization + health factor distribution
│   │   │       ├── lido_discount.py   # stETH/ETH discount + queue
│   │   │       ├── maker_cr.py        # Vault CR distribution
│   │   │       ├── funding_rates.py   # Cross-exchange funding
│   │   │       ├── gas_stress.py      # Base fee + priority fee analysis
│   │   │       ├── bridge_flows.py    # L2 bridge net flows
│   │   │       └── exchange_flows.py  # Whale exchange inflows
│   │   ├── models/
│   │   └── db.py
│   ├── requirements.txt
│   └── tests/
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx               # Dashboard (existing)
│   │   │   ├── TableBrowser.jsx       # Table browser (existing)
│   │   │   ├── SQLEditor.jsx          # CodeMirror SQL editor
│   │   │   ├── FearIndex.jsx          # CFI dashboard (gauge + history + breakdown)
│   │   │   └── StressTest.jsx         # Interactive cascade simulator
│   │   └── components/
│   │       ├── FearGauge.jsx          # 0-100 gauge visualization
│   │       ├── CascadeChart.jsx       # Liquidation cascade waterfall
│   │       ├── LiquidityHeatmap.jsx   # Uniswap tick-level liquidity
│   │       ├── LiquidationMap.jsx     # Price vs. liquidation volume
│   │       └── ComponentBreakdown.jsx # Fear index component weights
│   └── package.json
│
├── analysis/
│   ├── notebooks/
│   │   ├── 01_uniswap_iv_extraction.ipynb
│   │   ├── 02_liquidation_map_construction.ipynb
│   │   ├── 03_cascade_simulation.ipynb
│   │   ├── 04_fear_index_backtest.ipynb
│   │   ├── 05_validation_granger_causality.ipynb
│   │   └── 06_comparison_dvol_fgi.ipynb
│   └── validation/
│       ├── feature_selection.py       # LASSO / Elastic Net
│       ├── granger_causality.py       # Time-varying Granger causality
│       ├── walk_forward.py            # Out-of-sample testing
│       └── benchmark.py              # Compare vs DVOL, FGI, HAR-RV
│
└── docs/
    ├── methodology.md                 # Academic methodology documentation
    ├── api.md                         # API documentation
    └── paper/                         # Academic paper drafts
```

---

## PHASE-BY-PHASE IMPLEMENTATION PLAN

### Phase 0: Project Setup [DONE]
- [x] Git repo, CLAUDE.md, project structure
- [x] Tool installation (Cryo, Shovel, DuckDB)
- [x] Python + Node.js dependency setup

### Phase 1: MVP — Indexing + Web Viewer [DONE]
- [x] Shovel config for Uniswap V3 Swap events
- [x] Cryo backfill scripts for historical data
- [x] DuckDB → PostgreSQL loader
- [x] FastAPI backend (table list, paginated browse)
- [x] React frontend (Home dashboard, table browser)
- [x] End-to-end test: Cryo → DB → API → Browser

### Phase 2: Multi-Protocol Indexing [DONE]
- [x] Aave V3 (Supply, Borrow, Repay, Liquidation events)
- [x] Compound V3 (Supply, Withdraw, Absorb events)
- [x] Curve (TokenExchange, AddLiquidity events)
- [x] Lido (Submitted, TransferShares events)
- [x] ERC-20 Transfer events (major tokens: WETH, USDC, USDT, DAI)
- [x] Major bridge events (Arbitrum, Optimism, Base)

---

### Phase 3: P(x) — Uniswap V3 Implied Price Distribution ← START HERE

**Goal**: Extract the market-implied probability distribution of future ETH prices from Uniswap V3 LP positioning.

**Theory**: Uniswap V3 LP positions are mathematically equivalent to perpetual options (Lambert, 2021). A position with range [p_a, p_b] is a covered call (if above current price) or cash-secured put (if below). The aggregate distribution of LP positions across ticks encodes how much economic capital is betting on each price region.

#### Task 3.1: Tick-Level Liquidity Snapshot Extractor
**File**: `protocols-live-state/dex/uniswap-v3/extractors/tick_liquidity.py`

Read the current liquidity at every initialized tick for key pools:
- ETH/USDC 0.05% pool: `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640`
- ETH/USDC 0.3% pool: `0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8`
- ETH/USDT 0.3% pool: `0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36`
- WBTC/ETH 0.3% pool: `0xCBCdF9626bC03E24f779434178A73a0B4bad62eD`

**Implementation approach**:
```python
# For each pool:
# 1. Call pool.slot0() to get current tick, sqrtPriceX96
# 2. Call pool.liquidity() for current tick liquidity
# 3. Iterate through initialized ticks using pool.tickBitmap(wordPos)
#    and pool.ticks(tick) to get liquidityNet at each tick
# 4. Reconstruct cumulative liquidity at every tick
#    L(tick_n) = L(tick_{n-1}) + liquidityNet(tick_n)
# 5. Convert tick to price: price = 1.0001^tick
# 6. Store as DataFrame: [tick, price, liquidity, liquidity_usd]
```

**Key contract interface**:
```solidity
// IUniswapV3Pool
function slot0() external view returns (
    uint160 sqrtPriceX96, int24 tick, ...
);
function liquidity() external view returns (uint128);
function ticks(int24 tick) external view returns (
    uint128 liquidityGross, int128 liquidityNet, ...
);
function tickBitmap(int16 wordPosition) external view returns (uint256);
function tickSpacing() external view returns (int24);
```

**Output**: Parquet file with columns `[block_number, timestamp, pool_address, tick, price_eth_usd, liquidity, cumulative_liquidity]`

#### Task 3.2: LP Position Distribution Analysis
**File**: `backend/app/services/probability.py`

Convert tick liquidity into an implied price probability distribution:
```python
def compute_implied_distribution(tick_liquidity_df):
    """
    Convert LP liquidity distribution to implied price PDF.
    
    Intuition: More liquidity at a tick = more capital betting price visits that region.
    Normalize to get a probability distribution.
    
    Steps:
    1. For each tick range [tick_i, tick_{i+1}], compute liquidity_i
    2. Convert to USD value: value_i = liquidity_i * (price_{i+1} - price_i)
    3. Normalize: P(price in [p_i, p_{i+1}]) = value_i / sum(all value_j)
    4. Return as discrete PDF: [(price_midpoint, probability_density), ...]
    """
    pass

def compute_distribution_moments(pdf):
    """
    Extract key statistics from the implied distribution:
    - mean: expected price
    - std: implied volatility (wider = more vol expected)
    - skewness: directional bias (negative = bearish LP positioning)
    - kurtosis: tail risk expectations
    - percentiles: 5th, 25th, 75th, 95th price expectations
    """
    pass
```

#### Task 3.3: Lambert Formula IV Computation
**File**: `backend/app/services/indicators/uniswap_iv.py`

Implement the on-chain implied volatility formula:
```python
def lambert_iv(fee_rate, daily_volume_usd, tick_liquidity_usd):
    """
    IV = 2 * fee_rate * sqrt(daily_volume / tick_liquidity) * sqrt(365)
    
    Parameters:
    - fee_rate: pool fee tier (0.0005, 0.003, 0.01)
    - daily_volume_usd: 24h swap volume in USD (from Swap events)
    - tick_liquidity_usd: liquidity at current tick in USD
    
    Returns: annualized implied volatility (e.g., 0.85 = 85%)
    
    Reference: Lambert (2021) "On-chain Volatility and Uniswap v3"
    """
    import math
    return 2 * fee_rate * math.sqrt(daily_volume_usd / tick_liquidity_usd) * math.sqrt(365)

def fee_tier_migration_signal(pools_by_tier):
    """
    Track TVL ratios across fee tiers for the same pair.
    Rising share of 0.3%/1.0% tier vs 0.05% tier = LPs expect higher vol.
    
    Input: dict of {fee_tier: tvl_usd} for same pair (e.g., ETH/USDC)
    Output: migration_score (0-1, higher = more vol expected)
    """
    pass
```

#### Task 3.4: Historical Backfill via Cryo
**File**: `indexing/cryo/scripts/uniswap_v3_positions.sh`

```bash
# Extract all Mint events (LP position creation) from Uniswap V3 NonfungiblePositionManager
# Contract: 0xC36442b4a4522E871399CD717aBDD847Ab11FE88
# Event: IncreaseLiquidity(uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
# Also need: Mint(address sender, address owner, int24 tickLower, int24 tickUpper, uint128 amount, uint256 amount0, uint256 amount1)
# on each pool contract directly

cryo logs \
    --contract 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640 \
    --event-signature "Mint(address,address,int24,int24,uint128,uint256,uint256)" \
    --blocks 12370000:latest \
    --output-dir data/parquet/uniswap_v3/mint_events/ \
    --rpc $ETH_RPC_URL

# Extract Burn events (LP position removal)
cryo logs \
    --contract 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640 \
    --event-signature "Burn(address,int24,int24,uint128,uint256,uint256)" \
    --blocks 12370000:latest \
    --output-dir data/parquet/uniswap_v3/burn_events/ \
    --rpc $ETH_RPC_URL

# Extract Swap events for volume computation
cryo logs \
    --contract 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640 \
    --event-signature "Swap(address,address,int256,int256,uint160,uint128,int24)" \
    --blocks 12370000:latest \
    --output-dir data/parquet/uniswap_v3/swap_events/ \
    --rpc $ETH_RPC_URL
```

---

### Phase 4: I(x) — Static Liquidation Map

**Goal**: For any hypothetical ETH price x, compute the total liquidation volume that would trigger across all DeFi protocols.

#### Task 4.1: Aave V3 Position Scanner
**File**: `protocols-live-state/lending/aave-v3/extractors/position_scanner.py`

```python
"""
Scan all active Aave V3 positions and compute their liquidation prices.

Aave V3 Pool (Ethereum): 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
PoolDataProvider: 0x7B4EB56E7CD4b454BA8ff71E4518426c8fa7972A

For each user with active positions:
1. Call getUserAccountData(user) → returns:
   - totalCollateralBase (USD, 8 decimals)
   - totalDebtBase (USD, 8 decimals)
   - availableBorrowsBase
   - currentLiquidationThreshold
   - ltv
   - healthFactor (18 decimals, liquidation at < 1e18)

2. For ETH-collateralized positions specifically:
   health_factor(price_x) = (eth_collateral * price_x * liq_threshold) / debt_usd
   liquidation_price = debt_usd / (eth_collateral * liq_threshold)

3. Build the liquidation schedule:
   Output: [(liquidation_price, debt_amount, collateral_amount, user_address), ...]
   sorted by liquidation_price descending (highest price = first to liquidate)

Discovery of active users:
- Index all Borrow events: event Borrow(address indexed reserve, address user, ...)
- Or use Aave subgraph: https://thegraph.com/hosted-service/subgraph/aave/protocol-v3
- Filter for users where healthFactor < 2.0 (worth monitoring)
"""
```

**Key events to index**:
```
# Aave V3 Pool: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint8 interestRateMode, uint256 borrowRate, uint16 indexed referralCode)
Repay(address indexed reserve, address indexed user, address indexed repayer, uint256 amount, bool useATokens)
LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)
Supply(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referralCode)
```

#### Task 4.2: MakerDAO Vault Scanner
**File**: `protocols-live-state/lending/maker/extractors/vault_scanner.py`

```python
"""
Scan MakerDAO vaults for liquidation prices.

Key contracts:
- Vat: 0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B
  - urns(bytes32 ilk, address urn) → (uint256 ink, uint256 art)
    ink = collateral amount (in wad, 18 decimals)
    art = normalized debt (in wad)
  - ilks(bytes32 ilk) → (uint256 Art, uint256 rate, uint256 spot, uint256 line, uint256 dust)
    rate = accumulated stability fee rate
    spot = liquidation price (derived from oracle and liquidation ratio)

- Dog: 0x135954d155898D42C90D2a57824C690e0c7BEf1B
  - Event: Bark(bytes32 indexed ilk, address indexed urn, uint256 ink, uint256 art, uint256 due, address clip, uint256 id)

For each vault (ilk, urn):
  debt = art * rate (actual debt in DAI)
  collateral_value = ink * oracle_price
  CR = collateral_value / debt
  liquidation_price = debt * liquidation_ratio / ink

Focus on ETH-A (ilk = 0x4554482d41...), ETH-B, ETH-C ilks.
"""
```

#### Task 4.3: Hyperliquid Position Scanner
**File**: `protocols-live-state/perps/hyperliquid/extractors/position_scanner.py`

```python
"""
Scan Hyperliquid open positions for liquidation prices.

API endpoint: POST https://api.hyperliquid.xyz/info
Content-Type: application/json

Key requests:
1. All open positions (clearinghouse state):
   {"type": "clearinghouseState", "user": "0x..."}
   Returns: positions with entryPx, positionValue, leverage, liquidationPx

2. Aggregate funding data:
   {"type": "fundingHistory", "coin": "ETH", "startTime": <unix_ms>}

3. Market metadata + open interest:
   {"type": "metaAndAssetCtxs"}
   Returns: for each asset, funding, openInterest, markPx

4. For liquidation heatmap construction:
   - Get all recent large position openings via user state queries
   - Or run Hyperliquid non-validating node with --write-trades --write-fills
     Data appears in ~/hl/data/ in hourly partitions

For each known large position:
   liquidation_price = entryPx * (1 - 1/leverage) for longs
   liquidation_price = entryPx * (1 + 1/leverage) for shorts

Build cumulative: at price x, sum of all positions that liquidate.

Community tools: github.com/thunderhead-labs/hyperliquid-stats
Endpoints include: /hyperliquid/daily_notional_liquidated_by_leverage_type
"""
```

#### Task 4.4: Static Impact Function Assembly
**File**: `backend/app/services/impact.py`

```python
def build_static_liquidation_map(
    aave_positions,
    maker_vaults,
    hyperliquid_positions,
    compound_positions=None,
    current_eth_price=None
):
    """
    Assemble the static what-if function I_static(x).
    
    For each price level x (discretized, e.g., every $10 from $500 to current_price):
        I_static(x) = sum of all positions that liquidate if ETH reaches price x
    
    Output: DataFrame with columns:
        [price_level, aave_liquidation_usd, maker_liquidation_usd, 
         hyperliquid_liquidation_usd, total_liquidation_usd,
         num_positions_liquidated, largest_single_liquidation]
    
    This is a step function that jumps at each liquidation trigger price.
    
    Visualization: plot as cumulative liquidation volume vs. price decline %
    Example output interpretation:
        "If ETH drops 5% to $1,710: $47M in liquidations across 234 positions"
        "If ETH drops 10% to $1,620: $312M in liquidations across 1,847 positions"
        "If ETH drops 20% to $1,440: $1.2B in liquidations across 8,392 positions"
    """
    pass
```

---

### Phase 5: I_cascade(x) — Dynamic Cascade Simulator

**Goal**: Model the feedback loop where liquidations push price down further, triggering more liquidations.

#### Task 5.1: AMM Market Impact Model
**File**: `backend/app/services/cascade.py`

```python
def compute_amm_market_impact(sell_volume_usd, tick_liquidity):
    """
    Given a forced sell of $sell_volume_usd worth of ETH,
    compute how far the price drops by walking down the Uniswap V3 tick ladder.
    
    This is DETERMINISTIC from current liquidity state:
    - Start at current tick
    - At each tick, the pool can absorb: absorbable = liquidity_at_tick * tick_spacing_in_price
    - If sell_volume > absorbable, consume this tick's liquidity and move to next tick down
    - Continue until sell_volume is exhausted
    - The final tick gives the new price
    
    Parameters:
    - sell_volume_usd: total USD value of forced selling
    - tick_liquidity: DataFrame from Task 3.1 with [tick, price, liquidity]
    
    Returns:
    - new_price: price after the sell impact
    - price_impact_pct: percentage price decline
    - ticks_consumed: number of ticks traversed
    """
    pass

def simulate_cascade(
    initial_shock_pct,
    current_price,
    tick_liquidity,
    liquidation_map,
    max_iterations=50,
    convergence_threshold_usd=100_000
):
    """
    Full cascade simulation with feedback loop.
    
    Algorithm:
    1. Apply initial shock: price_1 = current_price * (1 - initial_shock_pct)
    2. Compute liquidations triggered: L_1 = I_static(price_1) - I_static(current_price)
    3. Estimate sell-side impact of L_1 liquidations on AMM:
       delta_price = compute_amm_market_impact(L_1, tick_liquidity)
    4. New price: price_2 = price_1 - delta_price
    5. Additional liquidations: L_2 = I_static(price_2) - I_static(price_1)
    6. Repeat until L_n < convergence_threshold (cascade exhausted)
    
    Key modeling decisions:
    - Assume liquidation bots sell collateral immediately on DEXes
    - Fraction of liquidation volume hitting Uniswap vs CEX (parameterizable, default 30%)
    - Include Hyperliquid perp liquidations as additional sell pressure on spot
    
    Returns:
    - CascadeResult with:
        - final_price: price after cascade convergence
        - total_cascade_depth_pct: total % decline including feedback
        - cascade_rounds: number of iterations to convergence  
        - total_liquidation_volume_usd: sum of all liquidations across all rounds
        - liquidation_timeline: [(round, price, volume, protocol_breakdown), ...]
        - amplification_factor: total_cascade_depth / initial_shock (>1 means feedback amplified it)
    """
    pass

def run_stress_test_grid(current_price, tick_liquidity, liquidation_map):
    """
    Run cascade simulation across a grid of initial shocks.
    
    Shocks: [1%, 2%, 3%, 5%, 7%, 10%, 15%, 20%, 30%, 50%]
    
    For each shock, record:
    - cascade_result (from simulate_cascade)
    - marginal_cascade_per_pct (derivative: how much worse does each extra 1% get)
    
    Output: stress_test_grid DataFrame
    This becomes the CASCADE RESPONSE SURFACE used in the fear index integral.
    """
    pass
```

---

### Phase 6: F = ∫ P(x) · I(x) dx — The Fear Index

**Goal**: Integrate the probability distribution against the cascade impact function to produce a single fear number.

#### Task 6.1: Fear Index Computation Engine
**File**: `backend/app/services/fear_index.py`

```python
def compute_fear_index(
    implied_distribution,     # from Phase 3 (P(x))
    cascade_response_surface, # from Phase 5 (I_cascade(x))
    current_price,
    normalize=True
):
    """
    Compute the Crypto Fear Index as the probability-weighted expected cascade damage.
    
    F_raw = Σ_k P(price reaches x_k) × TotalCascadeVolume(x_k) × Δx
    
    Only integrate over DOWNSIDE (x < current_price), since fear = downside risk.
    
    Normalization: Scale to 0-100 range using historical percentiles.
    - 0-20: Extreme Greed (minimal cascade risk)
    - 20-40: Greed
    - 40-60: Neutral
    - 60-80: Fear
    - 80-100: Extreme Fear (massive cascade risk)
    
    Also compute component breakdown:
    - contribution_from_aave: integral using only aave liquidations in I(x)
    - contribution_from_maker: same for maker
    - contribution_from_hyperliquid: same for perps
    - contribution_from_distribution_width: how much of F comes from wide P(x) vs large I(x)
    
    Returns:
    - FearIndexResult:
        - value: 0-100 normalized score
        - raw_value: unnormalized integral (USD)
        - components: dict of per-protocol contributions
        - implied_vol: Lambert formula IV
        - max_cascade_depth: worst case from stress test grid
        - distribution_skew: directional bias from LP positions
        - timestamp, block_number
    """
    pass

def compute_fear_index_timeseries(
    start_block, end_block, interval_blocks=100
):
    """
    Compute historical fear index by reconstructing on-chain state at each block.
    
    This is the KEY ADVANTAGE of having an archive node:
    - At each historical block, reconstruct:
      a. Uniswap tick liquidity (from events up to that block)
      b. Aave positions (from events up to that block)
      c. Maker vaults (from events up to that block)
    - Compute P(x) and I(x) at that block
    - Compute F at that block
    
    This produces a historical time series for backtesting and validation.
    """
    pass
```

#### Task 6.2: Supplementary Coincident Indicators
**File**: `backend/app/services/indicators/` (one file per indicator)

These are NOT components of the core integral but are tracked alongside for confirmation and dashboard display:

```python
# curve_imbalance.py
def get_curve_3pool_imbalance():
    """
    3pool: 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7
    Call balances(0), balances(1), balances(2) for DAI, USDC, USDT
    Compute deviation from 33.3% equilibrium per asset
    Return: max_deviation (0-1, where 0 = perfect balance, 1 = single asset)
    """
    pass

# lido_discount.py
def get_steth_eth_discount():
    """
    Curve stETH/ETH pool: 0xDC24316b9AE028F1497c275EB9192a3Ea0f67022
    Call get_dy(1, 0, 1e18) to get ETH output for 1 stETH
    Discount = 1 - (output / 1e18)
    Also check Lido WithdrawalQueue contract for queue depth
    """
    pass

# gas_stress.py
def get_gas_stress_indicator():
    """
    Read latest block's baseFeePerGas
    Compute z-score vs 30-day rolling mean
    Also track priority fee 90th percentile
    """
    pass

# funding_rates.py
def get_funding_rate_signal():
    """
    Fetch from CoinGlass API: https://open-api.coinglass.com/public/v2/funding
    Or Hyperliquid: POST https://api.hyperliquid.xyz/info {"type":"fundingHistory","coin":"ETH"}
    Compute cross-exchange average and extremeness
    """
    pass

# bridge_flows.py
def get_bridge_net_flows():
    """
    Track deposit/withdrawal events on canonical bridges:
    - Arbitrum Gateway: 0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a
    - Optimism Portal: 0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1
    Compute 24h net flow (positive = capital leaving L2 to L1 = risk-off)
    """
    pass
```

---

### Phase 7: Validation & Backtesting

**Goal**: Rigorously validate that the fear index actually predicts future realized volatility and market stress.

#### Task 7.1: Target Variable Construction
**File**: `analysis/validation/targets.py`

```python
def compute_realized_volatility(prices, window='1d', method='garman_klass'):
    """
    Compute realized volatility for ETH and BTC.
    
    Methods:
    - close_to_close: standard deviation of log returns
    - parkinson: (1/4ln2) * (H-L)^2 range estimator
    - garman_klass: uses OHLC, most efficient
    
    Compute at multiple horizons: 1d, 7d, 30d forward
    These are the TARGET VARIABLES for validation.
    """
    pass
```

#### Task 7.2: Feature Selection
**File**: `analysis/validation/feature_selection.py`

```python
def run_lasso_selection(features_df, target_realized_vol):
    """
    Use LASSO / Elastic Net to identify which fear index components
    have genuine predictive power for future realized vol.
    
    Features: all individual indicators from Phase 6
    Target: forward-looking realized vol (1d, 7d, 30d)
    
    Pipeline:
    1. Standardize features
    2. Walk-forward cross-validation (no future leakage!)
    3. LASSO path to find optimal lambda
    4. Report selected features and their coefficients
    5. SHAP values for interpretability
    """
    pass
```

#### Task 7.3: Granger Causality & Lead-Lag Analysis
**File**: `analysis/validation/granger_causality.py`

```python
def run_granger_tests(fear_index_ts, realized_vol_ts, max_lag=30):
    """
    Test: does the fear index Granger-cause realized volatility?
    
    Steps:
    1. ADF test for stationarity (difference if needed)
    2. VAR model with optimal lag selection (BIC/AIC)
    3. Granger causality test within VAR framework
    4. Impulse response functions
    5. Time-varying Granger causality (Shi et al. 2018/2020 framework)
       - Important because predictability may only exist in certain regimes
    """
    pass
```

#### Task 7.4: Historical Event Validation
**File**: `analysis/validation/event_validation.py`

```python
"""
Reconstruct fear index at key historical moments and check if it spiked BEFORE the crash:

1. Black Thursday (March 12-13, 2020)
   - Block range: ~9650000 to ~9680000
   - ETH dropped from $194 to $86 (55% in 24h)
   - 3,994 MakerDAO liquidation auctions
   - Check: did our index spike at block ~9640000 (before crash)?

2. May 19, 2021 China mining ban crash
   - Block range: ~12440000 to ~12480000
   - ETH dropped from $3,400 to $1,800 (47%)
   - Check: did Uniswap LP distribution widen before the drop?

3. Terra/UST collapse (May 7-12, 2022)
   - Block range: ~14730000 to ~14770000
   - ETH dropped from $2,800 to $1,800 (36%)
   - Massive Aave/Maker liquidations
   - Curve 3pool USDT weight exceeded 50%
   - Check: did cascade simulator predict the depth?

4. FTX collapse (November 7-9, 2022)
   - Block range: ~15920000 to ~15960000
   - ETH dropped from $1,570 to $1,090 (30%)
   - stETH discount spiked
   - Check: did bridge outflows and funding rates signal before price?

5. SVB/USDC depeg (March 10-11, 2023)
   - Block range: ~16790000 to ~16810000
   - USDC depegged to $0.88
   - Curve 3pool massively imbalanced
   - Check: did Curve imbalance lead the broader fear spike?

For each event, generate a visualization:
- Fear index value in the 48 hours before, during, and after
- Component breakdown showing which signals fired first
- Comparison with Deribit DVOL if available for that period
"""
```

#### Task 7.5: Benchmark Comparison
**File**: `analysis/validation/benchmark.py`

```python
"""
Compare our CFI against existing indices:

1. Deribit DVOL (ETH)
   - API: docs.deribit.com → get_volatility_index_data
   - Available from March 2021 onward
   - This is the GOLD STANDARD benchmark

2. Alternative.me Fear & Greed Index
   - API: https://api.alternative.me/fng/
   - Daily frequency, available from Feb 2018
   - Sentiment-based, not vol-based — different construct

3. HAR-RV model (Heterogeneous Autoregressive Realized Volatility)
   - Pure statistical model: RV_t = c + β_d*RV_{t-1} + β_w*RV_{t-5:t-1} + β_m*RV_{t-22:t-1}
   - This is the "dumb" benchmark — can our on-chain index beat pure time-series?

4. Volmex EVIV
   - Available via volmex.finance API
   - Another options-based IV index

Metrics:
- Correlation with forward realized vol (1d, 7d, 30d)
- Directional accuracy (does high fear predict high vol?)
- Lead time (does our index spike BEFORE DVOL?)
- Out-of-sample R² in predictive regression
- Model Confidence Set (Hansen et al.) for formal comparison
"""
```

---

### Phase 8: Research Platform & SQL Editor

**Goal**: Make the database queryable for ad-hoc research.

#### Task 8.1: SQL Editor with CodeMirror
**File**: `frontend/src/pages/SQLEditor.jsx`

```
- CodeMirror editor with SQL syntax highlighting + autocomplete
- Schema browser sidebar (list tables, columns, types)
- Execute query via API → display results in paginated table
- Chart builder: select columns for X/Y axis, choose chart type
- Export: CSV, JSON, Parquet download buttons
- Saved queries library (localStorage or DB-backed)
```

#### Task 8.2: Query API Endpoint
**File**: `backend/app/routers/query.py`

```python
@router.post("/query")
async def execute_query(sql: str, limit: int = 1000):
    """
    Execute read-only SQL against DuckDB (for parquet analysis)
    or PostgreSQL (for live indexed data).
    
    SAFETY: Only allow SELECT statements. No DDL/DML.
    Parse with sqlparse, reject if not SELECT.
    Apply row limit. Timeout after 30 seconds.
    
    Return: {columns: [...], rows: [...], row_count: int, execution_time_ms: int}
    """
    pass
```

---

### Phase 9: Fear Index Dashboard & Visualization

**Goal**: Build a live dashboard showing the fear index and all its components.

#### Task 9.1: Fear Index Gauge
**File**: `frontend/src/pages/FearIndex.jsx`

```
Main dashboard with:
- Large circular gauge showing current CFI value (0-100) with color gradient
  (green=greed, yellow=neutral, red=fear)
- Historical time series chart (selectable: 24h, 7d, 30d, 90d, 1y)
- Component breakdown: horizontal stacked bar showing contribution from each component
- Latest update timestamp and block number

Below the gauge:
- Liquidation heatmap: X-axis = ETH price, Y-axis = liquidation volume
  Color intensity shows liquidation density. Current price marked with vertical line.
- Uniswap LP distribution: overlay of current LP positioning vs 30-day average
  Highlight widening/narrowing of distribution
- Cascade simulation: interactive slider for "what if ETH drops X%"
  Shows: initial liquidations, cascade rounds, final cascade depth, amplification factor
```

#### Task 9.2: Stress Test Interactive Tool
**File**: `frontend/src/pages/StressTest.jsx`

```
Interactive cascade simulator:
- Slider: initial shock from -1% to -50%
- Animated waterfall chart showing cascade propagation:
  Round 1: $X liquidations → Y% additional price impact
  Round 2: $X' more liquidations → Y'% more impact
  ...
  Final: total damage
- Protocol-by-protocol breakdown per round
- Compare current fragility vs historical (e.g., "current cascade risk is
  in the 85th percentile vs past year")
```

---

### Phase 10: Polish & Deploy

- [ ] Tailwind CSS + shadcn/ui design system across all pages
- [ ] Real-time WebSocket updates for fear index (subscribe to new blocks)
- [ ] nginx reverse proxy + systemd services for all components
- [ ] Cron jobs: hourly full index recomputation, per-block lightweight update
- [ ] Monitoring: Shovel sync lag, DB size, API latency
- [ ] Rate limiting on SQL editor
- [ ] Documentation site with methodology paper

---

## KEY CONTRACT ADDRESSES (Ethereum Mainnet)

```json
{
  "uniswap_v3": {
    "factory": "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    "position_manager": "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    "eth_usdc_005": "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
    "eth_usdc_030": "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
    "eth_usdt_030": "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
    "wbtc_eth_030": "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD"
  },
  "aave_v3": {
    "pool": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    "pool_data_provider": "0x7B4EB56E7CD4b454BA8ff71E4518426c8fa7972A",
    "oracle": "0x54586bE62E3c3580375aE3723C145253060Ca0C2"
  },
  "maker": {
    "vat": "0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B",
    "dog": "0x135954d155898D42C90D2a57824C690e0c7BEf1B",
    "spot": "0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3"
  },
  "curve": {
    "3pool": "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
    "steth_eth": "0xDC24316b9AE028F1497c275EB9192a3Ea0f67022"
  },
  "lido": {
    "steth": "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    "withdrawal_queue": "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1"
  },
  "bridges": {
    "arbitrum_gateway": "0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a",
    "optimism_portal": "0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1"
  }
}
```

## EXTERNAL API ENDPOINTS

```json
{
  "hyperliquid": {
    "info": "POST https://api.hyperliquid.xyz/info",
    "evm_rpc": "https://rpc.hyperliquid.xyz/evm"
  },
  "coinglass": {
    "funding": "https://open-api.coinglass.com/public/v2/funding",
    "liquidation": "https://open-api.coinglass.com/public/v2/liquidation_chart",
    "docs": "https://docs.coinglass.com"
  },
  "deribit": {
    "dvol": "GET /public/get_volatility_index_data",
    "docs": "https://docs.deribit.com"
  },
  "alternative_me": {
    "fng": "https://api.alternative.me/fng/?limit=0&format=json"
  },
  "flashbots_mempool": {
    "archive": "https://mempool-dumpster.flashbots.net/index.html"
  }
}
```

## IMPLEMENTATION PRIORITY ORDER

The build order matters because later phases depend on earlier ones:

```
Phase 3 (P(x) - Uniswap distribution)     ← DO FIRST, foundation for everything
    ↓
Phase 4 (I(x) - Static liquidation map)   ← Can parallelize with Phase 3
    ↓
Phase 5 (Cascade simulator)               ← Needs both Phase 3 + 4
    ↓
Phase 6 (Fear index computation)           ← Needs Phase 3 + 5
    ↓
Phase 7 (Validation & backtesting)         ← Needs Phase 6 + archive node
    ↓
Phase 8 (SQL editor)                       ← Independent, can build anytime
    ↓
Phase 9 (Dashboard)                        ← Needs Phase 6 for data
    ↓
Phase 10 (Polish & deploy)                 ← Last
```

## KEY ACADEMIC REFERENCES

- Lambert (2021): "Uniswap V3 LP Tokens as Perpetual Put and Call Options" — core theory for AMM→IV
- Lambert (2021): "On-chain Volatility and Uniswap v3" — IV formula derivation
- Angeris, Evans, Chitra (2021): "Replicating Market Makers" arXiv:2103.14769 — mathematical foundation
- Milionis et al. (2022): "Loss Versus Rebalancing" — LVR ∝ σ² × liquidity
- Zelos Research / arXiv:2411.12375: "Risk-Neutral Pricing of LP Positions" — per-position IV
- arXiv:2509.05013: "Dynamics of Liquidity Surfaces in Uniswap v3" — PCA of liquidity distribution
- Woebbeking (2021): "Cryptocurrency Volatility Markets" PMC8326316 — crypto VIX methodology
- Panoptic Research (2024): "Comparing Uniswap and Deribit Implied Volatilities"
- Adrian & Brunnermeier (2016): CoVaR — systemic risk framework (analogue for cascade model)
- Corsi (2009): HAR-RV model — benchmark for volatility prediction
- BIS WP 1062 & 1171: DeFi systemic risk and liquidation dynamics

## TOOLS & DEPENDENCIES

```
# Python
web3>=6.0          # Ethereum interaction
duckdb             # Analytical queries on parquet
sqlalchemy         # PostgreSQL ORM
fastapi            # API framework
uvicorn            # ASGI server
pandas, numpy      # Data manipulation
scipy, statsmodels # Statistical analysis (Granger, ADF, VAR)
scikit-learn       # LASSO, feature selection
matplotlib, plotly # Visualization
pyarrow            # Parquet I/O

# Node.js
react, react-dom   # Frontend
@codemirror/lang-sql # SQL editor
recharts or plotly.js # Charts
tailwindcss        # Styling
shadcn/ui          # Component library

# Infrastructure
cryo               # Historical blockchain data extraction
shovel             # Real-time event indexing
postgresql         # Live data store
duckdb             # Analytical data store
nginx              # Reverse proxy
```
