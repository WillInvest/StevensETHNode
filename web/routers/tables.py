from fastapi import APIRouter
from web.db import get_conn

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
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
    """
    async with get_conn() as conn:
        rows = await conn.execute(query, [schema, table])
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
