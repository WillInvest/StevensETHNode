# Stevens Blockchain Analytics

A comprehensive on-chain data analytics platform built on a fully-synced Erigon v3 archive node with real-time and historical data indexing.

## Quick Start

Start all services locally:

```bash
# Terminal 1: Start FastAPI backend
ETHNODE_DATABASE_URL=postgres://ethnode:ethnode@localhost:15432/ethnode \
  uvicorn web.app:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Start React frontend (dev)
cd web/frontend && npm run dev

# Backend: http://localhost:8000
# Frontend: http://localhost:5173
# API Explorer: http://localhost:8000/docs
```

## Architecture

- **Archive Node**: Erigon v3 (`10.246.103.160:8545`)
- **Real-time Indexer**: Shovel (PostgreSQL)
- **Historical Extraction**: Cryo (Paradigm, Parquet → PostgreSQL)
- **Database**: PostgreSQL 14 (`localhost:15432` via SSH tunnel)
- **Backend API**: FastAPI
- **Frontend**: React 18 + Vite

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — Project overview, stack, key paths, env vars, node server commands
- **[docs/architecture.md](./docs/architecture.md)** — System design and data flow
- **[docs/api-reference.md](./docs/api-reference.md)** — All REST and SSE endpoints
- **[docs/FRONTEND.md](./docs/FRONTEND.md)** — Frontend architecture, components, theme
- **[docs/deployment.md](./docs/deployment.md)** — Production setup with nginx and systemd
- **[docs/adding-protocols.md](./docs/adding-protocols.md)** — How to index new protocols
- **[docs/sci-methodology.md](./docs/sci-methodology.md)** — Stevens Crypto Index scoring

## Testing

```bash
# Run all tests
node tests/run-all.js

# Run frontend tests
cd web/frontend && npm test

# Run backend tests
pytest tests/
```

## Key Pages

- **Home** — Dashboard with key metrics
- **Browse** — SQL table browser
- **Data** — Advanced data explorer
- **Explore** — Protocol-specific pool/position explorer
- **Query** — Custom SQL query runner
- **SCI** — Stevens Crypto Index tracking
- **Fear Index** — Market sentiment analysis
- **Mempool** — Ethereum mempool monitoring
- **Eth Distribution** — Staking and validator analysis
- **Extraction** — Cryo job management

## Latest Updates (2026-03-06)

### Frontend Improvements

**Pool Search & Grouping**
- Added `PoolSearchInput.jsx` — Real-time pool filtering
- Added `PoolGroup.jsx` — Collapsible pool grouping by trading pair
- Added `poolFilters.js` utilities — Filter, format fee tiers, normalize pairs
- Added `poolGrouping.js` utilities — Group pools by trading pair
- Enhanced `SidebarTree.jsx` with search/group integration
- 28 unit tests (100% utility coverage)

**UI/UX Enhancements**
- Created `etherscan.js` utilities — Etherscan link generation
- Created `TxHashLink.jsx` — Clickable transaction hash component
- Applied cyber theme with CSS variables (--cyber-cyan, --cyber-green, etc.)
- Scanline animations and neon glow effects
- Updated explore tabs to use TxHashLink component

**Theme & Styling**
- Cyber color palette: `--cyber-cyan (#00ffff)`, `--cyber-green (#00ff00)`, `--cyber-magenta (#ff00ff)`, `--cyber-blue (#0099ff)`
- Tailwind integration with theme colors
- CSS variables for consistent theming

For details, see [docs/FRONTEND.md](./docs/FRONTEND.md).

## Support

- SSH tunnel to node server: `ssh hfu11@10.246.103.160`
- Database tunnel: `ssh -N -f -L 15432:localhost:5432 -L 8545:localhost:8545 -L 8546:localhost:8546 hfu11@10.246.103.160`
- Erigon RPC: `http://127.0.0.1:8545`
- Check block height: `curl -s -X POST http://127.0.0.1:8545 -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`
