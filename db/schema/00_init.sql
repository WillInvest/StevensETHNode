-- Stevens Blockchain Analytics — Database initialization
-- Run once: psql -d ethnode -f db/schema/00_init.sql

-- Ensure we have the ethnode database and user
-- (Run as superuser if needed:)
-- CREATE USER ethnode WITH PASSWORD 'ethnode';
-- CREATE DATABASE ethnode OWNER ethnode;

-- Extension for common crypto operations
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Metadata table to track indexed protocols
CREATE TABLE IF NOT EXISTS _meta_protocols (
    name        TEXT PRIMARY KEY,
    description TEXT,
    start_block BIGINT,
    indexed_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO _meta_protocols (name, description, start_block)
VALUES ('uniswap_v3', 'Uniswap V3 DEX — USDC/WETH pool swaps', 12376729)
ON CONFLICT (name) DO NOTHING;

INSERT INTO _meta_protocols (name, description, start_block)
VALUES ('aave_v3', 'Aave V3 Lending — Supply, Borrow, Repay, Liquidation', 16291127)
ON CONFLICT (name) DO NOTHING;

INSERT INTO _meta_protocols (name, description, start_block)
VALUES ('compound_v3', 'Compound V3 (Comet) — Supply, Withdraw, AbsorbDebt', 15331586)
ON CONFLICT (name) DO NOTHING;

INSERT INTO _meta_protocols (name, description, start_block)
VALUES ('curve', 'Curve Finance — 3pool TokenExchange, AddLiquidity', 10809473)
ON CONFLICT (name) DO NOTHING;

INSERT INTO _meta_protocols (name, description, start_block)
VALUES ('lido', 'Lido stETH — Submitted, TransferShares', 11473216)
ON CONFLICT (name) DO NOTHING;

INSERT INTO _meta_protocols (name, description, start_block)
VALUES ('erc20_transfers', 'ERC-20 Transfers — WETH, USDC, USDT, DAI', 4719568)
ON CONFLICT (name) DO NOTHING;

INSERT INTO _meta_protocols (name, description, start_block)
VALUES ('bridges', 'L2 Bridges — Arbitrum, Optimism, Base deposit events', 15411056)
ON CONFLICT (name) DO NOTHING;
