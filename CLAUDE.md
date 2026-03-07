# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview - Stevens Blockchain Analytics

## Servers
| Role | Host | Managed by |
|------|------|------------|
| Frontend | this machine (`stevensbc`, `10.246.103.151`) | FastAPI `:8000` + Vite `:5173` |
| Node | `hfu11@10.246.103.160` | Erigon + PostgreSQL + Shovel |

SSH: `ssh hfu11@10.246.103.160` (key auth configured)

## Stack
- **Erigon V3** — archive node on node server, tunneled to `http://127.0.0.1:8545`
- **PostgreSQL 14** — `ethnode` db on node server, tunneled to `localhost:15432`
- **Shovel** (indexsupply) — real-time EVM indexing → PostgreSQL (node server)
- **Cryo** (Paradigm/Rust) — bulk historical extraction → Parquet → PostgreSQL (node server)
- **FastAPI** — backend API (this server)
- **React + Vite** — frontend (this server)

## Database
```bash
ETHNODE_DATABASE_URL=postgres://ethnode:ethnode@localhost:15432/ethnode

# Restart tunnel if dropped:
ssh -N -f -L 15432:localhost:5432 -L 8545:localhost:8545 -L 8546:localhost:8546 hfu11@10.246.103.160
```
25 tables: Uniswap V3 (mints/burns/snapshots), Aave V3, Compound V3, Curve, Lido,
ERC20 transfers, Hyperliquid, Arbitrum/Base/OP bridge events, saved queries, `_users`

## Start Services (this server)
```bash
ETHNODE_DATABASE_URL=postgres://ethnode:ethnode@localhost:15432/ethnode \
  uvicorn web.app:app --host 0.0.0.0 --port 8000 --reload

cd web/frontend && npm run dev
```

## Key Paths — This Server
| Path | Purpose |
|------|---------|
| `web/app.py` | FastAPI entry point (13 routers + WebSocket) |
| `web/routers/` | All API routers incl. `explore.py`, `fear_index.py` |
| `web/services/pool_resolver.py` | 3-tier pool metadata cache (memory → DB → RPC) |
| `web/services/token_symbols.py` | Known token symbols + fee labels |
| `web/frontend/src/` | React source — 11 pages + Explore section |
| `web/frontend/src/layouts/ExploreLayout.jsx` | Sidebar layout for protocol explorer |
| `web/frontend/src/components/explore/` | SidebarTree and explore components |
| `backend/app/services/` | CFI computation pipeline |
| `scripts/db_status.py` | Pool metadata CLI |
| `deploy/` | nginx config, systemd service files |
| `migrations/` | SQL migrations (run via psql against tunnel) |

## Key Paths — Node Server
| Path | Purpose |
|------|---------|
| `~/stevens-blockchain/shovel/config.json` | Shovel indexer config (add protocols here) |
| `~/stevens-blockchain/indexing/` | Cryo extraction scripts |
| `~/stevens-blockchain/protocols-live-state/` | On-chain extractors (Uniswap V3, Aave V3…) |
| `~/stevens-blockchain/data/` | Raw Parquet files from Cryo |
| `~/stevens-blockchain/scripts/backfill.sh` | Cryo backfill commands |
| `~/stevens-blockchain/scripts/load_parquet.sh` | DuckDB Parquet → PostgreSQL |
| `~/stevens-blockchain/scripts/start-node.sh` | Starts Erigon |

## Adding a New Protocol
1. SSH to node server
2. Add entry to `~/stevens-blockchain/shovel/config.json`
3. Restart Shovel — it auto-creates the table and begins indexing
4. For historical data: add Cryo commands to `scripts/backfill.sh`
5. Add to `_ACTIVE_VERSIONS` in `web/routers/explore.py` when ready to expose via API

## Node Server Commands
```bash
ssh hfu11@10.246.103.160 "cd ~/stevens-blockchain && <command>"

# Check Erigon block height
curl -s -X POST http://127.0.0.1:8545 -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Environment Variables
```bash
ETHNODE_DATABASE_URL=postgres://ethnode:ethnode@localhost:15432/ethnode  # required
ERIGON_RPC_URL=http://127.0.0.1:8545                                     # optional, this is the default
MINIMAX_API_KEY=                                                          # optional, AI pipeline
```



## Running Tests

```bash
# Run all tests
node tests/run-all.js

# Run individual test files
node tests/lib/utils.test.js
node tests/lib/package-manager.test.js
node tests/hooks/hooks.test.js
```

## Architecture

The project is organized into several core components:

- **agents/** - Specialized subagents for delegation (planner, code-reviewer, tdd-guide, etc.)
- **skills/** - Workflow definitions and domain knowledge (coding standards, patterns, testing)
- **commands/** - Slash commands invoked by users (/tdd, /plan, /e2e, etc.)
- **hooks/** - Trigger-based automations (session persistence, pre/post-tool hooks)
- **rules/** - Always-follow guidelines (security, coding style, testing requirements)
- **mcp-configs/** - MCP server configurations for external integrations
- **scripts/** - Cross-platform Node.js utilities for hooks and setup
- **tests/** - Test suite for scripts and utilities

## Key Commands

- `/tdd` - Test-driven development workflow
- `/plan` - Implementation planning
- `/e2e` - Generate and run E2E tests
- `/code-review` - Quality review
- `/build-fix` - Fix build errors
- `/learn` - Extract patterns from sessions
- `/skill-create` - Generate skills from git history

## Dispatch Strategy: Context Efficiency

| Command           | Agent                  | Model  | Purpose                  |
|-------------------|------------------------|--------|--------------------------|
| /plan             | planner                | Opus   | Implementation planning  |
| /tdd              | tdd-guide              | Sonnet | Test-driven development  |
| /e2e              | e2e-runner             | Sonnet | End-to-end testing       |
| /code-review      | code-reviewer          | Sonnet | Code quality review      |
| /security-review  | security-reviewer      | Opus   | Security auditing        |
| /architect        | architect              | Opus   | System design            |
| /build-fix        | build-error-resolver   | Haiku  | Build error fixes        |
| /refactor-clean   | refactor-cleaner       | Sonnet | Dead code removal        |
| /update-docs      | doc-updater            | Haiku  | Documentation sync       |
| /go-build         | go-build-resolver      | Haiku  | Go build fixes           |
| /go-review        | go-reviewer            | Sonnet | Go code review           |
| /python-review    | python-reviewer        | Sonnet | Python code review       |

## Development Notes

- Package manager detection: npm, pnpm, yarn, bun (configurable via `CLAUDE_PACKAGE_MANAGER` env var or project config)
- Cross-platform: Windows, macOS, Linux support via Node.js scripts
- Agent format: Markdown with YAML frontmatter (name, description, tools, model)
- Skill format: Markdown with clear sections for when to use, how it works, examples
- Hook format: JSON with matcher conditions and command/notification hooks

## Contributing

Follow the formats in CONTRIBUTING.md:
- Agents: Markdown with frontmatter (name, description, tools, model)
- Skills: Clear sections (When to Use, How It Works, Examples)
- Commands: Markdown with description frontmatter
- Hooks: JSON with matcher and hooks array

File naming: lowercase with hyphens (e.g., `python-reviewer.md`, `tdd-workflow.md`)
