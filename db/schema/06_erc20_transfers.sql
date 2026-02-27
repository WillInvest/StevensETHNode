-- ERC-20 Transfer events for major tokens
-- WETH: 0xC02aaA39b223FE8D0A5C4F27eAD9083C756Cc2 (deploy block ~4719568)
-- USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
-- USDT: 0xdAC17F958D2ee523a2206206994597C13D831ec7
-- DAI:  0x6B175474E89094C44Da98b954EedeAC495271d0F
-- Note: Shovel auto-creates this table from config.json.

CREATE TABLE IF NOT EXISTS erc20_transfers (
    chain_id    INT NOT NULL,
    block_num   BIGINT NOT NULL,
    tx_hash     BYTEA NOT NULL,
    log_addr    BYTEA,
    from_addr   BYTEA,
    to_addr     BYTEA,
    value       NUMERIC
);
CREATE INDEX IF NOT EXISTS idx_erc20_transfers_block ON erc20_transfers (block_num);
CREATE INDEX IF NOT EXISTS idx_erc20_transfers_token ON erc20_transfers (log_addr);
CREATE INDEX IF NOT EXISTS idx_erc20_transfers_from ON erc20_transfers (from_addr);
