"""Integration tests for the /api/explore/* endpoints."""

import pytest


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_registry_structure(client):
    resp = await client.get("/api/explore/registry")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    registry = data["data"]
    assert "categories" in registry
    categories = registry["categories"]
    assert len(categories) >= 1

    dex = next((c for c in categories if c["id"] == "dex"), None)
    assert dex is not None
    assert dex["label"] == "Decentralized Exchange"
    protocols = dex["protocols"]
    uniswap = next((p for p in protocols if p["id"] == "uniswap"), None)
    assert uniswap is not None
    versions = uniswap["versions"]
    v3 = next((v for v in versions if v["id"] == "v3"), None)
    assert v3 is not None
    assert v3["active"] is True
    assert "tabs" in v3


# ---------------------------------------------------------------------------
# Pool list
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_pools_uniswap_v3_returns_pools(client):
    resp = await client.get("/api/explore/pools/uniswap/v3?limit=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    pools = data["data"]
    assert isinstance(pools, list)
    assert len(pools) > 0

    pool = pools[0]
    assert "pool_address" in pool
    assert "display_name" in pool
    assert "swap_count" in pool
    assert pool["swap_count"] > 0


@pytest.mark.anyio
async def test_pools_display_names_resolved(client):
    """Top pools should have human-readable symbol names, not raw addresses."""
    resp = await client.get("/api/explore/pools/uniswap/v3?limit=3")
    data = resp.json()
    for pool in data["data"]:
        # display_name should be "SYMBOL/SYMBOL", not "0x..."
        assert not pool["display_name"].startswith("0x"), (
            f"Pool {pool['pool_address']} has unresolved name: {pool['display_name']}"
        )


@pytest.mark.anyio
async def test_pools_limit_respected(client):
    resp = await client.get("/api/explore/pools/uniswap/v3?limit=3")
    data = resp.json()
    assert len(data["data"]) <= 3


@pytest.mark.anyio
async def test_pools_unknown_protocol_404(client):
    resp = await client.get("/api/explore/pools/unknown/v99")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_pools_coming_soon_version_404(client):
    resp = await client.get("/api/explore/pools/uniswap/v2")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Pool detail
# ---------------------------------------------------------------------------

USDC_WETH_POOL = "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640"


@pytest.mark.anyio
async def test_pool_detail_returns_metadata(client):
    resp = await client.get(f"/api/explore/pool/uniswap/v3/{USDC_WETH_POOL}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    pool = data["data"]
    assert pool["pool_address"] == USDC_WETH_POOL
    assert pool["swap_count"] > 0
    meta = pool["metadata"]
    assert meta is not None
    assert meta["token0_symbol"] in ("USDC", "WETH")
    assert meta["token1_symbol"] in ("USDC", "WETH")
    assert meta["fee"] == 500


@pytest.mark.anyio
async def test_pool_detail_unknown_protocol_404(client):
    resp = await client.get(f"/api/explore/pool/unknown/v99/{USDC_WETH_POOL}")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Pool events
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_pool_events_swaps(client):
    resp = await client.get(
        f"/api/explore/pool/uniswap/v3/{USDC_WETH_POOL}/events?event_type=swaps&limit=10"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert isinstance(data["data"], list)
    assert len(data["data"]) > 0
    assert data["meta"]["total"] > 0

    row = data["data"][0]
    assert "block" in row
    assert "tx_hash" in row
    assert "amount0" in row
    assert "amount1" in row


@pytest.mark.anyio
async def test_pool_events_mints(client):
    resp = await client.get(
        f"/api/explore/pool/uniswap/v3/{USDC_WETH_POOL}/events?event_type=mints&limit=5"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    row = data["data"][0]
    assert "tick_lower" in row
    assert "tick_upper" in row


@pytest.mark.anyio
async def test_pool_events_pagination(client):
    resp_a = await client.get(
        f"/api/explore/pool/uniswap/v3/{USDC_WETH_POOL}/events?event_type=swaps&limit=5&offset=0"
    )
    resp_b = await client.get(
        f"/api/explore/pool/uniswap/v3/{USDC_WETH_POOL}/events?event_type=swaps&limit=5&offset=5"
    )
    rows_a = resp_a.json()["data"]
    rows_b = resp_b.json()["data"]
    # Pages should not overlap
    hashes_a = {r["tx_hash"] for r in rows_a}
    hashes_b = {r["tx_hash"] for r in rows_b}
    assert len(hashes_a & hashes_b) == 0


@pytest.mark.anyio
async def test_pool_events_invalid_type_422(client):
    resp = await client.get(
        f"/api/explore/pool/uniswap/v3/{USDC_WETH_POOL}/events?event_type=invalid"
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Pool stats
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_pool_stats_returns_daily_data(client):
    resp = await client.get(
        f"/api/explore/pool/uniswap/v3/{USDC_WETH_POOL}/stats?days=7"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "daily_swaps" in data["data"]
    assert "daily_liquidity" in data["data"]
    assert data["meta"]["days"] == 7


@pytest.mark.anyio
async def test_pool_stats_daily_swaps_shape(client):
    resp = await client.get(
        f"/api/explore/pool/uniswap/v3/{USDC_WETH_POOL}/stats?days=7"
    )
    data = resp.json()
    for entry in data["data"]["daily_swaps"]:
        assert "day" in entry
        assert "swap_count" in entry
        assert entry["swap_count"] >= 0
