-- Compound V3 (Comet) events
-- Contract: 0xc3d688B66703497DAA19211EEdff47f25384cdc3 (cUSDCv3)
-- Note: Shovel auto-creates these tables from config.json.

CREATE TABLE IF NOT EXISTS compound_v3_supply (
    chain_id    INT NOT NULL,
    block_num   BIGINT NOT NULL,
    tx_hash     BYTEA NOT NULL,
    log_addr    BYTEA,
    from_addr   BYTEA,
    dst         BYTEA,
    amount      NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_compound_v3_supply_block ON compound_v3_supply (block_num);

CREATE TABLE IF NOT EXISTS compound_v3_withdraw (
    chain_id    INT NOT NULL,
    block_num   BIGINT NOT NULL,
    tx_hash     BYTEA NOT NULL,
    log_addr    BYTEA,
    src         BYTEA,
    to_addr     BYTEA,
    amount      NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_compound_v3_withdraw_block ON compound_v3_withdraw (block_num);

CREATE TABLE IF NOT EXISTS compound_v3_absorb (
    chain_id    INT NOT NULL,
    block_num   BIGINT NOT NULL,
    tx_hash     BYTEA NOT NULL,
    log_addr    BYTEA,
    absorber    BYTEA,
    borrower    BYTEA,
    base_paid   NUMERIC,
    usd_value   NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_compound_v3_absorb_block ON compound_v3_absorb (block_num);
