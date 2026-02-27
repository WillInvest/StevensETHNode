-- Stevens Crypto Index (SCI) snapshots
CREATE TABLE IF NOT EXISTS sci_snapshots (
    id              SERIAL PRIMARY KEY,
    block_num       BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ,
    -- Component scores (0-100 each)
    dex_score       NUMERIC(6,2),
    lending_score   NUMERIC(6,2),
    liquidation_score NUMERIC(6,2),
    gas_score       NUMERIC(6,2),
    network_score   NUMERIC(6,2),
    bridge_score    NUMERIC(6,2),
    -- Composite
    sci_score       NUMERIC(6,2) NOT NULL,
    -- Raw data for auditability
    raw_metrics     JSONB,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sci_block ON sci_snapshots (block_num);
CREATE INDEX IF NOT EXISTS idx_sci_timestamp ON sci_snapshots (block_timestamp);
