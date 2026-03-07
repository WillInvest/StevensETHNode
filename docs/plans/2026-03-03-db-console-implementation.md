# DB Console Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone database console frontend at `db-console/` that runs on `:5174`, letting users browse schemas/tables and run SQL queries against the existing FastAPI backend.

**Architecture:** React + Vite single-page app with two views (Explorer + Query). Sidebar shows schema tree with localStorage persistence. Backend is the existing FastAPI at `:8000` — we add CORS for the new port. No router library needed — view switching via React state.

**Tech Stack:** React 18, Vite, CodeMirror 6 (SQL), CSS custom properties (same theme as main dashboard)

**Design doc:** `docs/plans/2026-03-03-db-console-design.md`

**Gemini review incorporated:** Breadcrumb nav, debounced sidebar filter, localStorage sidebar state, skeleton loading, number formatting (`Intl.NumberFormat`), SQL history, CellRenderer split.

---

### Task 1: Add CORS for port 5174

**Files:**
- Modify: `web/app.py:67-72`

**Step 1: Add the new origin**

In `web/app.py`, update the CORS middleware `allow_origins` to include `http://localhost:5174`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Step 2: Verify**

Run: `curl -s -o /dev/null -w "%{http_code}" -H "Origin: http://localhost:5174" http://localhost:8000/api/health`
Expected: `200` with CORS headers

**Step 3: Commit**

```bash
git add web/app.py
git commit -m "feat: add CORS origin for db-console at :5174"
```

---

### Task 2: Scaffold Vite + React project

**Files:**
- Create: `db-console/package.json`
- Create: `db-console/vite.config.js`
- Create: `db-console/index.html`
- Create: `db-console/src/main.jsx`

**Step 1: Create `db-console/package.json`**

```json
{
  "name": "db-console",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "codemirror": "^6.0.2",
    "@codemirror/lang-sql": "^6.10.0",
    "@codemirror/state": "^6.5.4",
    "@codemirror/view": "^6.39.15",
    "@codemirror/theme-one-dark": "^6.1.3"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.4.1",
    "vite": "^5.4.21"
  }
}
```

**Step 2: Create `db-console/vite.config.js`**

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
```

**Step 3: Create `db-console/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DB Console — Stevens Blockchain</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Step 4: Create `db-console/src/main.jsx`**

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 5: Install dependencies and verify**

```bash
cd db-console && npm install
```

**Step 6: Commit**

```bash
git add db-console/package.json db-console/vite.config.js db-console/index.html db-console/src/main.jsx
git commit -m "feat: scaffold db-console Vite + React project"
```

---

### Task 3: Theme CSS

**Files:**
- Create: `db-console/src/index.css`

**Step 1: Create the CSS file**

Copy the full `:root` block and base styles from `web/frontend/src/index.css`. Include:
- All CSS custom properties (colors, fonts, spacing, shadows)
- Base reset (`*, *::before, *::after`)
- Body styles (dark background, font)
- Scrollbar styles
- Animations (`fadeIn`, `shimmer`, `pulse`)
- Utility classes: `.mono`, `.num`
- Data table styles (`.data-table thead th`, `.data-table tbody td`, etc.)

Add these DB-console-specific additions at the end:

```css
/* ═══════ DB Console Layout ═══════ */

.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  border-right: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

.main-content {
  flex: 1;
  overflow: auto;
  padding: 24px;
}

/* Data type colors for results */
.cell-string { color: #7ee787; }
.cell-number { color: #ffab70; }
.cell-boolean { color: var(--accent); }
.cell-null { color: var(--text-muted); font-style: italic; }
.cell-hex { color: #a5d6ff; }

/* Row hover: indigo left stripe instead of full background */
.data-table tbody tr {
  border-left: 2px solid transparent;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.data-table tbody tr:hover {
  border-left-color: var(--accent);
  background: rgba(99, 102, 241, 0.03);
}

/* Sticky header with glassmorphism */
.data-table thead th {
  position: sticky;
  top: 0;
  backdrop-filter: blur(8px);
  background: rgba(19, 19, 42, 0.85);
  z-index: 10;
}

/* Skeleton loading */
.skeleton-row {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
}
.skeleton-cell {
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg,
    rgba(255,255,255,0.04) 25%,
    rgba(255,255,255,0.08) 50%,
    rgba(255,255,255,0.04) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

/* Breadcrumb */
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 20px;
}
.breadcrumb span.active {
  color: var(--text-primary);
  font-weight: 600;
}
.breadcrumb .sep {
  color: var(--text-muted);
  font-size: 11px;
}

/* Sidebar table item */
.sidebar-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 12px 5px 28px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  border-left: 2px solid transparent;
}
.sidebar-item:hover {
  color: var(--text-primary);
  background: rgba(255,255,255,0.02);
}
.sidebar-item.selected {
  color: var(--text-accent);
  border-left-color: var(--accent);
  background: var(--accent-glow);
}
```

