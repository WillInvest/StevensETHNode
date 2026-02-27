# Stevens Blockchain Analytics

## Project Overview
On-chain data analytics platform built on a fully-synced Erigon v3.4.0-dev archive node (mainnet).
Extracts blockchain data → PostgreSQL → web dashboard.

## Architecture
- **Erigon V3 Node**: RPC at `http://127.0.0.1:8545`
- **Cryo** (Paradigm, Rust): Bulk historical extraction → Parquet → DuckDB → PostgreSQL
- **Shovel** (indexsupply): Continuous real-time indexing → PostgreSQL directly
- **PostgreSQL 14**: Database `ethnode`, user `ethnode`
- **FastAPI**: Backend API at `:8000`
- **React + Vite**: Frontend at `:5173`

## Key Paths
- `shovel/config.json` — Shovel declarative indexer config (add protocols here)
- `web/app.py` — FastAPI entry point
- `web/frontend/src/` — React source
- `scripts/backfill.sh` — Cryo historical extraction commands
- `scripts/load_parquet.sh` — DuckDB Parquet → PostgreSQL loader
- `db/schema/` — SQL schema files

## Database
- PostgreSQL database: `ethnode`
- Connection: `$ETHNODE_DATABASE_URL` (see `.env.example`)
- Shovel auto-creates tables from its config
- Cryo data loaded via DuckDB

## Commands
```bash
# Start FastAPI backend
uvicorn web.app:app --host 0.0.0.0 --port 8000 --reload

# Start React frontend
cd web/frontend && npm run dev

# Run Shovel indexer
./shovel -config shovel/config.json

# Cryo extraction (example)
cryo collect logs --rpc http://localhost:8545 --blocks 20000000:20000100 --output-dir ./data/

# Load Parquet to PostgreSQL
bash scripts/load_parquet.sh
```

## Adding a New Protocol
1. Add a new integration entry to `shovel/config.json`
2. Restart Shovel — it auto-creates the table and begins indexing
3. For historical data: add Cryo commands to `scripts/backfill.sh`

## Code Style
- Python: FastAPI with async, type hints, psycopg for PostgreSQL
- JavaScript: React functional components, hooks, minimal dependencies
- SQL: Lowercase keywords, snake_case table/column names

## Agent & MCP Reference
- See `.claude/docs/mcp-and-tools-reference.md` for full MCP server catalog, Erigon API reference, and recommended architecture
- MCP servers are declared in config (not downloaded) — they are pulled via `npx` on demand
- Priority MCPs: evm-mcp (Erigon RPC), postgres-mcp (database), Context7 (live docs), @antv/mcp-server-chart (visualization)

## Workflow
- Always use plan mode (`Shift+Tab`) before multi-file or architectural changes
- Use subagents for isolated tasks (security review, test running, research)
- Use `/compact` between unrelated tasks to keep context clean
- Check `.claude/rules/` for file-type-specific conventions
