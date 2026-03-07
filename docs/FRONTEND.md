# Frontend Architecture

**Last Updated:** 2026-03-06

The Stevens Blockchain Analytics frontend is a database explorer built with React 18 and Vite, featuring a cyber-themed interface for browsing blockchain data tables, executing SQL queries, and exploring DeFi protocol activity.

## Stack

- **React 18** — Component framework
- **Vite 5** — Build tool (dev server, production bundling)
- **React Router 6** — Client-side routing
- **Tailwind CSS 4** — Utility-first styling
- **Recharts** — Data visualization charts
- **CodeMirror 6** — SQL syntax highlighting and editing
- **TanStack React Table** — Advanced data tables

## Directory Structure

```
web/frontend/src/
├── components/             # Reusable UI components
│   ├── explore/            # Protocol explorer components
│   │   ├── SidebarTree.jsx
│   │   ├── PoolSearchInput.jsx
│   │   └── PoolGroup.jsx
│   └── TxHashLink.jsx      # Etherscan link component
├── pages/                  # Page-level components
│   ├── explore/            # Protocol explorer pages
│   │   ├── ExploreHome.jsx
│   │   ├── PoolView.jsx
│   │   └── tabs/
│   ├── Home.jsx
│   ├── Browse.jsx
│   ├── Data.jsx
│   ├── Query.jsx
│   ├── SCI.jsx
│   ├── FearIndex.jsx
│   ├── Mempool.jsx
│   ├── EthDistribution.jsx
│   ├── Extraction.jsx
│   ├── Monitoring.jsx
│   ├── StressTest.jsx
│   └── Login.jsx
├── layouts/                # Layout components
│   └── ExploreLayout.jsx   # Sidebar layout for explore
├── hooks/                  # Custom React hooks
│   ├── usePoolList.js      # Fetch pools for protocol/version
│   ├── usePoolDetail.js    # Fetch pool detail data
│   ├── useSidebarState.js  # Sidebar/search/group persistence
│   └── others
├── utils/                  # Pure utility functions
│   ├── poolFilters.js      # Pool filtering and fee utilities
│   ├── poolGrouping.js     # Pool grouping logic
│   ├── etherscan.js        # Etherscan link generation
│   └── others
├── config/                 # Configuration
│   └── protocolRegistry.js # Available protocols
├── lib/                    # Library utilities
├── index.css               # Global styles and theme
├── App.jsx                 # Root component
├── Layout.jsx              # Main app layout
└── main.jsx                # React entry point
```

## Pages Overview

### Core Database Explorer Pages

| Page | Path | Purpose |
|------|------|---------|
| **Explore** | `/explore` | Protocol explorer with sidebar navigation, pool search, and multi-tab interface (Swaps, Liquidity, Stats, Query) — the primary interface for exploring blockchain data |
| **Browse** | `/browse/:schema/:table` | Paginated table browser for browsing raw blockchain data tables with sort and filter |
| **Query** | `/query` | Custom SQL editor (CodeMirror) for ad-hoc queries against the blockchain database |
| **Data** | `/data` | Advanced data explorer with filtering and search |
| **Home** | `/` | Database overview with table statistics and metadata |

### Legacy / Secondary Pages

| Page | Path | Purpose |
|------|------|---------|
| **SCI** | `/sci` | Stevens Crypto Index tracking and history |
| **Fear Index** | `/fear-index` | Market sentiment analysis |
| **Mempool** | `/mempool` | Ethereum mempool monitoring |
| **Eth Distribution** | `/eth-distribution` | Staking and validator analysis |
| **Extraction** | `/extraction` | Cryo job management and monitoring |
| **Monitoring** | `/monitoring` | System health and database status |
| **Stress Test** | `/stress-test` | System performance testing |

## Key Components

### Explore Section — Primary Database Explorer

The `/explore` route provides the primary interface for exploring blockchain data through a protocol-specific lens.

**Layout**: `ExploreLayout.jsx`
- Sidebar with protocol/version tree navigation
- Main content area with tabs (Pools, Liquidity, Swaps, Stats, Query)
- Responsive grid layout with collapsible sidebar