---

### Task 4: TopBar component

**Files:**
- Create: `db-console/src/components/TopBar.jsx`

**Step 1: Create the component**

```jsx
export default function TopBar({ view, onViewChange }) {
  return (
    <div style={{
      height: 48,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
      borderBottom: "1px solid var(--border-subtle)",
      background: "var(--bg-secondary)",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg, var(--accent), #818cf8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "#fff",
        }}>
          D
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>
          DB Console
        </span>
      </div>

      <div style={{
        display: "flex", gap: 2, background: "rgba(255,255,255,0.03)",
        borderRadius: "var(--radius-sm)", padding: 3,
        border: "1px solid var(--border-subtle)",
      }}>
        {["explorer", "query"].map(v => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            style={{
              padding: "5px 16px", border: "none", borderRadius: 6,
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              fontFamily: "var(--font-body)",
              background: view === v ? "var(--accent)" : "transparent",
              color: view === v ? "#fff" : "var(--text-secondary)",
              transition: "all var(--transition-fast)",
              boxShadow: view === v ? "0 2px 8px rgba(99,102,241,0.3)" : "none",
            }}
          >
            {v === "explorer" ? "Explorer" : "Query"}
          </button>
        ))}
      </div>

      <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>
        ethnode@localhost
      </span>
    </div>
  );
}
```

---

### Task 5: StatusBar component

**Files:**
- Create: `db-console/src/components/StatusBar.jsx`

**Step 1: Create the component**

```jsx
export default function StatusBar({ tableCount, totalRows, connected }) {
  return (
    <div style={{
      height: 28,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      borderTop: "1px solid var(--border-subtle)",
      background: "var(--bg-secondary)",
      fontSize: 11,
      color: "var(--text-muted)",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: connected ? "var(--green)" : "var(--red)",
          boxShadow: connected
            ? "0 0 6px rgba(52,211,153,0.5)"
            : "0 0 6px rgba(248,113,113,0.4)",
        }} />
        <span>{connected ? "Connected" : "Disconnected"}</span>
        {tableCount > 0 && (
          <>
            <span style={{ color: "var(--border-default)" }}>&middot;</span>
            <span>{tableCount} tables</span>
            <span style={{ color: "var(--border-default)" }}>&middot;</span>
            <span>{totalRows.toLocaleString()} rows</span>
          </>
        )}
      </div>
      <span>PostgreSQL 14</span>
    </div>
  );
}
```

---

### Task 6: CellRenderer utility

**Files:**
- Create: `db-console/src/components/CellRenderer.jsx`

**Step 1: Create the utility**

Shared cell rendering with data-type color coding and blockchain-specific formatting.

```jsx
const ETHERSCAN = "https://etherscan.io";
const TX_COLS = new Set(["tx_hash", "transaction_hash", "txhash"]);
const ADDR_COLS = new Set(["log_addr", "sender", "recipient", "from", "to", "address", "contract"]);
const NUM_FMT = new Intl.NumberFormat("en-US");

export function cellClass(colType, value) {
  if (value == null) return "cell-null";
  if (typeof value === "boolean") return "cell-boolean";
  const s = String(value);
  if (s.startsWith("0x") || s.startsWith("\\x")) return "cell-hex";
  if (/^(bigint|integer|numeric|real|double|smallint)/.test(colType)) return "cell-number";
  return "cell-string";
}

export function renderCell(colName, colType, value) {
  if (value == null) return <span className="cell-null">NULL</span>;

  const str = String(value);

  // Tx hash links
  if (TX_COLS.has(colName) && str.startsWith("0x")) {
    return (
      <a href={`${ETHERSCAN}/tx/${str}`} target="_blank" rel="noopener noreferrer"
         title={str} className="cell-hex">
        {str.slice(0, 10)}&hellip;{str.slice(-8)}
      </a>
    );
  }

  // Address links
  if (ADDR_COLS.has(colName) && str.startsWith("0x") && str.length === 42) {
    return (
      <a href={`${ETHERSCAN}/address/${str}`} target="_blank" rel="noopener noreferrer"
         title={str} className="cell-hex">
        {str.slice(0, 8)}&hellip;{str.slice(-6)}
      </a>
    );
  }

  // Format large numbers with commas
  if (/^(bigint|integer|numeric|real|double|smallint)/.test(colType)) {
    const n = Number(value);
    if (!isNaN(n) && Number.isFinite(n)) {
      return <span className="cell-number">{NUM_FMT.format(n)}</span>;
    }
  }

  // Boolean
  if (typeof value === "boolean") {
    return <span className="cell-boolean">{value ? "true" : "false"}</span>;
  }

  // Hex values (not tx/addr)
  if (str.startsWith("0x") || str.startsWith("\\x")) {
    return <span className="cell-hex">{str.length > 20 ? str.slice(0, 10) + "…" + str.slice(-8) : str}</span>;
  }

  return <span className="cell-string">{str}</span>;
}
```

