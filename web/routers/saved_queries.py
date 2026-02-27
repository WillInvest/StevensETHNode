from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from web.db import get_conn

router = APIRouter(tags=["saved_queries"])


class SaveQueryRequest(BaseModel):
    name: str
    description: str = ""
    sql_text: str


@router.get("/queries")
async def list_saved_queries():
    """List all saved queries."""
    async with get_conn() as conn:
        # Ensure table exists
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS _saved_queries (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                sql_text TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """)
        cur = await conn.execute(
            "SELECT id, name, description, sql_text, created_at FROM _saved_queries ORDER BY created_at DESC"
        )
        rows = await cur.fetchall()
    return [
        {
            "id": r[0],
            "name": r[1],
            "description": r[2],
            "sql_text": r[3],
            "created_at": r[4].isoformat() if r[4] else None,
        }
        for r in rows
    ]


@router.post("/queries")
async def save_query(req: SaveQueryRequest):
    """Save a new query."""
    if not req.name.strip() or not req.sql_text.strip():
        raise HTTPException(400, "Name and SQL are required")
    async with get_conn() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS _saved_queries (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                sql_text TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """)
        cur = await conn.execute(
            "INSERT INTO _saved_queries (name, description, sql_text) VALUES (%s, %s, %s) RETURNING id",
            (req.name.strip(), req.description.strip(), req.sql_text.strip()),
        )
        row = await cur.fetchone()
    return {"id": row[0], "name": req.name}


@router.delete("/queries/{query_id}")
async def delete_query(query_id: int):
    """Delete a saved query."""
    async with get_conn() as conn:
        cur = await conn.execute(
            "DELETE FROM _saved_queries WHERE id = %s RETURNING id", (query_id,)
        )
        row = await cur.fetchone()
        if row is None:
            raise HTTPException(404, "Query not found")
    return {"deleted": query_id}