**Sidebar Components**:
- `SidebarTree.jsx` — Protocol hierarchy with pool search and grouping
- `PoolSearchInput.jsx` — Real-time pool search with clear button
- `PoolGroup.jsx` — Collapsible pool group with fee tier sub-items

**Pool Data Hooks**:
- `usePoolList()` — Fetches pools for protocol/version from `/api/explore/pools/{protocol}/{version}`
- `usePoolDetail()` — Fetches detailed pool data including swaps, liquidity, TVL

**Pool Tabs**:
- `StatsTab.jsx` — Pool statistics (TVL, volume, fees)
- `SwapsTab.jsx` — Recent swap transactions with links
- `LiquidityTab.jsx` — LP positions and historical changes
- `QueryTab.jsx` — Custom queries on pool data

### Transaction Links

`TxHashLink.jsx` component renders clickable transaction hashes with Etherscan integration.

**Features**:
- Detects transaction hashes (66-char 0x-prefixed hex)
- Generates Etherscan URLs for mainnet
- Styled with cyber theme cyan accent
- Hover effects with glow

**Usage**:
```jsx
import TxHashLink from '../components/TxHashLink'

<TxHashLink hash="0x..." />
```

## Utilities

### Pool Filtering (`poolFilters.js`)

Pure functions for pool search, filtering, and fee parsing.

```javascript
import {
  filterPoolsByQuery,
  formatFeeTier,
  parseFeeTier,
  normalizePairName
} from './utils/poolFilters.js'

// Filter pools by search query
const results = filterPoolsByQuery(pools, "USDC")

// Format fee tier (basis points → percentage)
formatFeeTier(500)   // "0.05%"
formatFeeTier(3000)  // "0.3%"

// Parse fee label
parseFeeTier("0.3%") // 3000

// Normalize pair names (ensures consistent ordering)
normalizePairName("USDC", "WETH") // "USDC/WETH"
normalizePairName("WETH", "USDC") // "USDC/WETH" (same!)
```

**Search Fields**: `display_name`, `token0_symbol`, `token1_symbol`, `fee_label`, `pool_address`

### Pool Grouping (`poolGrouping.js`)

Group pools by trading pair with sorting.

```javascript
import { groupPoolsByPair } from './utils/poolGrouping.js'

const groups = groupPoolsByPair(pools)
// Returns:
// [
//   {
//     pairName: "USDC/WETH",
//     pools: [{ fee_label: "0.05%", ... }, { fee_label: "0.3%", ... }]
//   },
//   ...
// ]
```

**Features**:
- Token symbol normalization (USDC-WETH = WETH-USDC)
- Pools sorted by fee tier (ascending)
- Groups sorted by activity (max swap count, descending)

### Etherscan Links (`etherscan.js`)

Generate Etherscan URLs for transactions and addresses.

```javascript
import {
  isTxHash,
  isAddress,
  getTxUrl,
  getAddressUrl,
  ETHERSCAN_BASE
} from './utils/etherscan.js'

// Validation
isTxHash("0x...")      // boolean
isAddress("0x...")     // boolean

// URL generation
getTxUrl("0x...")      // "https://etherscan.io/tx/0x..."
getAddressUrl("0x...")  // "https://etherscan.io/address/0x..."
```

## Styling & Theme

### CSS Variables

All colors and metrics use CSS variables for consistency. Defined in `src/index.css`.

**Core Palette**:
```css
--bg-primary: #0c0d14        /* Main background */
--bg-secondary: #111118      /* Secondary background */
--bg-card: #14151f           /* Card background */
--bg-input: #161720          /* Input background */

--text-primary: #f0f0f5       /* Main text */
--text-secondary: #a0a0b0    /* Secondary text */
--text-muted: #4d4d6a        /* Muted text */
--text-accent: #a5b4fc       /* Accent text */
```

**Cyber Theme** (Neon/Glow):
```css
--cyber-cyan: #00ffff        /* Bright cyan */
--cyber-green: #00ff00       /* Bright green */
--cyber-magenta: #ff00ff     /* Bright magenta */
--cyber-blue: #0099ff        /* Bright blue */
```

