import re
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from web.db import get_conn

router = APIRouter(tags=["query"])

# Block dangerous SQL statements
_BLOCKED_PATTERN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|EXECUTE|CALL)\b",
    re.IGNORECASE,
)

MAX_ROWS = 10000


class QueryRequest(BaseModel):
    sql: str
    limit: int = 1000


@router.post("/query/execute")
async def execute_query(req: QueryRequest):
    """Execute a read-only SQL query and return results."""
    sql = req.sql.strip().rstrip(";")
    if not sql:
        raise HTTPException(400, "Empty query")

    if _BLOCKED_PATTERN.search(sql):
        raise HTTPException(
            403, "Only SELECT queries are allowed (write operations are blocked)"
        )

    limit = min(req.limit, MAX_ROWS)
    wrapped = f"SELECT * FROM ({sql}) AS _q LIMIT {limit}"

    async with get_conn() as conn:
        start = time.monotonic()
        try:
            cur = await conn.execute(wrapped)
        except Exception as e:
            raise HTTPException(400, f"Query error: {e}")
        elapsed = round(time.monotonic() - start, 4)

        columns = [desc.name for desc in cur.description] if cur.description else []
        rows_raw = await cur.fetchall()
        rows = [dict(zip(columns, row)) for row in rows_raw]

    return {
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "elapsed_seconds": elapsed,
    }
