# Plan: Hierarchical Protocol Navigation System

Saved: 2026-03-05
Project: /home/stevensbc/stevens-blockchain
Session context: Refactor the Stevens Blockchain Analytics frontend to support a left-sidebar hierarchical navigation (Category → Protocol → Version → Pair) starting with Uniswap V3, extensible to future protocols.

---

## Requirements

- Left sidebar with drill-down: Category → Protocol → Version → Pair (token pair)
- Currently active: Uniswap V3 (Decentralized Exchange)
- Future protocols: Curve, Aave V3, Compound V3, Hyperliquid, bridges
- Selecting a pair shows a tabbed detail view: Swaps | Liquidity | Stats | Query
- Theme: Stevens Hanlon Lab aesthetic — dark navy/charcoal (`#2c3e50`, `#1a252f`), white text, clean institutional look (NOT Uniswap pink, NOT generic indigo)

---

## Navigation Hierarchy

```
▼ Decentralized Exchange
    ▼ Uniswap
        ▼ V3                          ← active
            WETH/USDC 0.30%           ← user selects this
            USDC/USDT 0.05%
            WBTC/WETH 0.30%
        V2  (coming soon)
        V4  (coming soon)
    Curve  (coming soon)
▶ Decentralized Lending
    Aave V3  (coming soon)
    Compound V3  (coming soon)
```

---

## URL Scheme

```
/explore                                       → landing (category cards)
/explore/dex                                   → DEX overview
/explore/dex/uniswap                           → Uniswap overview
/explore/dex/uniswap/v3                        → pool list
/explore/dex/uniswap/v3/:poolAddress           → pair view (Swaps tab)
/explore/dex/uniswap/v3/:poolAddress?tab=liquidity
/explore/dex/uniswap/v3/:poolAddress?tab=stats
/explore/dex/uniswap/v3/:poolAddress?tab=query
```

Existing routes (`/data`, `/query`, `/browse/:schema/:table`) remain unchanged under the old `Layout`.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| URL structure | Path-based with pool address | Canonical, no ambiguity, easy active-state highlighting |
| Sidebar behavior | Tree with independent expansion, state in localStorage | Users compare across protocols; accordion forces re-opening |
| Protocol registry | Static `protocolRegistry.js` config + dynamic pool lists from API | Hierarchy is a product decision; pool lists come from DB |
| Pool resolution | 3-tier: in-memory dict → PostgreSQL `pool_metadata` table → Erigon RPC | RPC is too slow (150ms/pool) for a sidebar with 20-50 pools |
| Layout | New `ExploreLayout` for `/explore/*`; existing `Layout` unchanged | Zero regression risk on legacy pages |
| Main content | Tab bar (Swaps, Liquidity, Stats, Query) via `?tab=` search param | Keeps pool address in URL path while allowing tab switching |
| Theme | Stevens Hanlon Lab dark navy: `#2c3e50` primary, `#1a252f` hover | Matches university brand; professional, institutional aesthetic |

---

## Backend: New Files

| File | Purpose | Complexity |
|------|---------|------------|
| `web/services/token_symbols.py` | Shared TOKEN_SYMBOLS dict + FEE_LABELS (extracted from db_status.py) | LOW |
| `web/services/pool_resolver.py` | Async pool metadata resolution — 3-tier cache (memory, DB, RPC) | HIGH |
| `web/routers/explore.py` | 5 new FastAPI endpoints (registry, pools, pool detail, events, stats) | HIGH |
| `migrations/001_pool_metadata.sql` | Create `uniswap_v3.pool_metadata` table | LOW |

### New API Endpoints

```
GET /api/explore/registry                                  → static protocol hierarchy
GET /api/explore/pools/:protocol/:version                  → pool list with resolved names
GET /api/explore/pool/:protocol/:version/:address          → pool detail + summary stats
GET /api/explore/pool/:protocol/:version/:address/events   → paginated events (swaps/mints/burns)
GET /api/explore/pool/:protocol/:version/:address/stats    → aggregate charts data
```

### Modified Backend Files

| File | Change | Complexity |
|------|--------|------------|
| `web/app.py` | Register `explore` router | LOW |

---

## Frontend: New Files

### Config
| File | Purpose | Complexity |
|------|---------|------------|
| `src/config/protocolRegistry.js` | Static protocol hierarchy config (categories, protocols, versions, tabs) | LOW |

### Layouts & Sidebar
| File | Purpose | Complexity |
|------|---------|------------|
| `src/layouts/ExploreLayout.jsx` | Sidebar + content area, slim top bar | MEDIUM |
| `src/components/explore/ExploreSidebar.jsx` | Main sidebar container | MEDIUM |
| `src/components/explore/SidebarTree.jsx` | Recursive tree renderer | MEDIUM |
| `src/components/explore/CategoryNode.jsx` | Category expand/collapse | LOW |
| `src/components/explore/ProtocolNode.jsx` | Protocol expand/collapse | LOW |
| `src/components/explore/VersionNode.jsx` | Version level, triggers pool fetch | MEDIUM |
| `src/components/explore/PoolNode.jsx` | Pool leaf node (NavLink) | LOW |

