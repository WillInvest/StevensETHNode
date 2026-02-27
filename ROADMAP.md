# Stevens Blockchain Analytics — Roadmap

## Phase 0: Project Setup
- [x] Git repo, CLAUDE.md, project structure
- [x] Tool installation (Cryo, Shovel, DuckDB)
- [x] Python + Node.js dependency setup

## Phase 1: MVP — Indexing + Web Viewer ← CURRENT
- [x] Shovel config for Uniswap V3 Swap events
- [x] Cryo backfill scripts for historical data
- [x] DuckDB → PostgreSQL loader
- [x] FastAPI backend (table list, paginated browse)
- [x] React frontend (Home dashboard, table browser)
- [ ] End-to-end test: Cryo → DB → API → Browser

## Phase 2: Multi-Protocol Indexing
- [ ] Aave V3 (Supply, Borrow, Repay, Liquidation events)
- [ ] Compound V3 (Supply, Withdraw, Absorb events)
- [ ] Curve (TokenExchange, AddLiquidity events)
- [ ] Lido (Submitted, TransferShares events)
- [ ] ERC-20 Transfer events (major tokens: WETH, USDC, USDT, DAI)
- [ ] Major bridge events (Arbitrum, Optimism, Base)

## Phase 3: Research Platform
- [ ] SQL editor with CodeMirror (run ad-hoc queries)
- [ ] Query result visualization (charts, time series)
- [ ] Statistical analysis integration (pandas, scipy)
- [ ] CSV/JSON export from any query or table view
- [ ] Saved queries library

## Phase 4: Stevens Crypto Index (SCI)
- [ ] Define SCI methodology (composite 0–100 score)
- [ ] Components: protocol TVL utilization, DEX volumes, lending rates, liquidations, gas prices, network health
- [ ] Historical SCI calculation engine
- [ ] Real-time SCI updates
- [ ] SCI dashboard with breakdown charts
- [ ] Academic paper / methodology documentation

## Phase 5: Polish & Deploy
- [ ] Tailwind CSS + shadcn/ui design system
- [ ] Team authentication (SSO or simple auth)
- [ ] nginx reverse proxy + systemd services
- [ ] Monitoring and alerting (Shovel lag, DB size)
- [ ] Documentation site
