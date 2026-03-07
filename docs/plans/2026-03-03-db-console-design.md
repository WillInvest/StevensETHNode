# DB Console — Standalone Database Frontend

**Date:** 2026-03-03
**Status:** Approved
**Stack:** React + Vite, standalone at `:5174`
**Directory:** `db-console/` (top-level)
**Backend:** Reuses existing FastAPI at `:8000` (CORS-enabled)

## Overview

A standalone, single-page database console for the Stevens Blockchain Analytics PostgreSQL database (`ethnode`). Two views: **Explorer** (browse schemas/tables/columns + preview data) and **Query** (SQL editor + results). Designed to feel like TablePlus or Beekeeper Studio — professional, fast, keyboard-driven.

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌─ Top Bar ───────────────────────────────────────────────────┐ │
│  │  ◆ DB Console          [Explorer] [Query]     ethnode@:5432 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Left Sidebar (240px) ──┐  ┌─ Main Content ───────────────┐  │
│  │ 🔍 Filter tables...     │  │                              │  │
│  │                         │  │  (Explorer or Query view)    │  │
│  │ ▾ uniswap_v3      3    │  │                              │  │
│  │   ● swap_events  620K   │  │                              │  │
│  │   ● mint_events   13K   │  │                              │  │
│  │   ● burn_events   15K   │  │                              │  │
│  │                         │  │                              │  │
│  │ ▸ public          22    │  │                              │  │
│  │ ▸ shovel          18    │  │                              │  │
│  └─────────────────────────┘  └──────────────────────────────┘  │
│                                                                  │
│  ┌─ Status Bar ────────────────────────────────────────────────┐ │
│  │  ● Connected · 43 tables · 650K rows            PostgreSQL │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Views

### Explorer View (click table in sidebar)

Shows column schema + 20-row data preview for the selected table.

```
┌─ Main Content ─────────────────────────────────────────────────┐
│  uniswap_v3 / swap_events                          620,903 rows│
│                                                                │
│  Columns (12)                                                  │
│  ┌────────────┬─────────┬──────────┐                           │
│  │ Name       │ Type    │ Nullable │                           │
│  │ block_num  │ bigint  │ NO       │                           │
│  │ tx_hash    │ bytea   │ NO       │                           │
│  │ ...        │         │          │                           │
│  └────────────┴─────────┴──────────┘                           │
│                                                                │
│  Preview                                  [Query this table →] │
│  ┌────────┬───────────┬──────────┬───────────┐                 │
│  │block   │ tx_hash   │ sender   │ amount0   │                 │
│  │22341234│ 0xabc...  │ 0xdef... │ 1.234     │                 │
│  └────────┴───────────┴──────────┴───────────┘                 │
└────────────────────────────────────────────────────────────────┘
```

### Query View

CodeMirror SQL editor with results table below.

```
┌─ Main Content ─────────────────────────────────────────────────┐
│  ┌─ SQL Editor ──────────────────────────────────────────────┐ │
│  │ SELECT * FROM uniswap_v3.swap_events                      │ │
│  │ ORDER BY block_num DESC LIMIT 50                          │ │
│  └───────────────────────────────────────────────────────────┘ │
│  [▶ Run  ⌘↵]    50 rows · 0.12s         [CSV] [JSON]         │
│                                                                │
│  ┌─ Results ─────────────────────────────────────────────────┐ │
│  │ block_num │ tx_hash      │ sender       │ amount0         │ │
│  │ 22341234  │ 0xabc1e...   │ 0xdef2a...   │ 1.234          │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## Design System

Reuses the existing dark theme from the main dashboard.

| Token | Value |
|-------|-------|
| `--bg-primary` | `#08081a` |
| `--bg-card` | `#13132a` |
| `--accent` | `#6366f1` (indigo) |
| `--font-body` | IBM Plex Sans |
| `--font-mono` | JetBrains Mono |

### Data Type Color Coding (results cells)

| Data Type | Color | Hex |
|-----------|-------|-----|
| Strings | Soft green | `#7ee787` |
| Numbers | Warm orange | `#ffab70` |
| Booleans | Indigo | `#6366f1` |
| NULL | Muted gray | `#4d4d6a` |
| Hex/Addresses | Light cyan | `#a5d6ff` |

### Micro-interactions

- **Row hover**: 2px indigo left-border stripe (not full background)
- **Schema expand**: CSS spring transition (`cubic-bezier(0.4, 0, 0.2, 1)`)
- **Query loading**: Skeleton table mimicking expected column widths
- **Table header sticky**: `backdrop-filter: blur(8px)` glassmorphism

## Components

| Component | File | Description |
|-----------|------|-------------|
| App | `App.jsx` | Root layout: top bar + sidebar + content |
| Sidebar | `Sidebar.jsx` | Schema tree, search filter, table selection |
| TopBar | `TopBar.jsx` | App title, view tabs, connection badge |
| StatusBar | `StatusBar.jsx` | Connection dot, table/row summary |
| Explorer | `Explorer.jsx` | Column inspector + data preview |
| QueryEditor | `QueryEditor.jsx` | CodeMirror SQL + run button + results |
| ResultsTable | `ResultsTable.jsx` | Shared table with sorting, type-colored cells |

## API Endpoints Used

All existing — no new backend endpoints needed.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tables` | GET | List all tables with row counts |
| `/api/tables/{schema}/{table}/columns` | GET | Column details for a table |
| `/api/browse/{schema}/{table}` | GET | Paginated data preview |
| `/api/query/execute` | POST | Execute SQL query |
| `/api/export/query` | POST | Export results as CSV/JSON |

## Backend Change

Add CORS middleware to `web/app.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## File Structure

```
db-console/
  package.json
  vite.config.js
  index.html
  src/
    main.jsx
    App.jsx
    index.css          # Theme (reuse CSS vars from main dashboard)
    components/
      TopBar.jsx
      Sidebar.jsx
      StatusBar.jsx
      Explorer.jsx
      QueryEditor.jsx
      ResultsTable.jsx
```

## Dependencies

- `react`, `react-dom` — UI framework
- `codemirror`, `@codemirror/lang-sql`, `@codemirror/theme-one-dark` — SQL editor
- `@codemirror/view`, `@codemirror/state` — CodeMirror core

No router needed — single page with view state managed by React.

## Future (v2, not in MVP)

- MiniMax AI chat integration (natural language to SQL)
- MiniMax TTS (speak query results)
- Saved queries
- Result set tabs
- Right-click "Copy as WHERE clause"
