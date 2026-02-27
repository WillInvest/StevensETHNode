# Stevens Crypto Index (SCI) — Methodology

**Stevens Institute of Technology — Blockchain Analytics Research**

## Abstract

The Stevens Crypto Index (SCI) is a composite 0–100 score that measures the overall health and activity of the Ethereum ecosystem. By aggregating on-chain data from multiple DeFi protocols and network-level metrics into a single interpretable index, the SCI provides researchers, traders, and analysts with a real-time barometer of Ethereum ecosystem activity. This document describes the methodology, data sources, normalization techniques, and interpretation guidelines.

## 1. Introduction

Blockchain ecosystems generate vast amounts of on-chain data across decentralized exchanges, lending protocols, bridges, and base-layer transactions. While individual metrics (e.g., gas prices, swap volumes) provide narrow insights, there is a need for a composite indicator that captures the holistic state of the ecosystem.

The SCI addresses this by combining 6 orthogonal components into a weighted composite score, normalized using statistical methods that account for temporal variation.

## 2. Components

The SCI is composed of 6 weighted components chosen for their orthogonality and coverage:

| Component | Weight | Source Data | Rationale |
|-----------|--------|-------------|-----------|
| DEX Activity | 25% | Uniswap V3 swaps, Curve exchanges | Primary DeFi activity indicator; captures market-making and trading demand |
| Lending Activity | 20% | Aave V3 supply/borrow, Compound V3 supply | Measures capital deployment appetite and yield-seeking behavior |
| Liquidation Stress | 15% | Aave V3 liquidations, Compound V3 absorbs | Inverse indicator of market health; spikes signal systemic stress |
| Gas Market | 15% | Base fee, priority fees, gas utilization | Network demand proxy; reflects willingness to pay for block space |
| Network Health | 15% | ERC-20 transfer counts | General throughput indicator independent of DeFi-specific activity |
| Bridge Activity | 10% | Arbitrum, Optimism, Base L1 deposits | Cross-chain capital flow indicator; reflects L2 ecosystem growth |

### 2.1 Weight Justification

Weights were assigned based on:
- **Coverage**: DEX activity receives the highest weight (25%) as the broadest indicator of ecosystem engagement
- **Independence**: Components with higher correlation to others receive lower weights
- **Signal quality**: Components with cleaner data and less noise receive higher weights
- **Relevance**: Emerging categories (bridges) receive lower weight until data maturity improves

## 3. Data Collection

### 3.1 Infrastructure

All data is sourced from a fully-synced Erigon v3.4.0-dev archive node running on Ethereum mainnet. Events are indexed in two ways:

1. **Real-time**: Shovel (indexsupply) continuously indexes contract events into PostgreSQL
2. **Historical**: Cryo (Paradigm) bulk-extracts historical log data to Parquet, then loads via DuckDB

### 3.2 Contracts Monitored

| Protocol | Contract | Events | Start Block |
|----------|----------|--------|-------------|
| Uniswap V3 | `0x88e6A0c2...` (USDC/WETH pool) | Swap | 12,376,729 |
| Aave V3 | `0x87870Bca...` (Pool) | Supply, Borrow, Repay, LiquidationCall | 16,291,127 |
| Compound V3 | `0xc3d688B6...` (cUSDCv3) | Supply, Withdraw, AbsorbDebt | 15,331,586 |
| Curve | `0xbEbc4478...` (3pool) | TokenExchange, AddLiquidity | 10,809,473 |
| Lido | `0xae7ab965...` (stETH) | Submitted, TransferShares | 11,473,216 |
| ERC-20 | WETH, USDC, USDT, DAI | Transfer | 4,719,568 |
| Arbitrum | `0x83151...` (Bridge) | MessageDelivered | 15,411,056 |
| Optimism | `0xbEb5F...` (Portal) | TransactionDeposited | 17,365,801 |
| Base | `0x49048...` (Portal) | TransactionDeposited | 17,482,143 |

### 3.3 Sampling Window

Each SCI computation aggregates data over a rolling window of **300 blocks** (~1 hour at ~12s block times). This window balances responsiveness with noise reduction.

## 4. Normalization

### 4.1 Z-Score Normalization

Each raw metric is normalized using z-scores against a **30-day rolling window**:

```
z = (x - μ_30d) / σ_30d
```

Where:
- `x` = current window metric value
- `μ_30d` = mean of the same metric computed over hourly windows in the past 30 days
- `σ_30d` = standard deviation of the same metric over 30 days

The 30-day window provides seasonal context, allowing the SCI to distinguish between "normal for this period" and "abnormal" activity.

### 4.2 Score Mapping

Z-scores are mapped to the 0–100 range using linear clamping:

```
score = clamp(50 + z × 15, 0, 100)
```

This mapping ensures:
- **50** = exactly average activity for the 30-day period
- **65** = one standard deviation above average
- **35** = one standard deviation below average
- **0** and **100** = extreme outliers (>3.3σ from mean)

### 4.3 Liquidation Inversion

The liquidation component uses an inverted scale:

```
liquidation_score = 100 - raw_score
```

This ensures that high liquidation activity (market stress) produces a low score, while calm markets produce a high score.

## 5. Composite Calculation

The final SCI score is the weighted sum of all component scores:

```
SCI = Σ(w_i × score_i) for i in {dex, lending, liquidation, gas, network, bridge}
```

## 6. Interpretation Guide

| SCI Range | Label | Market Conditions |
|-----------|-------|-------------------|
| 80–100 | Very High | Euphoric market or stress event; unusual activity across all components |
| 60–79 | Elevated | Active trading, healthy lending, growing cross-chain activity |
| 40–59 | Normal | Baseline operations; typical market behavior |
| 20–39 | Suppressed | Reduced trading, low gas demand, bear market conditions |
| 0–19 | Very Low | Minimal activity; potential network or market crisis |

### 6.1 Component-Level Analysis

When the composite SCI shows an unusual reading, analysts should examine individual component scores to identify the driver:

- **High DEX + Low Lending**: Speculative trading without capital commitment
- **Low DEX + High Liquidation Stress**: Market downturn with forced selling
- **High Gas + Normal DEX**: MEV activity or NFT mint event
- **High Bridge**: Capital migration to L2s

## 7. Limitations

1. **Protocol coverage**: The SCI currently monitors a subset of Ethereum protocols. Adding more protocols would improve coverage but increase computational cost.
2. **Single-chain**: Only Ethereum mainnet is indexed. L2 activity is only captured via bridge deposits.
3. **Equal treatment**: All swap events are weighted equally regardless of volume.
4. **Bootstrap period**: The 30-day rolling window requires 30 days of data before normalization is meaningful.
5. **Gas proxy**: Without direct access to block-level gas data in the database, gas activity is proxied through transaction density.

## 8. Future Work

- Incorporate DEX volume weighting (not just event counts)
- Add staking data (Lido withdrawals, validator entries/exits)
- Extend to L2 on-chain data (Arbitrum, Optimism block-level metrics)
- Implement volatility-adjusted weighting (GARCH-based)
- Academic peer review and backtesting against market events (Terra collapse, FTX, etc.)

## References

1. Ethereum Foundation. "EIP-1559: Fee market change." 2021.
2. Adams et al. "Uniswap V3 Core." 2021.
3. Aave. "Aave V3 Technical Paper." 2022.
4. Paradigm. "Cryo: Ethereum data extraction." 2023.
5. Index Supply. "Shovel: Ethereum indexer." 2024.
