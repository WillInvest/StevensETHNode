-- Lido stETH events
-- Contract: 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84 (stETH)
-- Note: Shovel auto-creates these tables from config.json.

CREATE TABLE IF NOT EXISTS lido_submitted (
    chain_id    INT NOT NULL,
    block_num   BIGINT NOT NULL,
    tx_hash     BYTEA NOT NULL,
    log_addr    BYTEA,
    sender      BYTEA,
    amount      NUMERIC,
    referral    BYTEA
);
CREATE INDEX IF NOT EXISTS idx_lido_submitted_block ON lido_submitted (block_num);

CREATE TABLE IF NOT EXISTS lido_transfer_shares (
    chain_id        INT NOT NULL,
    block_num       BIGINT NOT NULL,
    tx_hash         BYTEA NOT NULL,
    log_addr        BYTEA,
    from_addr       BYTEA,
    to_addr         BYTEA,
    shares_value    NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_lido_transfer_shares_block ON lido_transfer_shares (block_num);
