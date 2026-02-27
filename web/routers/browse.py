import re
from fastapi import APIRouter, HTTPException, Query
from web.db import get_conn

router = APIRouter()

# Strict validation: only alphanumeric + underscores allowed
_VALID_NAME = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _validate_name(name: str, label: str) -> str:
    if not _VALID_NAME.match(name):
        raise HTTPException(400, f"Invalid {label}: {name}")
    return name


@router.get("/browse/{schema}/{table}")
async def browse_table(
    schema: str,
    table: str,
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Paginated rows from any table. Table name is validated to prevent injection."""
    schema = _validate_name(schema, "schema")
    table = _validate_name(table, "table")

    async with get_conn() as conn:
        # Verify table exists
        check = await conn.execute(
            "SELECT 1 FROM pg_tables WHERE schemaname = %s AND tablename = %s",
            (schema, table),
        )
        if await check.fetchone() is None:
            raise HTTPException(404, f"Table {schema}.{table} not found")

        # Get column info
        col_query = await conn.execute(
            """SELECT column_name, data_type
               FROM information_schema.columns
               WHERE table_schema = %s AND table_name = %s
               ORDER BY ordinal_position""",
            (schema, table),
        )
        columns = [
            {"name": row[0], "type": row[1]} for row in await col_query.fetchall()
        ]

        # Get total count
        count_row = await conn.execute(
            f'SELECT count(*) FROM "{schema}"."{table}"'
        )
        total = (await count_row.fetchone())[0]

        # Get rows — cast bytea to hex for JSON serialization
        col_exprs = []
        for col in columns:
            name = col["name"]
            if col["type"] == "bytea":
                col_exprs.append(f'encode("{name}", \'hex\') AS "{name}"')
            else:
                col_exprs.append(f'"{name}"')
        select = ", ".join(col_exprs)

        data_query = await conn.execute(
            f'SELECT {select} FROM "{schema}"."{table}" LIMIT %s OFFSET %s',
            (limit, offset),
        )
        rows = [
            dict(zip([c["name"] for c in columns], row))
            for row in await data_query.fetchall()
        ]

    return {
        "schema": schema,
        "table": table,
        "columns": columns,
        "total": total,
        "limit": limit,
        "offset": offset,
        "rows": rows,
    }
