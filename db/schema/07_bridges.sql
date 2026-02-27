-- L2 Bridge events (Arbitrum, Optimism, Base)
-- Note: Shovel auto-creates these tables from config.json.

-- Arbitrum: MessageDelivered on Bridge contract
-- Contract: 0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a
CREATE TABLE IF NOT EXISTS arb_message_delivered (
    chain_id        INT NOT NULL,
    block_num       BIGINT NOT NULL,
    tx_hash         BYTEA NOT NULL,
    log_addr        BYTEA,
    message_index   NUMERIC,
    before_acc      BYTEA,
    inbox           BYTEA,
    kind            INT,
    sender          BYTEA,
    message_hash    BYTEA,
    base_fee        NUMERIC,
    timestamp_val   NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_arb_msg_block ON arb_message_delivered (block_num);

-- Optimism Portal: TransactionDeposited
-- Contract: 0xbEb5Fc579115071764c7423A4f12eDde41f106Ed
CREATE TABLE IF NOT EXISTS op_tx_deposited (
    chain_id    INT NOT NULL,
    block_num   BIGINT NOT NULL,
    tx_hash     BYTEA NOT NULL,
    log_addr    BYTEA,
    from_addr   BYTEA,
    to_addr     BYTEA,
    version     NUMERIC,
    opaque_data BYTEA
);
CREATE INDEX IF NOT EXISTS idx_op_tx_block ON op_tx_deposited (block_num);

-- Base Portal: TransactionDeposited
-- Contract: 0x49048044D57e1C92A77f79988d21Fa8fAF36f97
CREATE TABLE IF NOT EXISTS base_tx_deposited (
    chain_id    INT NOT NULL,
    block_num   BIGINT NOT NULL,
    tx_hash     BYTEA NOT NULL,
    log_addr    BYTEA,
    from_addr   BYTEA,
    to_addr     BYTEA,
    version     NUMERIC,
    opaque_data BYTEA
);
CREATE INDEX IF NOT EXISTS idx_base_tx_block ON base_tx_deposited (block_num);
