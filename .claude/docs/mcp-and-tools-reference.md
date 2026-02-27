# MCP Servers & Tools Reference — Stevens Blockchain

> **How MCPs work:** You do NOT download them. You declare them in config and they get pulled via `npx` on demand. Claude agents see them automatically when configured.

---

## Blockchain / Web3 MCP Servers

| MCP Server | What It Does | Install |
|---|---|---|
| **evm-mcp** (JamesANZ) | Connects Claude directly to local Erigon node via JSON-RPC. Query blocks, traces, transactions from editor | `claude mcp add-json "evm-mcp" '{"command":"npx","args":["@jamesanz/evm-mcp"],"env":{"RPC_URL":"http://127.0.0.1:8545"}}'` |
| **Etherscan MCP** | Fetch verified contract ABIs, source code, balances, tx history across 60+ chains | [github.com/crazyrabbitLTC/mcp-etherscan-server](https://github.com/crazyrabbitLTC/mcp-etherscan-server) |
| **Chainstack RPC MCP** | Polished EVM RPC interface — `eth_call`, trace, gas analysis, event logs | [github.com/chainstacklabs/rpc-nodes-mcp](https://github.com/chainstacklabs/rpc-nodes-mcp) |
| **mcp-abi** | Decode/encode smart contract function calls and event logs from raw data | [lobehub.com/mcp/iqaicom-mcp-abi](https://lobehub.com/mcp/iqaicom-mcp-abi) |
| **Tatum Blockchain MCP** | Access blockchain data APIs across 130+ networks | `claude mcp add-json "tatum" '{"command":"npx","args":["@tatumio/blockchain-mcp"],"env":{"TATUM_API_KEY":"YOUR_KEY"}}'` |
| **Moralis Web3 MCP** | NFT data, token info, wallet analytics, DeFi positions | [github.com/a6b8/moralis-mcp](https://github.com/a6b8/moralis-mcp) |
| **thirdweb MCP** | Read/write to 2000+ blockchains, contract analysis/deployment | [mcpservers.org/servers/thirdweb-dev/thirdweb-mcp](https://mcpservers.org/servers/thirdweb-dev/thirdweb-mcp) |

---

## Database MCP Servers (For Storing Extracted Data)

| MCP Server | Best For | Install |
|---|---|---|
| **postgres-mcp** (CrystalDBA) | General-purpose. The safe default for blockchain data. Full schema introspection, natural language SQL | `claude mcp add-json "postgres" '{"command":"npx","args":["-y","@crystaldba/postgres-mcp"],"env":{"DATABASE_URL":"postgresql://ethnode:password@localhost:5432/ethnode"}}'` |
| **ClickHouse MCP** | Heavy analytics over terabytes of chain data (used by Dune) | `claude mcp add-json "clickhouse" '{"command":"npx","args":["-y","@clickhouse/mcp-clickhouse"]}'` |
| **Supabase MCP** | PostgreSQL + auth + real-time + API layer in one | [supabase.com/docs/guides/getting-started/mcp](https://supabase.com/docs/guides/getting-started/mcp) |
| **DuckDB Visualization MCP** | Ad-hoc analysis of Parquet/CSV files with Plotly charts | [lobehub.com/mcp/xoniks-mcp-visualization-duckdb](https://lobehub.com/mcp/xoniks-mcp-visualization-duckdb) |

---

## Data Visualization MCP Servers

| MCP Server | What It Does | Install |
|---|---|---|
| **@antv/mcp-server-chart** | 26+ chart types: area, bar, heatmap, radar, flow diagrams | `claude mcp add-json "charts" '{"command":"npx","args":["-y","@antv/mcp-server-chart"]}'` |
| **Apache ECharts MCP** | Bar, line, pie, scatter, funnel, tree, sunburst charts | `claude mcp add-json "echarts" '{"command":"npx","args":["-y","mcp-echarts"]}'` |
| **QuickChart MCP** | Chart.js charts, QR codes, barcodes, word clouds | [github.com/GongRzhe/Quickchart-MCP-Server](https://github.com/GongRzhe/Quickchart-MCP-Server) |
| **Chart.js MCP** | Generate Chart.js charts for embedding in React/Next.js | `npm: @ax-crew/chartjs-mcp-server` |

---

## Frontend / Web Design MCP Servers

| MCP Server | What It Does | Install |
|---|---|---|
| **Figma MCP** (Official) | Convert Figma designs to React + Tailwind code | [figma.com/blog/introducing-figma-mcp-server](https://www.figma.com/blog/introducing-figma-mcp-server/) |
| **shadcn/ui MCP** | Browse, search, install shadcn components directly | Built into `shadcn` CLI 3.0+ |
| **Next.js Tailwind Assistant** | Next.js 15+ docs, Tailwind patterns, production templates | `claude mcp add-json "nextjs-tailwind" '{"command":"npx","args":["-y","nextjs-react-tailwind-assistant"]}'` |
| **Next.js Dev Tools MCP** | Real-time errors from dev server into Claude | Built into Next.js 16+ at `/_next/mcp` |
| **Tailwind CSS MCP** | TailwindCSS utilities, docs, conversion tools | `npm install -g tailwindcss-mcp-server` |
| **FlyonUI MCP** | Craft Tailwind components/blocks/pages for React, Vue, Svelte | [flyonui.com/mcp](https://flyonui.com/mcp) |

---

## Developer Tooling MCP Servers

| MCP Server | Why You Need It | Install |
|---|---|---|
| **Context7** | Fetches latest docs for any library (viem, ethers, React, Tailwind). Prevents hallucination | `claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp` |
| **Playwright MCP** | Automated browser testing for your dashboard frontend | [github.com/microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) |
| **Docker MCP** | Manage Erigon, PostgreSQL, services from Claude | [docker.com/blog/mcp-toolkit-mcp-servers-that-just-work](https://www.docker.com/blog/mcp-toolkit-mcp-servers-that-just-work/) |
| **GitHub MCP** (Official) | Issues, PRs, repo management, code search | `claude mcp add github -e GITHUB_PERSONAL_ACCESS_TOKEN=YOUR_PAT -- docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server` |
| **Sequential Thinking MCP** | Structured multi-step reasoning for complex analysis | [pulsemcp.com/servers/anthropic-sequential-thinking](https://www.pulsemcp.com/servers/anthropic-sequential-thinking) |
| **Fetch MCP** | Fetch web content and convert to markdown for analysis | [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) |

---

## MCP Discovery & Registries

For finding more MCP servers:
- [Official MCP Registry](https://registry.modelcontextprotocol.io/)
- [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) — largest curated list
- [awesome-web3-mcp-servers](https://github.com/demcp/awesome-web3-mcp-servers) — web3-specific
- [mcp-awesome.com](https://mcp-awesome.com) — 1200+ servers, searchable
- [mcpservers.org](https://mcpservers.org/) — searchable by category
- [Smithery](https://smithery.ai/) — MCP server registry and discovery

---

## Erigon-Specific Companion Tools (Not MCP)

| Tool | Purpose |
|---|---|
| **TrueBlocks** | Local address-level index from Erigon's `trace_` API. Makes per-address queries fast. **Best companion for Erigon** |
| **Otterscan** | Instant local block explorer built specifically for Erigon (React + ethers.js + Tailwind) |
| **Cryo** (Paradigm) | Bulk historical extraction to Parquet. **Already in use in this project** |
| **Shovel** (indexsupply) | Real-time declarative indexing → PostgreSQL. **Already in use in this project** |
| **ethereum-etl-postgres** | Bulk extract full Ethereum history into PostgreSQL |
| **E2PG** | Lightweight Go indexer — Erigon blocks/txs/logs → PostgreSQL rows |

---

## Erigon RPC Namespaces (Available APIs)

Enable with `--http.api=eth,debug,trace,web3,net,txpool,ots`

| Namespace | Purpose |
|---|---|
| `eth` | Standard JSON-RPC (blocks, txs, balances, logs, receipts) |
| `debug` | `debug_traceTransaction`, `debug_traceCall`, `debug_traceCallMany` |
| `trace` | `trace_transaction`, `trace_block`, `trace_filter`, `trace_call` — **key for data extraction** |
| `erigon` | Erigon-specific extensions (`erigon_getHeaderByNumber`) |
| `ots` | Otterscan methods for efficient block explorer queries |
| `txpool` | Transaction pool inspection |
| `net` / `web3` / `admin` | Network info, client version, node admin |

### Trace Modes
- **trace** — Transaction-level call trace (CREATEs, SUICIDEs, CALLs with input/output/gas/value)
- **vmTrace** — Full VM execution trace
- **stateDiff** — All altered Ethereum state from the transaction

---

## Recommended TypeScript Library: viem

```typescript
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http('http://127.0.0.1:8545'), // local Erigon
});

// Extend for Erigon-specific methods
const erigonClient = client.extend((client) => ({
  async traceTransaction(txHash: string) {
    return client.request({ method: 'trace_transaction' as any, params: [txHash] });
  },
  async traceBlock(blockNumber: string) {
    return client.request({ method: 'trace_block' as any, params: [blockNumber] });
  },
  async traceFilter(params: any) {
    return client.request({ method: 'trace_filter' as any, params: [params] });
  },
}));
```

---

## Recommended Architecture

```
Erigon Node (archive, trace enabled) @ 127.0.0.1:8545
    │
    ├──→ evm-mcp (Claude queries chain directly)
    │
    ├──→ Cryo (bulk historical → Parquet)
    │         └──→ DuckDB → PostgreSQL
    │
    ├──→ Shovel (real-time indexing → PostgreSQL)
    │
    └──→ TrueBlocks (address-level indexing)
              │
              ▼
         PostgreSQL (ethnode) @ localhost:5432
              │
              ▼
         FastAPI @ :8000
              │
              ▼
         React + Vite @ :5173
         (Tailwind + Recharts/D3)
```

---

## Priority MCP Install Order

1. **evm-mcp** — talk to Erigon directly
2. **postgres-mcp** — manage your ethnode database
3. **Context7** — always up-to-date docs for viem, React, etc.
4. **@antv/mcp-server-chart** — visualize blockchain data
5. **shadcn/ui MCP** or **Figma MCP** — quick UI scaffolding

---

## Database Recommendations

| Database | When To Use |
|---|---|
| **PostgreSQL** (current) | General-purpose, works with Shovel/Cryo pipeline. Start here |
| **TimescaleDB** | Add as PostgreSQL extension when you need time-series analytics |
| **ClickHouse** | When analytical queries over full chain history become too slow on PostgreSQL |
