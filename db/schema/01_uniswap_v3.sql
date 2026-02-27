-- Uniswap V3 Swap events table
-- Note: Shovel auto-creates this table from config.json.
-- This file exists as documentation and for manual setup if needed.

CREATE TABLE IF NOT EXISTS uniswap_v3_swaps (
    chain_id        INT NOT NULL,
    block_num       BIGINT NOT NULL,
    tx_hash         BYTEA NOT NULL,
    log_addr        BYTEA,
    sender          BYTEA,
    recipient       BYTEA,
    amount0         NUMERIC,
    amount1         NUMERIC,
    sqrt_price_x96  NUMERIC,
    liquidity       NUMERIC,
    tick            INT
);

CREATE INDEX IF NOT EXISTS idx_uniswap_v3_swaps_block
    ON uniswap_v3_swaps (block_num);

CREATE INDEX IF NOT EXISTS idx_uniswap_v3_swaps_sender
    ON uniswap_v3_swaps (sender);