**Accent Colors**:
```css
--accent: #6366f1            /* Primary accent (indigo) */
--green: #26d39f             /* Success green */
--red: #ff6644               /* Error red */
--amber: #fbbf24             /* Warning amber */
--cyan: #22d3ee              /* Cyan */
```

**Sidebar** (Legacy):
```css
--sidebar-bg: #1a252f        /* Sidebar background */
--sidebar-border: rgba(..., 0.06)
--sidebar-text: #d4dce6      /* Sidebar text */
--sidebar-text-muted: #7a93a8
--sidebar-text-active: #ffffff
--sidebar-item-hover: rgba(52, 152, 219, 0.08)
--sidebar-item-active: rgba(52, 152, 219, 0.18)
```

### Tailwind Configuration

Extended colors in `tailwind.config.js`:

```javascript
colors: {
  bg: {
    primary: "var(--bg-primary)",
    secondary: "var(--bg-secondary)",
    card: "var(--bg-card)",
    input: "var(--bg-input)",
  },
  text: {
    primary: "var(--text-primary)",
    secondary: "var(--text-secondary)",
    muted: "var(--text-muted)",
    accent: "var(--text-accent)",
  },
  cyber: {
    cyan: "var(--cyber-cyan)",
    green: "var(--cyber-green)",
    magenta: "var(--cyber-magenta)",
    blue: "var(--cyber-blue)",
  },
  // ... more colors
}
```

**Usage in Components**:
```jsx
<div className="bg-bg-primary text-text-primary">
  <button className="text-cyber-cyan hover:text-cyber-green">
    Click me
  </button>
</div>
```

### Scanline Effects

Subtle scanline animations for cyber aesthetic (in `index.css`):
- Horizontal lines at regular intervals
- Opacity varies with animation
- Uses `opacity` and `mix-blend-mode` for overlay effect

## Custom Hooks

### `usePoolList(protocol, version)`

Fetches the list of pools for a given protocol and version.

```javascript
import { usePoolList } from '../hooks/usePoolList'

function MyComponent() {
  const { pools, loading, error } = usePoolList('uniswap', 'v3')

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {pools && pools.map(pool => (...))}
    </div>
  )
}
```

### `usePoolDetail(poolId)`

Fetches detailed information about a specific pool.

```javascript
import { usePoolDetail } from '../hooks/usePoolDetail'

function PoolDetail({ poolId }) {
  const { data, loading, error } = usePoolDetail(poolId)

  return <div>{/* render detail */}</div>
}
```

### `useSidebarState(key)`

Persists sidebar state (search, grouping, expansion) to localStorage.

```javascript
import { useSidebarState } from '../hooks/useSidebarState'

function SidebarComponent() {
  const [search, setSearch] = useSidebarState('search', '')
  const [groups, setGroups] = useSidebarState('groups', {})

  // State automatically persists to localStorage
  // and restores on page reload
}
```

## Development Commands

```bash
cd web/frontend

# Start development server (Vite)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run tests (if configured)
npm test
```

## Performance

- **Page Load**: ~2-3 seconds (depends on pool count)
- **Pool Filter**: <1ms (pure function)
- **Pool Group**: <2ms (pure function)
- **Sidebar Update**: <10ms
- **localStorage**: <5ms for search/group state
- **60fps Interactions**: Smooth scrolling and animations

## Testing

Located in `/src/utils/__tests__/`:

- `poolFilters.test.js` — 19 unit tests for filtering and fee utilities
- `poolGrouping.test.js` — 9 unit tests for grouping logic

Run tests:
```bash
npm test
```

**Coverage**: 100% of utility functions

## Browser Support

- Chrome/Chromium (modern)
- Firefox (modern)
- Safari (modern)
- Edge (modern)

**Requirements**:
- localStorage API
- CSS variables (custom properties)
- React 18+ hooks
- ES6+ JavaScript

## Related Documentation

- [docs/api-reference.md](./api-reference.md) — Backend API endpoints
- [docs/architecture.md](./architecture.md) — System design
- [CLAUDE.md](../CLAUDE.md) — Project overview and setup
