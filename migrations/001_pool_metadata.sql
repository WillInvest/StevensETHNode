-- Migration: create uniswap_v3.pool_metadata table
-- Run: psql "$ETHNODE_DATABASE_URL" -f migrations/001_pool_metadata.sql

CREATE TABLE IF NOT EXISTS uniswap_v3.pool_metadata (
    pool_address TEXT PRIMARY KEY,
    token0_address TEXT NOT NULL,
    token1_address TEXT NOT NULL,
    token0_symbol TEXT NOT NULL,
    token1_symbol TEXT NOT NULL,
    fee INTEGER NOT NULL,
    fee_label TEXT NOT NULL,
    display_name TEXT GENERATED ALWAYS AS (token0_symbol || '/' || token1_symbol) STORED,
    resolved_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pool_metadata_display ON uniswap_v3.pool_metadata (display_name);
