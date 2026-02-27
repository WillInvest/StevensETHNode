# Stevens Blockchain Analytics — Roadmap

## Phase 0: Project Setup
- [x] Git repo, CLAUDE.md, project structure
- [x] Tool installation (Cryo, Shovel, DuckDB)
- [x] Python + Node.js dependency setup

## Phase 1: MVP — Indexing + Web Viewer
- [x] Shovel config for Uniswap V3 Swap events
- [x] Cryo backfill scripts for historical data
- [x] DuckDB → PostgreSQL loader
- [x] FastAPI backend (table list, paginated browse)
- [x] React frontend (Home dashboard, table browser)
- [x] End-to-end test: Cryo → DB → API → Browser

## Phase 2: Multi-Protocol Indexing
- [x] Aave V3 (Supply, Borrow, Repay, Liquidation events)
- [x] Compound V3 (Supply, Withdraw, Absorb events)
- [x] Curve (TokenExchange, AddLiquidity events)
- [x] Lido (Submitted, TransferShares events)
- [x] ERC-20 Transfer events (major tokens: WETH, USDC, USDT, DAI)
- [x] Major bridge events (Arbitrum, Optimism, Base)

## Phase 3: Research Platform
- [x] SQL editor with CodeMirror (run ad-hoc queries)
- [x] Query result visualization (charts, time series)
- [x] Statistical analysis integration (pandas, scipy)
- [x] CSV/JSON export from any query or table view
- [x] Saved queries library

## Phase 4: Stevens Crypto Index (SCI)
- [x] Define SCI methodology (composite 0–100 score)
- [x] Components: protocol TVL utilization, DEX volumes, lending rates, liquidations, gas prices, network health
- [x] Historical SCI calculation engine
- [x] Real-time SCI updates
- [x] SCI dashboard with breakdown charts
- [x] Academic paper / methodology documentation

## Phase 5: Polish & Deploy
- [x] Tailwind CSS + shadcn/ui design system
- [x] Team authentication (SSO or simple auth)
- [x] nginx reverse proxy + systemd services
- [x] Monitoring and alerting (Shovel lag, DB size)
- [x] Documentation site
