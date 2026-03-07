# API Reference

Base URL: `http://localhost:8000/api`

## Health

### `GET /api/health`
Returns `{"status": "ok"}`.

## Authentication

### `POST /api/auth/login`
Body: `{"username": "...", "password": "..."}`
Sets JWT cookie. Returns `{"username", "role"}`.

### `POST /api/auth/logout`
Clears JWT cookie.

### `GET /api/auth/me`
Returns current user from JWT cookie.

## Tables

### `GET /api/tables`
Lists all non-system tables with row counts.
Returns `{"tables": [{"schema", "table", "row_count"}]}`.

## Browse

### `GET /api/browse/{schema}/{table}`
Paginated table browser.
Query params: `limit` (1-1000), `offset`, `sort_by`, `sort_dir` (asc/desc).
Returns `{"schema", "table", "columns", "total", "limit", "offset", "rows"}`.

## Query

### `POST /api/query/execute`
Execute read-only SQL.
Body: `{"sql": "SELECT ...", "limit": 1000}`
Returns `{"columns", "rows", "row_count", "elapsed_seconds"}`.

## Export

### `GET /api/export/{schema}/{table}?format=csv|json`
Export table data. Returns file download.

### `POST /api/export/query`
Export query results.
Body: `{"sql": "...", "format": "csv|json", "limit": 50000}`

## Statistics

### `POST /api/stats/analyze`
Body: `{"sql": "SELECT ...", "analysis": "describe|correlation|distribution", "column": "..."}`
Returns statistical analysis of query results.

## Saved Queries

### `GET /api/queries`
List all saved queries.

### `POST /api/queries`
Body: `{"name": "...", "description": "...", "sql_text": "..."}`
Save a new query.

### `DELETE /api/queries/{id}`
Delete a saved query.

## Stevens Crypto Index (SCI)

### `GET /api/sci/current`
Latest SCI score with component breakdown.

### `GET /api/sci/history?days=30`
Historical SCI scores for charting.

### `GET /api/sci/stream`
SSE endpoint — live SCI updates every 30 seconds.

## Mempool

### `GET /api/mempool/snapshot`
Full mempool snapshot: gas prices, pending txs, fee history, txpool.

### `GET /api/mempool/stream`
SSE endpoint — live mempool updates every 3 seconds.

## Monitoring

### `GET /api/monitoring/status`
System health: DB size, table sizes, indexer lag, Erigon status.

## Extraction

### `GET /api/extraction/pools`
List available Cryo extraction pools.

### `POST /api/extraction/start`
Start a Cryo extraction job.

### `POST /api/extraction/pause`
Pause a running extraction (SIGSTOP).

### `POST /api/extraction/resume`
Resume a paused extraction (SIGCONT).

### `GET /api/extraction/jobs`
List all extraction jobs.

### `GET /api/extraction/stream`
SSE endpoint — extraction progress every 2 seconds.
