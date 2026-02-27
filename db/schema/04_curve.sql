-- Curve Finance 3pool events
-- Contract: 0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7 (3pool)
-- Note: Shovel auto-creates these tables from config.json.

CREATE TABLE IF NOT EXISTS curve_token_exchange (
    chain_id        INT NOT NULL,
    block_num       BIGINT NOT NULL,
    tx_hash         BYTEA NOT NULL,
    log_addr        BYTEA,
    buyer           BYTEA,
    sold_id         NUMERIC,
    tokens_sold     NUMERIC,
    bought_id       NUMERIC,
    tokens_bought   NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_curve_token_exchange_block ON curve_token_exchange (block_num);

CREATE TABLE IF NOT EXISTS curve_add_liquidity (
    chain_id        INT NOT NULL,
    block_num       BIGINT NOT NULL,
    tx_hash         BYTEA NOT NULL,
    log_addr        BYTEA,
    provider        BYTEA,
    token_amounts_0 NUMERIC,
    token_amounts_1 NUMERIC,
    token_amounts_2 NUMERIC,
    fees_0          NUMERIC,
    fees_1          NUMERIC,
    fees_2          NUMERIC,
    token_supply    NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_curve_add_liquidity_block ON curve_add_liquidity (block_num);
