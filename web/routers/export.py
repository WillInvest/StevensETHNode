import csv
import io
import json
import re

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from web.db import get_conn

router = APIRouter(tags=["export"])

_VALID_NAME = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
_BLOCKED = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b", re.I
)


@router.get("/export/{schema}/{table}")
async def export_table(
    schema: str,
    table: str,
    format: str = Query("csv"),
    limit: int = Query(50000, ge=1, le=500000),
):
    """Export table data as CSV or JSON."""
    if not _VALID_NAME.match(schema) or not _VALID_NAME.match(table):
        raise HTTPException(400, "Invalid table name")

    async with get_conn() as conn:
        check = await conn.execute(
            "SELECT 1 FROM pg_tables WHERE schemaname = %s AND tablename = %s",
            (schema, table),
        )
        if await check.fetchone() is None:
            raise HTTPException(404, f"Table {schema}.{table} not found")

        cur = await conn.execute(
            f'SELECT * FROM "{schema}"."{table}" LIMIT %s', (limit,)
        )
        columns = [desc.name for desc in cur.description]
        rows = await cur.fetchall()

    filename = f"{schema}_{table}"
    return _format_response(columns, rows, format, filename)


class ExportQueryRequest(BaseModel):
    sql: str
    format: str = "csv"
    limit: int = 50000


@router.post("/export/query")
async def export_query(req: ExportQueryRequest):
    """Export ad-hoc query results as CSV or JSON."""
    sql = req.sql.strip().rstrip(";")
    if not sql:
        raise HTTPException(400, "Empty query")
    if _BLOCKED.search(sql):
        raise HTTPException(403, "Only SELECT queries are allowed")

    limit = min(req.limit, 500000)
    async with get_conn() as conn:
        try:
            cur = await conn.execute(f"SELECT * FROM ({sql}) AS _q LIMIT {limit}")
        except Exception as e:
            raise HTTPException(400, f"Query error: {e}")
        columns = [desc.name for desc in cur.description]
        rows = await cur.fetchall()

    return _format_response(columns, rows, req.format, "query_result")


def _format_response(columns, rows, fmt, filename):
    if fmt == "json":
        data = [dict(zip(columns, (_serialize(v) for v in row))) for row in rows]
        content = json.dumps(data, default=str)
        return StreamingResponse(
            iter([content]),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}.json"'},
        )
    else:
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(columns)
        for row in rows:
            writer.writerow([_serialize(v) for v in row])
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )


def _serialize(val):
    if isinstance(val, (bytes, bytearray, memoryview)):
        return "0x" + bytes(val).hex()
    return val
