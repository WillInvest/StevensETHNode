-- Aave V3 Lending Protocol events
-- Contract: 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 (Aave V3 Pool)
-- Note: Shovel auto-creates these tables from config.json.

CREATE TABLE IF NOT EXISTS aave_v3_supply (
    chain_id    INT NOT NULL,
    block_num   BIGINT NOT NULL,
    tx_hash     BYTEA NOT NULL,
    log_addr    BYTEA,
    reserve     BYTEA,
    user_addr   BYTEA,
    on_behalf   BYTEA,
    amount      NUMERIC,
    ref_code    INT
);
CREATE INDEX IF NOT EXISTS idx_aave_v3_supply_block ON aave_v3_supply (block_num);

CREATE TABLE IF NOT EXISTS aave_v3_borrow (
    chain_id        INT NOT NULL,
    block_num       BIGINT NOT NULL,
    tx_hash         BYTEA NOT NULL,
    log_addr        BYTEA,
    reserve         BYTEA,
    user_addr       BYTEA,
    on_behalf       BYTEA,
    amount          NUMERIC,
    interest_mode   INT,
    borrow_rate     NUMERIC,
    ref_code        INT
);
CREATE INDEX IF NOT EXISTS idx_aave_v3_borrow_block ON aave_v3_borrow (block_num);

CREATE TABLE IF NOT EXISTS aave_v3_repay (
    chain_id    INT NOT NULL,
    block_num   BIGINT NOT NULL,
    tx_hash     BYTEA NOT NULL,
    log_addr    BYTEA,
    reserve     BYTEA,
    user_addr   BYTEA,
    repayer     BYTEA,
    amount      NUMERIC,
    use_atokens BOOLEAN
);
CREATE INDEX IF NOT EXISTS idx_aave_v3_repay_block ON aave_v3_repay (block_num);

CREATE TABLE IF NOT EXISTS aave_v3_liquidation (
    chain_id            INT NOT NULL,
    block_num           BIGINT NOT NULL,
    tx_hash             BYTEA NOT NULL,
    log_addr            BYTEA,
    collateral_asset    BYTEA,
    debt_asset          BYTEA,
    user_addr           BYTEA,
    debt_covered        NUMERIC,
    collateral_amount   NUMERIC,
    liquidator          BYTEA,
    receive_atoken      BOOLEAN
);
CREATE INDEX IF NOT EXISTS idx_aave_v3_liquidation_block ON aave_v3_liquidation (block_num);
