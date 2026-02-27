import time

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from scipy import stats as sp_stats

from web.db import get_conn

router = APIRouter(tags=["stats"])


class StatsRequest(BaseModel):
    sql: str
    analysis: str = "describe"  # describe | correlation | distribution
    column: str | None = None


@router.post("/stats/analyze")
async def analyze(req: StatsRequest):
    """Run statistical analysis on query results."""
    sql = req.sql.strip().rstrip(";")
    if not sql:
        raise HTTPException(400, "Empty query")

    # Block writes
    import re
    if re.search(r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b", sql, re.I):
        raise HTTPException(403, "Only SELECT queries are allowed")

    async with get_conn() as conn:
        start = time.monotonic()
        try:
            cur = await conn.execute(f"SELECT * FROM ({sql}) AS _q LIMIT 50000")
        except Exception as e:
            raise HTTPException(400, f"Query error: {e}")
        columns = [desc.name for desc in cur.description] if cur.description else []
        rows = await cur.fetchall()
        elapsed = round(time.monotonic() - start, 4)

    if not rows:
        raise HTTPException(400, "Query returned no rows")

    df = pd.DataFrame(rows, columns=columns)
    numeric_df = df.select_dtypes(include=[np.number])

    if req.analysis == "describe":
        desc = numeric_df.describe().to_dict()
        # Convert numpy types to Python types
        result = {}
        for col, stats in desc.items():
            result[col] = {k: float(v) if pd.notna(v) else None for k, v in stats.items()}
        return {"analysis": "describe", "result": result, "elapsed_seconds": elapsed}

    elif req.analysis == "correlation":
        if numeric_df.shape[1] < 2:
            raise HTTPException(400, "Need at least 2 numeric columns for correlation")
        corr = numeric_df.corr().to_dict()
        result = {}
        for col, vals in corr.items():
            result[col] = {k: round(float(v), 4) if pd.notna(v) else None for k, v in vals.items()}
        return {"analysis": "correlation", "result": result, "elapsed_seconds": elapsed}

    elif req.analysis == "distribution":
        col = req.column
        if not col or col not in numeric_df.columns:
            col = numeric_df.columns[0] if len(numeric_df.columns) > 0 else None
        if col is None:
            raise HTTPException(400, "No numeric column available")

        series = numeric_df[col].dropna()
        if len(series) < 3:
            raise HTTPException(400, f"Not enough data points in column '{col}'")

        _, normality_p = sp_stats.normaltest(series) if len(series) >= 8 else (None, None)

        return {
            "analysis": "distribution",
            "column": col,
            "result": {
                "count": int(len(series)),
                "mean": round(float(series.mean()), 6),
                "std": round(float(series.std()), 6),
                "min": float(series.min()),
                "max": float(series.max()),
                "median": float(series.median()),
                "skew": round(float(series.skew()), 4),
                "kurtosis": round(float(series.kurtosis()), 4),
                "normality_p_value": round(float(normality_p), 6) if normality_p is not None else None,
                "percentiles": {
                    "p10": float(series.quantile(0.1)),
                    "p25": float(series.quantile(0.25)),
                    "p50": float(series.quantile(0.5)),
                    "p75": float(series.quantile(0.75)),
                    "p90": float(series.quantile(0.9)),
                },
            },
            "elapsed_seconds": elapsed,
        }

    else:
        raise HTTPException(400, f"Unknown analysis type: {req.analysis}")