---

### Task 7: Sidebar component

**Files:**
- Create: `db-console/src/components/Sidebar.jsx`

**Step 1: Create the component**

Key behaviors:
- Groups tables by schema, collapsible sections
- **Debounced search** (150ms) to filter tables by name
- **localStorage persistence** for expanded schemas (`db-console-expanded-schemas`)
- Compact row count badges (`fmtCount`: `620K`, `1.2M`, `234`)
- Selected table highlighted with indigo left stripe (`.sidebar-item.selected`)
- Schema header shows table count

```js
// Compact row count formatter
function fmtCount(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + "K";
  return String(n);
}
```

Schema order: `uniswap_v3` first, then `public`, then others alphabetically.

On mount, read `localStorage.getItem("db-console-expanded-schemas")` to restore state. On toggle, write back.

Search input at top with 150ms debounce using `setTimeout`/`clearTimeout` pattern:

```js
const [searchRaw, setSearchRaw] = useState("");
const [search, setSearch] = useState("");
useEffect(() => {
  const t = setTimeout(() => setSearch(searchRaw), 150);
  return () => clearTimeout(t);
}, [searchRaw]);
```

---

### Task 8: ResultsTable component

**Files:**
- Create: `db-console/src/components/ResultsTable.jsx`

**Step 1: Create the component**

