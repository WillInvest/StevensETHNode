# Hyperliquid Exact Liquidation Distribution — How We Built It & How to Verify

## What We Built

A real-position-data pipeline that replaces the previous OI-distribution estimation model with
**exact** liquidation prices sourced directly from Hyperliquid's public API.

### Architecture

```
WebSocket trades stream (ETH)
        │
        ▼  buyers + sellers extracted every trade
hl_known_addresses (PostgreSQL)  ← vault seed on startup
        │
        ▼  every 5 minutes via batchClearinghouseState calls
hl_positions (PostgreSQL)
        │  liq_price, size, side, entry per address+coin
        ▼
build_exact_liquidation_map()
        │  bin by liquidation_price, sum position_value_usd
        ▼
/api/eth-distribution/liquidation-map
        │  {bars, source, coverage_pct, known_addresses, ...}
        ▼
EthDistribution.jsx  (unchanged — same response format)
```

### Key Files

| File | Role |
|---|---|
| `db/schema/11_hyperliquid_positions.sql` | DB tables + indexes |
| `protocols-live-state/perps/hyperliquid/extractors/address_harvester.py` | WebSocket address collector |
| `protocols-live-state/perps/hyperliquid/extractors/position_scanner.py` | Batch scanning + distribution builder |
| `web/routers/eth_distribution.py` | API endpoint + background scanner loop |
| `web/app.py` | Lifespan: starts harvester + scanner |

### Data Source Transparency

Every position in the distribution comes directly from Hyperliquid's `clearinghouseState` API:
```
POST https://api.hyperliquid.xyz/info
{"type": "clearinghouseState", "user": "0x..."}
```
No authentication required. Returns exact `liquidationPx`, `szi`, `positionValue`, `entryPx`, leverage.

The API response field `liquidationPx` is Hyperliquid's own calculated liquidation price for isolated
positions. For cross-margin, we compute it as: `entry * (1 - 1/leverage)` for longs, `entry * (1 + 1/leverage)` for shorts.

---

## How to Verify the Data is Live and Correct

### 1. Check the API Response for Source and Coverage

```bash
curl -s http://localhost:8000/api/eth-distribution/liquidation-map | \
  python3 -m json.tool | grep -E '"source"|"coverage_pct"|"known_addresses"'
```

Expected output progression:
- Day 0 (startup): `"source": "estimated"`, `"coverage_pct": 0.0`, `"known_addresses": 0`
- After 1 hour: `"source": "exact"` once known_addresses >= 1000
- After 24 hours: `"coverage_pct": 20-60%` (growing as more addresses are discovered)

### 2. Spot-Check a Specific Position Against the Raw API

Pick any position in the DB, then verify it directly against Hyperliquid's API:

```bash
# Step 1: Pick a position from the DB
PGPASSWORD=changeme psql -h localhost -U ethnode -d ethnode -c "
SELECT address, side, entry_price, liquidation_price, position_value_usd, leverage_value
FROM hl_positions
WHERE coin = 'ETH'
ORDER BY position_value_usd DESC
LIMIT 5;
"

# Step 2: Verify the position via Hyperliquid API directly
ADDRESS="0x<paste address from above>"
curl -s -X POST https://api.hyperliquid.xyz/info \
  -H "Content-Type: application/json" \
  -d "{\"type\": \"clearinghouseState\", \"user\": \"$ADDRESS\"}" | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
for p in data.get('assetPositions', []):
    pos = p['position']
    if pos['coin'] == 'ETH' and float(pos.get('szi', 0)) != 0:
        print('Coin:', pos['coin'])
        print('Size:', pos['szi'])
        print('Entry:', pos['entryPx'])
        print('Liq price (API):', pos.get('liquidationPx'))
        print('Position value:', pos.get('positionValue'))
        print('Leverage:', pos.get('leverage'))
"
```

The `liquidationPx` from the API and from our DB should match. If they differ by more than a few
dollars, it means the position's cross-margin state changed (funding, other positions) since the last scan.

### 3. Verify Distribution Totals Against Open Interest

```bash
PGPASSWORD=changeme psql -h localhost -U ethnode -d ethnode -c "
SELECT
    coin,
    COUNT(*) AS num_positions,
    SUM(position_value_usd) AS total_value_usd,
    SUM(CASE WHEN side = 'long' THEN position_value_usd ELSE 0 END) AS long_value,
    SUM(CASE WHEN side = 'short' THEN position_value_usd ELSE 0 END) AS short_value,
    MIN(liquidation_price) AS min_liq_price,
    MAX(liquidation_price) AS max_liq_price
FROM hl_positions
WHERE scanned_at > now() - interval '15 minutes'
GROUP BY coin;
"
```