### Pages
| File | Purpose | Complexity |
|------|---------|------------|
| `src/pages/explore/ExploreHome.jsx` | Category cards landing | LOW |
| `src/pages/explore/CategoryOverview.jsx` | Protocol cards within category | LOW |
| `src/pages/explore/VersionPoolList.jsx` | Full pool list with search/filter | MEDIUM |
| `src/pages/explore/PoolView.jsx` | Main pair view with tab bar | HIGH |
| `src/pages/explore/tabs/SwapsTab.jsx` | Paginated swap events | MEDIUM |
| `src/pages/explore/tabs/LiquidityTab.jsx` | Mints/burns + net liquidity chart | HIGH |
| `src/pages/explore/tabs/StatsTab.jsx` | Aggregate charts (volume, fees) | HIGH |
| `src/pages/explore/tabs/QueryTab.jsx` | Scoped SQL editor (pool pre-filled) | MEDIUM |

### Hooks
| File | Purpose | Complexity |
|------|---------|------------|
| `src/hooks/usePoolList.js` | Fetch + cache pool list for a version | LOW |
| `src/hooks/usePoolDetail.js` | Fetch single pool metadata | LOW |
| `src/hooks/useSidebarState.js` | Expand/collapse state + localStorage | LOW |

### Modified Frontend Files

| File | Change | Complexity |
|------|--------|------------|
| `src/App.jsx` | Add `/explore/*` routes under ExploreLayout; redirect `/` to `/explore` | MEDIUM |
| `src/index.css` | Swap accent to Stevens navy palette; add sidebar tree styles | MEDIUM |

---

## Pool Metadata Table (PostgreSQL)

```sql
CREATE TABLE uniswap_v3.pool_metadata (
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
```

---

## Implementation Phases

### Phase 1: Backend + Pool Resolution (3–4 days)
1. Create `migrations/001_pool_metadata.sql` → run on node server
2. Extract `TOKEN_SYMBOLS`, `FEE_LABELS` → `web/services/token_symbols.py`
3. Build `web/services/pool_resolver.py` (async httpx RPC, 3-tier cache)
4. Build `web/routers/explore.py` (5 endpoints)
5. Register router in `web/app.py`
6. Verify: `curl /api/explore/pools/uniswap/v3` returns human-readable pool names

### Phase 2: Sidebar + Layout (2–3 days)
1. Create `src/config/protocolRegistry.js`
2. Build `ExploreLayout.jsx` (slim top bar + sidebar + content area)
3. Build all sidebar tree components
4. Build `useSidebarState`, `usePoolList` hooks
5. Add `/explore/*` routes to `App.jsx`
6. Apply Stevens navy theme to `index.css`

### Phase 3: Pool View + Tabs (3–4 days)
1. Build `PoolView.jsx` with pool header + tab bar
2. Build `SwapsTab.jsx`, `LiquidityTab.jsx`, `StatsTab.jsx`, `QueryTab.jsx`
3. Add `/events` and `/stats` endpoints to explore router

### Phase 4: Polish + Intermediate Pages (1–2 days)
1. `ExploreHome.jsx` (category cards with event counts)
2. `CategoryOverview.jsx`, `VersionPoolList.jsx`
3. Breadcrumb navigation in top bar
4. "Coming soon" badges for future protocols
5. Responsive: sidebar auto-collapses on narrow screens

---

## Key Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| RPC latency resolving 30+ pools | HIGH | Pre-populate `pool_metadata` table at startup; subsequent loads use DB cache |
| Large pool lists overwhelming sidebar | MEDIUM | Show top 20 by swap count in sidebar; full list on VersionPoolList page |
| Layout regression on existing pages | MEDIUM | `ExploreLayout` is separate from `Layout`; zero shared code |
| Future protocol data shape differences | MEDIUM | Tab set is configurable per protocol version in `protocolRegistry.js` |

---

## Modifications from original

- **Theme changed**: Original plan proposed Uniswap pink (`#FF007A`) or existing indigo (`#6366f1`). Modified to use **Stevens Hanlon Lab dark navy palette** — `#2c3e50` (primary), `#1a252f` (hover/darker), white text — matching the Stevens Institute of Technology brand aesthetic from https://fsc.stevens.edu/hanlon-lab-i/

---

## Next Steps
1. Review this plan
2. `/compact` ← clear planning context
3. `/tdd` ← start implementation using this plan
   Reference: `.claude/plans/hierarchical-protocol-nav.md`