Shared results table used by both Explorer (preview) and QueryEditor (results). Features:
- Sortable column headers (click to sort, arrow indicator)
- Type-colored cells using `CellRenderer`
- Row hover: 2px indigo left-border stripe (CSS class from Task 3)
- Sticky header with glassmorphism (CSS class from Task 3)
- Row number column (#)
- Number formatting via `Intl.NumberFormat` for numeric columns

Props:
```
{ columns, rows, columnTypes, onSort, sortBy, sortDir, loading }
```

When `loading` is true, show skeleton rows (6 rows of animated bars matching column count).

---

### Task 9: Explorer component

**Files:**
- Create: `db-console/src/components/Explorer.jsx`

**Step 1: Create the component**

When a table is selected (via sidebar), Explorer:
1. Shows **breadcrumb**: `ethnode` > `schema` > `table` (with row count badge)
2. Fetches columns from `GET /api/tables/{schema}/{table}/columns`
3. Fetches preview from `GET /api/browse/{schema}/{table}?limit=20&offset=0`
4. Shows **skeleton loading** while fetching (skeleton table mimicking column widths)
5. Shows column inspector table: name, type, nullable
6. Shows preview data table via `ResultsTable` with type-colored cells
7. **"Query this table →"** button calls `onQueryTable(schema, table)`

When no table is selected, show an empty state: "Select a table from the sidebar to explore its schema and preview data."

Build column type map from the columns API response to pass to ResultsTable:
```js
const columnTypes = {};
columns.forEach(c => { columnTypes[c.name] = c.type; });
```

---

### Task 10: QueryEditor component

**Files:**
- Create: `db-console/src/components/QueryEditor.jsx`

**Step 1: Create the component**

Full SQL editor using CodeMirror 6 with:
- `basicSetup`, `sql()`, `oneDark` theme
- Custom theme sizing: 13px font, max-height 300px, mono font
- Ctrl+Enter keybinding to run query
- Run button with loading state
- POST to `/api/query/execute` with `{ sql, limit: 1000 }`
- Results shown via `ResultsTable` component
- Export buttons: CSV and JSON via POST `/api/export/query`
- Status line: row count + elapsed time
- **SQL history** in localStorage (`db-console-sql-history`, max 20 entries)
  - Each query execution appends to history
  - Show history dropdown below the editor (collapsible)
  - Click a history item to load it into the editor

Props:
```
{ initialSql }
```

`initialSql` is set when user clicks "Query this table" from Explorer — pre-fills with:
```sql
SELECT * FROM {schema}.{table} ORDER BY 1 DESC LIMIT 100
```

When `initialSql` changes (via `useEffect` on prop), update the CodeMirror document.

History format in localStorage:
```json
[
  { "sql": "SELECT ...", "ts": 1709500000, "rows": 50, "elapsed": 0.12 },
  ...
]
```

---

### Task 11: App root component

**Files:**
- Create: `db-console/src/App.jsx`

**Step 1: Create the component**

Combines all components into the app layout:

```jsx
import { useState, useEffect } from "react";
import TopBar from "./components/TopBar";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import Explorer from "./components/Explorer";
import QueryEditor from "./components/QueryEditor";

export default function App() {
  const [view, setView] = useState("explorer");
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [initialSql, setInitialSql] = useState("");

  useEffect(() => {
    fetch("/api/tables")
      .then(r => r.json())
      .then(d => setTables(d.tables))
      .catch(() => {});
  }, []);

  const handleQueryTable = (schema, table) => {
    setInitialSql(`SELECT * FROM ${schema}.${table} ORDER BY 1 DESC LIMIT 100`);
    setView("query");
  };

  const totalRows = tables.reduce((s, t) => s + (t.row_count || 0), 0);

  return (
    <div className="app-layout">
      <TopBar view={view} onViewChange={setView} />
      <div className="app-body">
        <Sidebar
          tables={tables}
          selected={selectedTable}
          onSelectTable={(s, t) => {
            setSelectedTable({ schema: s, table: t });
            setView("explorer");
          }}
        />
        <div className="main-content">
          {view === "explorer" ? (
            <Explorer table={selectedTable} onQueryTable={handleQueryTable} />
          ) : (
            <QueryEditor initialSql={initialSql} />
          )}
        </div>
      </div>
      <StatusBar
        tableCount={tables.length}
        totalRows={totalRows}
        connected={tables.length > 0}
      />
    </div>
  );
}
```

**Step 2: Build and verify**

```bash
cd db-console && npm run build
```

Expected: Build succeeds, no errors.

**Step 3: Commit all components**

```bash
git add db-console/
git commit -m "feat: build standalone DB Console with explorer, query, SQL history, type-colored cells"
```

---

### Task 12: Manual integration test

**Step 1: Start backend (if not running)**

```bash
cd /home/hfu11/stevens-blockchain
uvicorn web.app:app --host 0.0.0.0 --port 8000 --reload &
```

**Step 2: Start db-console dev server**

```bash
cd /home/hfu11/stevens-blockchain/db-console && npm run dev
```

**Step 3: Verify in browser at `http://localhost:5174`**

- [ ] Page loads with dark theme, top bar, sidebar, status bar
- [ ] Sidebar shows schema tree with tables grouped, row counts as compact badges
- [ ] Sidebar search filters tables with debounce (no lag)
- [ ] Collapse/expand schemas persists after page refresh (localStorage)
- [ ] Clicking a table shows skeleton loader → then columns + preview
- [ ] Breadcrumb shows `ethnode > schema > table`
- [ ] Data preview has type-colored cells (green strings, orange numbers, cyan hex)
- [ ] Numbers formatted with commas (e.g., `22,341,234`)
- [ ] Row hover shows indigo left stripe
- [ ] "Query this table" switches to Query view with pre-filled SQL
- [ ] Running a query shows results in ResultsTable
- [ ] SQL history dropdown shows previous queries
- [ ] CSV/JSON export works
- [ ] No console errors

**Step 4: Build check**

```bash
cd /home/hfu11/stevens-blockchain/db-console && npx vite build
```

Expected: Clean build, no errors.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | CORS for :5174 | `web/app.py` |
| 2 | Scaffold Vite project | `db-console/{package.json,vite.config.js,index.html,src/main.jsx}` |
| 3 | Theme CSS + layout classes | `db-console/src/index.css` |
| 4 | TopBar component | `db-console/src/components/TopBar.jsx` |
| 5 | StatusBar component | `db-console/src/components/StatusBar.jsx` |
| 6 | CellRenderer utility | `db-console/src/components/CellRenderer.jsx` |
| 7 | Sidebar with debounce + localStorage | `db-console/src/components/Sidebar.jsx` |
| 8 | ResultsTable with skeleton loading | `db-console/src/components/ResultsTable.jsx` |
| 9 | Explorer with breadcrumbs | `db-console/src/components/Explorer.jsx` |
| 10 | QueryEditor with SQL history | `db-console/src/components/QueryEditor.jsx` |
| 11 | App root + build verify | `db-console/src/App.jsx` |
| 12 | Manual integration test | — |

## Future (v2)

- MiniMax AI chat integration (natural language → SQL → voice results)
- Command palette (Cmd+P fuzzy table search)
- Multiple query tabs
- Right-click context menus (Copy as JSON/INSERT/WHERE)
- Column resizing
- Keyboard navigation in sidebar
- SQL formatter (Prettify button)
