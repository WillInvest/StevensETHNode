# Stevens Crypto Index (SCI) — Methodology

## Overview

The Stevens Crypto Index (SCI) is a composite 0–100 score that measures the overall health and activity of the Ethereum ecosystem. It aggregates on-chain data from multiple DeFi protocols and network metrics into a single, interpretable index.

## Components

The SCI is composed of 6 weighted components:

| Component | Weight | Source Data | What It Measures |
|-----------|--------|-------------|------------------|
| DEX Activity | 25% | Uniswap V3 swaps, Curve exchanges | Trading volume and frequency |
| Lending Activity | 20% | Aave V3 supply/borrow, Compound V3 supply | Capital deployment in lending |
| Liquidation Stress | 15% | Aave V3 liquidations, Compound V3 absorbs | Market distress indicator (inverse) |
| Gas Market | 15% | Base fee, priority fees, gas utilization | Network demand and congestion |
| Network Health | 15% | Block times, tx counts, ERC-20 transfers | General network throughput |
| Bridge Activity | 10% | Arbitrum, Optimism, Base deposits | Cross-chain capital flows |

## Calculation Method

### 1. Raw Metric Collection

For each component, raw metrics are collected over a rolling window (default: 1 hour of blocks, ~300 blocks):

- **DEX**: swap count, total volume (amount0 + amount1)
- **Lending**: supply count + borrow count, total amounts
- **Liquidation**: liquidation count, total debt covered (inverse — fewer = healthier)
- **Gas**: avg base fee, avg priority fee, avg gas utilization ratio
- **Network**: avg tx count per block, ERC-20 transfer count
- **Bridge**: deposit count across all 3 bridges

### 2. Z-Score Normalization

Each raw metric is normalized using z-scores against a 30-day rolling window:

```
z = (value - mean_30d) / std_30d
```

### 3. Score Mapping

Z-scores are mapped to 0–100 using a sigmoid-like clamping:

```
score = clamp(50 + z * 15, 0, 100)
```

This centers "normal" activity at 50, with values above 65 indicating elevated activity and values below 35 indicating suppressed activity.

### 4. Special Case: Liquidation Score

The liquidation component is inverted — more liquidations indicate market stress, so the score is:

```
liquidation_score = 100 - raw_score
```

### 5. Composite Score

The final SCI score is the weighted sum:

```
SCI = 0.25 * dex + 0.20 * lending + 0.15 * liquidation + 0.15 * gas + 0.15 * network + 0.10 * bridge
```

## Interpretation

| SCI Range | Interpretation |
|-----------|---------------|
| 80–100 | Very high activity — potential market euphoria or stress event |
| 60–79 | Elevated activity — healthy bull market conditions |
| 40–59 | Normal activity — baseline network operations |
| 20–39 | Suppressed activity — bear market or low engagement |
| 0–19 | Very low activity — potential network issues |

## Data Sources

All data is sourced from our fully-synced Erigon v3.4.0-dev archive node running on Ethereum mainnet, indexed via Shovel for real-time events and Cryo for historical backfill.
