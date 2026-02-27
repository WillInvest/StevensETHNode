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
