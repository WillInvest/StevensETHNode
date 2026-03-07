"""End-to-end tests: API → Database → Response."""

import pytest


@pytest.mark.anyio
async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.anyio
async def test_tables_returns_list(client):
    resp = await client.get("/api/tables")
    assert resp.status_code == 200
    data = resp.json()
    assert "tables" in data
    tables = data["tables"]
    assert isinstance(tables, list)
    assert len(tables) > 0
    # Every entry has schema, table, row_count
    for t in tables:
        assert "schema" in t
        assert "table" in t
        assert "row_count" in t


@pytest.mark.anyio
async def test_browse_returns_rows(client):
    # First discover a real table
    resp = await client.get("/api/tables")
    tables = resp.json()["tables"]
    t = tables[0]
    resp = await client.get(f"/api/browse/{t['schema']}/{t['table']}?limit=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["schema"] == t["schema"]
    assert data["table"] == t["table"]
    assert "columns" in data
    assert "rows" in data
    assert len(data["rows"]) <= 5


@pytest.mark.anyio
async def test_browse_invalid_table_404(client):
    resp = await client.get("/api/browse/public/nonexistent_table_xyz")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_mempool_snapshot(client):
    resp = await client.get("/api/mempool/snapshot")
    assert resp.status_code == 200
    data = resp.json()
    assert "gas" in data or "error" in data
