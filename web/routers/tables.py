import re

from fastapi import APIRouter, HTTPException, Query
from web.db import get_conn

_IDENTIFIER_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_.]*$")

router = APIRouter()


@router.get("/tables")
async def list_tables():
    """List all non-system tables with row counts."""
    query = """
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY schemaname, tablename
    """
    async with get_conn() as conn:
        rows = await conn.execute(query)
        tables = await rows.fetchall()

        result = []
        for schema, table in tables:
            count_query = f'SELECT count(*) FROM "{schema}"."{table}"'
            try:
                row = await conn.execute(count_query)
                count = (await row.fetchone())[0]
            except Exception:
                count = None
            result.append({
                "schema": schema,
                "table": table,
                "row_count": count,
            })

    return {"tables": result}


@router.get("/tables/{schema}/{table}/columns")
async def get_table_columns(schema: str, table: str):
    """Get column details for a specific table (schema browser)."""
    query = """
        SELECT column_name, data_type, is_nullable,
               column_default, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
    """
    async with get_conn() as conn:
        rows = await conn.execute(query, (schema, table))
        columns = await rows.fetchall()

    return {
        "schema": schema,
        "table": table,
        "columns": [
            {
                "name": col[0],
                "type": col[1],
                "nullable": col[2] == "YES",
                "default": col[3],
                "max_length": col[4],
            }
            for col in columns
        ],
    }


_SKIP_SAMPLE_TYPES = {"bytea", "uuid"}
_SKIP_SAMPLE_PATTERNS = re.compile(r"(hash|address|tx_|_id$)", re.IGNORECASE)


@router.get("/tables/{schema}/{table}/sample-values")
async def get_sample_values(
    schema: str,
    table: str,
    column: str = Query(..., description="Column to fetch distinct values for"),
    limit: int = Query(50, ge=1, le=200),
):
    """Return up to `limit` distinct non-null values for a column (for filter dropdowns)."""
    if not _IDENTIFIER_RE.match(schema):
        raise HTTPException(400, "Invalid schema name")
    if not _IDENTIFIER_RE.match(table):
        raise HTTPException(400, "Invalid table name")
    if not _IDENTIFIER_RE.match(column):
        raise HTTPException(400, "Invalid column name")

    # Check column type — skip high-cardinality / binary columns
    type_query = """
        SELECT data_type FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s AND column_name = %s
    """
    async with get_conn() as conn:
        row = await conn.execute(type_query, (schema, table, column))
        meta = await row.fetchone()
        if not meta:
            raise HTTPException(404, "Column not found")
        col_type = meta[0]

        if col_type in _SKIP_SAMPLE_TYPES or _SKIP_SAMPLE_PATTERNS.search(column):
            return {"schema": schema, "table": table, "column": column, "values": [], "skipped": True}

        sql = f'SELECT DISTINCT "{column}" FROM "{schema}"."{table}" WHERE "{column}" IS NOT NULL ORDER BY "{column}" LIMIT {limit}'
        try:
            rows = await conn.execute(sql)
            values = [r[0] for r in await rows.fetchall()]
        except Exception as e:
            raise HTTPException(400, f"Could not fetch sample values: {e}")

    return {"schema": schema, "table": table, "column": column, "values": values}
