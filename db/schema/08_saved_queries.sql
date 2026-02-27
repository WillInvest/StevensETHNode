-- Saved queries library
CREATE TABLE IF NOT EXISTS _saved_queries (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    sql_text    TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed with useful starter queries
INSERT INTO _saved_queries (name, description, sql_text) VALUES
('Recent Swaps', 'Latest 50 Uniswap V3 swaps', 'SELECT block_num, encode(tx_hash, ''hex'') AS tx_hash, encode(sender, ''hex'') AS sender, amount0, amount1, tick FROM uniswap_v3_swaps ORDER BY block_num DESC LIMIT 50'),
('Swap Volume by Block', 'Total swap volume per block (last 100 blocks)', 'SELECT block_num, COUNT(*) AS swap_count, SUM(ABS(amount0)) AS total_amount0 FROM uniswap_v3_swaps GROUP BY block_num ORDER BY block_num DESC LIMIT 100'),
('Top Swap Senders', 'Most active swap addresses', 'SELECT encode(sender, ''hex'') AS sender, COUNT(*) AS swap_count FROM uniswap_v3_swaps GROUP BY sender ORDER BY swap_count DESC LIMIT 20'),
('Table Sizes', 'Row counts for all indexed tables', 'SELECT schemaname AS schema, tablename AS table_name, n_live_tup AS row_count FROM pg_stat_user_tables ORDER BY n_live_tup DESC')
ON CONFLICT DO NOTHING;
