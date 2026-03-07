# extract-uniswapv3 CLI Tool Plan

## Overview
Build a Python CLI tool for bulk historical extraction of Uniswap V3 events (Swap, Mint, Burn) from the Erigon V3 archive node into PostgreSQL.

## Architecture

### Two-Phase Design
1. **Extraction Phase**: Async RPC calls (eth_getLogs) with concurrent workers
2. **Upload Phase**: Bulk PostgreSQL insert using psycopg COPY for speed

### Key Decisions
- **asyncio + aiohttp** for concurrent RPC calls (aiohttp already installed)
- **psycopg v3** (sync) for PostgreSQL bulk insert via COPY
- **rich** library for terminal dashboard with progress bars
- **Checkpoint file** (JSON) for resume capability
- **Batch size**: 2000 blocks default (matches realtime_indexer.py), configurable

### Database Target Tables
All in `uniswap_v3` schema (already exist):
- `uniswap_v3.swap_events` — PK: (chain_id, pool_id, block, tx_hash, log_index)
- `uniswap_v3.mint_events` — PK: (chain_id, pool_id, block, tx_hash, log_index)
- `uniswap_v3.burn_events` — PK: (chain_id, pool_id, block, tx_hash, log_index)

### Event Signatures
- Swap: `0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67`
- Mint: `0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde`
- Burn: `0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c`

### Event Decoding
Reuse decoding logic from `scripts/realtime_indexer.py`:
- Swap: 5 data slots (amount0, amount1, sqrt_price_x96, liquidity, tick) + 2 indexed (sender, recipient)
- Mint: 4 data slots (sender, amount, amount0, amount1) + 3 indexed (owner, tickLower, tickUpper)
- Burn: 3 data slots (amount, amount0, amount1) + 3 indexed (owner, tickLower, tickUpper)

### Extraction Flow
1. Read pool addresses from txt file
2. Get chain head via eth_blockNumber
3. For each pool, determine start block (from --start-block or checkpoint)
4. Phase 1: Extract events using eth_getLogs in batches with N async workers
   - All events stored in memory as decoded tuples
   - Progress bar per pool showing block progress
5. Phase 2: Bulk upload using psycopg COPY
   - Progress bar showing rows inserted
   - ON CONFLICT DO NOTHING for idempotency

### Resume Capability
- Checkpoint file: `.extract_uniswapv3_checkpoint.json`
- Stores: `{pool_address: last_completed_block}` per pool
- Updated after each successful batch during extraction
- `--resume` flag loads checkpoint and skips completed ranges

### Rich Dashboard Layout
```
Uniswap V3 Extractor
Chain head: 24,580,762 | Start: 23,860,000 | Blocks: 720,762

Phase 1: Extracting Events
Pool 0x88e6...5640 (0.05%) ████████████░░░░░░░░ 60% [432,457/720,762 blocks]
Pool 0x8ad5...06d8 (0.30%) ██████████████░░░░░░ 70% [504,533/720,762 blocks]
Pool 0x7bea...c387 (1.00%) ████████████████░░░░ 80% [576,609/720,762 blocks]

Stats: 125 RPC/s | 3,421 events/s | 00:15:32 elapsed | ~00:05:11 ETA
Errors: 2 | Last: "timeout at block 24100000"

Phase 2: Uploading to PostgreSQL
Swaps   ██████████████████░░  90% [499,740/555,267 rows]
Mints   ████████████████████ 100% [13,500/13,500 rows]
Burns   ████████████████████ 100% [15,700/15,700 rows]
```

## File Structure
- `scripts/extract_uniswapv3.py` — Main CLI tool
- `pools.txt` — Sample pool addresses file
