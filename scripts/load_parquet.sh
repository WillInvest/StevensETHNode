#!/usr/bin/env bash
# Stevens Blockchain Analytics — Load Parquet files into PostgreSQL via DuckDB
# Usage: bash scripts/load_parquet.sh
set -euo pipefail

DB_URL="${ETHNODE_DATABASE_URL:-dbname=ethnode user=ethnode}"
DATA_DIR="./data"

echo "=== Loading Uniswap V3 Swap events into PostgreSQL ==="
duckdb -c "
  INSTALL postgres; LOAD postgres;
  ATTACH '${DB_URL}' AS pg (TYPE POSTGRES);
  CREATE OR REPLACE TABLE pg.uniswap_v3_swaps AS
    SELECT * FROM '${DATA_DIR}/uniswap_v3_swaps/*.parquet';
"

echo "=== Verifying row count ==="
psql -d ethnode -c "SELECT count(*) AS swap_count FROM uniswap_v3_swaps;"

echo "=== Done ==="
