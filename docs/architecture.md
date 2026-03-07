# Architecture

## System Overview

```
Ethereum Mainnet
       │
       ▼
┌──────────────┐
│  Erigon v3   │  Archive node, RPC at :8545
│  (archive)   │  APIs: eth, net, web3, debug, trace, txpool
└──────┬───────┘
       │
       ├──────────────────────┐
       ▼                      ▼
┌──────────────┐    ┌──────────────┐
│    Shovel    │    │     Cryo     │
│  (real-time) │    │  (historical)│
│  indexer     │    │  bulk extract│
└──────┬───────┘    └──────┬───────┘
       │                   │
       │                   ▼
       │            ┌──────────────┐
       │            │    DuckDB    │
       │            │  Parquet→SQL │
       │            └──────┬───────┘
       │                   │
       ▼                   ▼
┌──────────────────────────────────┐
│         PostgreSQL 14            │
│  ethnode database                │
│  Tables: swaps, supply, borrow,  │
│  repay, liquidation, transfers,  │
│  bridges, sci_snapshots, etc.    │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│         FastAPI Backend          │
│  :8000                           │
│  Routers: browse, query, export, │
│  mempool, sci, stats, auth,      │
│  monitoring, saved_queries       │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│      React + Vite Frontend       │
│  :5173 (dev) / nginx (prod)      │
│  Pages: Home, Data, Browse,      │
│  Query, SCI, Mempool, Monitor    │
└──────────────────────────────────┘
```

## Data Flow

1. **Erigon** syncs Ethereum mainnet blocks and executes transactions
2. **Shovel** watches for contract events in real-time, writing directly to PostgreSQL
3. **Cryo** bulk-extracts historical event logs to Parquet files
4. **DuckDB** transforms Parquet → PostgreSQL for historical backfill
5. **FastAPI** serves data from PostgreSQL and live mempool data from Erigon RPC
6. **React** renders the dashboard with SSE for live updates

## Database Schema

- `uniswap_v3_swaps` — DEX swap events
- `aave_v3_supply/borrow/repay/liquidation` — Lending protocol events
- `compound_v3_supply/withdraw/absorb` — Compound events
- `curve_token_exchange/add_liquidity` — Curve DEX events
- `lido_submitted/transfer_shares` — Staking events
- `erc20_transfers` — Token transfer events (WETH, USDC, USDT, DAI)
- `arb_message_delivered/op_tx_deposited/base_tx_deposited` — Bridge events
- `sci_snapshots` — Stevens Crypto Index historical scores
- `_meta_protocols` — Protocol metadata
- `_saved_queries` — User-saved SQL queries
- `_users` — Authentication