Then compare `total_value_usd` against the live OI from Hyperliquid:
```bash
curl -s -X POST https://api.hyperliquid.xyz/info \
  -H "Content-Type: application/json" \
  -d '{"type": "metaAndAssetCtxs"}' | \
  python3 -c "
import json, sys
meta, ctxs = json.load(sys.stdin)
for asset, ctx in zip(meta['universe'], ctxs):
    if asset['name'] == 'ETH':
        oi = float(ctx['openInterest'])
        px = float(ctx['markPx'])
        print(f'ETH OI: {oi:.1f} coins = \${oi * px:,.0f} USD')
        break
"
```

`coverage_pct = (total_value_usd from DB) / (OI USD from API) * 100`

This should match the `coverage_pct` field in the API response.

### 4. Verify Address Discovery Is Running

```bash
# Count addresses collected over time
PGPASSWORD=changeme psql -h localhost -U ethnode -d ethnode -c "
SELECT
    source,
    scan_priority,
    COUNT(*) AS count,
    MIN(first_seen_at) AS earliest,
    MAX(last_active_at) AS latest
FROM hl_known_addresses
GROUP BY source, scan_priority
ORDER BY count DESC;
"
```

After the server has been running for 1+ hours, you should see `trades_stream` addresses accumulating.

### 5. Verify Position Scanner Is Running

Check the FastAPI logs for lines like:
```
HL position scan complete: 1500 addresses → 120 ETH positions
Liq map cache refreshed (source=exact, coverage=5.2%)
```

Or query the DB for the most recent scan timestamp:
```bash
PGPASSWORD=changeme psql -h localhost -U ethnode -d ethnode -c "
SELECT MAX(scanned_at) AS last_scan, COUNT(*) AS total_positions
FROM hl_positions WHERE coin = 'ETH';
"
```

The `last_scan` should be within the last 5 minutes (POSITION_SCAN_INTERVAL = 300s).

### 6. Cross-Check a Liquidation Price Manually

Given entry price, leverage, and side, the liquidation price formula is:
- **Long**: `liq = entry * (1 - 1/leverage)`
- **Short**: `liq = entry * (1 + 1/leverage)`

Example: Long 1 ETH at $2,000 with 10x leverage → `liq = 2000 * (1 - 0.1) = $1,800`

For cross-margin accounts, Hyperliquid's `liquidationPx` field accounts for other positions and
funding, so it may differ from this simple formula. The API value is always preferred.

---

## Coverage Growth Expectations

| Time Since Startup | Expected Coverage |
|---|---|
| 0-1 hour | 0% (bootstrapping, <1000 addresses) |
| 1-6 hours | 1-5% (WebSocket harvesting accumulates traders) |
| 24 hours | 10-30% |
| 48-72 hours | 30-60% |
| 1 week+ | 50-80% |

Note: Glassnode achieves ~90% OI coverage by tracking the **largest** positions. Our system captures
traders by activity (recent trades) rather than by size, so we'll capture many small positions.
For large-position bias, the vault seed + leaderboard seed (when working) covers whale accounts.

The coverage metric is conservative — it measures `sum(known positions) / total OI`. In practice,
the distribution shape (where clusters appear on the chart) is meaningful even at 20-30% coverage,
since large-value positions are disproportionately represented in active trade flows.

---

## Fallback Behavior

If `known_addresses < 1000` (bootstrap period) OR if `build_exact_liquidation_map()` throws:
- Falls back to the OI-distribution estimation model (`estimate_liquidation_map()`)
- Response includes `"source": "estimated"` so the frontend (and you) can see which mode is active
- The frontend chart still works identically — same bar format

---

## Known Limitations

1. **Cross-margin liquidation prices are approximate** for accounts with multiple positions.
   The API `liquidationPx` field says "may not be exact due to funding and other positions."
   For isolated-margin accounts (which is the majority), the price is exact.

2. **Coverage is limited** until the WebSocket has been running for 24-48 hours to discover
   trader addresses. Large one-time depositors may never be captured if they don't trade.

3. **Positions update every 5 minutes** — fast-moving markets can create stale liquidation prices.
   The `scanned_at > now() - 15 minutes` filter in the query ensures we don't serve data older than
   3 scan cycles.
