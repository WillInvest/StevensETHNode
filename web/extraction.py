import asyncio
import glob as globmod
import json
import math
import os
import signal
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from urllib.request import Request, urlopen

from web.db import get_conn

# ---------------------------------------------------------------------------
# Pool registry
# ---------------------------------------------------------------------------
POOLS = {
    "usdc_weth_005": {
        "label": "USDC/WETH 0.05%",
        "contract": "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
        "deploy_block": 12_376_729,
        "output_dir": "data/usdc_weth_005",
    },
    "wbtc_weth_030": {
        "label": "WBTC/WETH 0.3%",
        "contract": "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",
        "deploy_block": 12_370_624,
        "output_dir": "data/wbtc_weth_030",
    },
}

SWAP_TOPIC0 = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"
DEFAULT_CHUNK_SIZE = 10_000
CRYO_BIN = os.path.expanduser("~/.cargo/bin/cryo")
DUCKDB_BIN = os.path.expanduser("~/.local/bin/duckdb")
SAFE_TIP_DISTANCE = 128  # blocks behind chain head to avoid ReceiptGen errors

# ---------------------------------------------------------------------------
# Job model
# ---------------------------------------------------------------------------

class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    LOADING_TO_DB = "loading_to_db"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ExtractionJob:
    job_id: str
    pool_id: str
    start_block: int
    end_block: int
    chunk_size: int
    status: JobStatus = JobStatus.PENDING
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    error_message: Optional[str] = None
    pid: Optional[int] = None
    loaded_rows: Optional[int] = None


# In-memory job store
_jobs: dict[str, ExtractionJob] = {}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def get_chain_head() -> int:
    """Get current block number from Erigon via eth_blockNumber."""
    rpc_url = os.environ.get("ERIGON_RPC_URL", "http://127.0.0.1:8545")
    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": "eth_blockNumber",
        "params": [],
        "id": 1,
    }).encode()

    def _call():
        req = Request(rpc_url, data=payload, headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        return int(data["result"], 16)

    return await asyncio.get_event_loop().run_in_executor(None, _call)


def count_parquet_files(output_dir: str) -> int:
    """Count completed Parquet chunk files in an output directory."""
    pattern = os.path.join(output_dir, "**", "*.parquet")
    return len(globmod.glob(pattern, recursive=True))


def compute_expected_chunks(start_block: int, end_block: int, chunk_size: int) -> int:
    if end_block <= start_block:
        return 0
    return math.ceil((end_block - start_block) / chunk_size)


def get_job_progress(job: ExtractionJob) -> dict:
    """Build a progress snapshot for a job."""
    pool = POOLS[job.pool_id]
    completed_chunks = count_parquet_files(pool["output_dir"])
    expected_chunks = compute_expected_chunks(job.start_block, job.end_block, job.chunk_size)

    elapsed = (time.time() - job.started_at) if job.started_at else 0
    remaining_chunks = max(0, expected_chunks - completed_chunks)

    if completed_chunks > 0 and elapsed > 0:
        rate = elapsed / completed_chunks
        eta_seconds = rate * remaining_chunks
    else:
        eta_seconds = None

    pct = (completed_chunks / expected_chunks * 100) if expected_chunks > 0 else 0
    completed_blocks = min(completed_chunks * job.chunk_size, job.end_block - job.start_block)
    total_blocks = job.end_block - job.start_block

    return {
        "job_id": job.job_id,
        "pool_id": job.pool_id,
        "pool_label": pool["label"],
        "status": job.status.value,
        "start_block": job.start_block,
        "end_block": job.end_block,
        "chunk_size": job.chunk_size,
        "completed_chunks": completed_chunks,
        "expected_chunks": expected_chunks,
        "completed_blocks": completed_blocks,
        "total_blocks": total_blocks,
        "percent": round(pct, 1),
        "elapsed_seconds": round(elapsed, 1),
        "eta_seconds": round(eta_seconds, 1) if eta_seconds is not None else None,
        "error_message": job.error_message,
        "created_at": job.created_at,
        "loaded_rows": job.loaded_rows,
    }


def get_all_jobs() -> list[dict]:
    return [get_job_progress(j) for j in _jobs.values()]


def get_job(job_id: str) -> Optional[dict]:
    job = _jobs.get(job_id)
    return get_job_progress(job) if job else None

# ---------------------------------------------------------------------------
# Extraction launcher
# ---------------------------------------------------------------------------

async def start_extraction(
    pool_id: str,
    end_block: Optional[int] = None,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
) -> ExtractionJob:
    if pool_id not in POOLS:
        raise ValueError(f"Unknown pool: {pool_id}")

    for j in _jobs.values():
        if j.pool_id == pool_id and j.status in (JobStatus.RUNNING, JobStatus.LOADING_TO_DB):
            raise ValueError(f"Job already running for {pool_id}: {j.job_id}")

    pool = POOLS[pool_id]
    rpc_url = os.environ.get("ERIGON_RPC_URL", "http://127.0.0.1:8545")

    chain_head = await get_chain_head()

    # Smart end block: stay SAFE_TIP_DISTANCE behind chain head
    if end_block is None:
        end_block = chain_head - SAFE_TIP_DISTANCE

    # Smart start block: resume from where DB left off
    db_max = await _get_db_max_block(pool_id)
    if db_max is not None:
        start_block = db_max + 1
    else:
        start_block = pool["deploy_block"]

    if start_block >= end_block:
        raise ValueError(
            f"Already up to date: DB has data through block {db_max}, "
            f"safe end is {end_block} (head {chain_head} - {SAFE_TIP_DISTANCE})"
        )

    os.makedirs(pool["output_dir"], exist_ok=True)

    job = ExtractionJob(
        job_id=str(uuid.uuid4())[:8],
        pool_id=pool_id,
        start_block=start_block,
        end_block=end_block,
        chunk_size=chunk_size,
    )
    _jobs[job.job_id] = job

    cmd = [
        CRYO_BIN, "logs",
        "--rpc", rpc_url,
        "--contract", pool["contract"],
        "--topic0", SWAP_TOPIC0,
        "--blocks", f"{start_block}:{end_block}",
        "--chunk-size", str(chunk_size),
        "--output-dir", pool["output_dir"],
    ]

    job.status = JobStatus.RUNNING
    job.started_at = time.time()

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    job.pid = process.pid

    asyncio.create_task(_wait_for_job(job, process))
    return job


def pause_extraction(job_id: str) -> bool:
    """Pause a running extraction by sending SIGSTOP to the subprocess."""
    job = _jobs.get(job_id)
    if not job or job.status != JobStatus.RUNNING or not job.pid:
        return False
    try:
        os.kill(job.pid, signal.SIGSTOP)
        job.status = JobStatus.PAUSED
        return True
    except OSError:
        return False


def resume_extraction(job_id: str) -> bool:
    """Resume a paused extraction by sending SIGCONT to the subprocess."""
    job = _jobs.get(job_id)
    if not job or job.status != JobStatus.PAUSED or not job.pid:
        return False
    try:
        os.kill(job.pid, signal.SIGCONT)
        job.status = JobStatus.RUNNING
        return True
    except OSError:
        return False


async def _wait_for_job(job: ExtractionJob, process: asyncio.subprocess.Process):
    """Wait for Cryo subprocess to finish, then auto-load parquet into DB."""
    cryo_ok = False
    try:
        stdout, stderr = await process.communicate()
        if process.returncode == 0:
            cryo_ok = True
        else:
            if job.status != JobStatus.PAUSED:
                job.status = JobStatus.FAILED
            err_text = stderr.decode("utf-8", errors="replace")
            out_text = stdout.decode("utf-8", errors="replace")
            job.error_message = (err_text or out_text)[-1000:]
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error_message = str(e)
    finally:
        job.finished_at = time.time()

    # Auto-load parquet data into PostgreSQL
    has_parquet = count_parquet_files(POOLS[job.pool_id]["output_dir"]) > 0
    if has_parquet and (cryo_ok or job.status == JobStatus.FAILED):
        try:
            job.status = JobStatus.LOADING_TO_DB
            job.loaded_rows = await load_parquet_to_db(job.pool_id)
            job.status = JobStatus.COMPLETED
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = f"DB load error: {e}"
    elif cryo_ok:
        job.status = JobStatus.COMPLETED


# ---------------------------------------------------------------------------
# ABI decoding helpers
# ---------------------------------------------------------------------------

def _decode_int256(hex_str: str, word_index: int) -> int:
    """Decode a signed int256 from ABI-encoded hex at the given 32-byte word."""
    start = word_index * 64
    word = hex_str[start:start + 64]
    value = int(word, 16)
    if value >= 2**255:
        value -= 2**256
    return value


def _decode_uint256(hex_str: str, word_index: int) -> int:
    """Decode an unsigned uint256 from ABI-encoded hex at the given 32-byte word."""
    start = word_index * 64
    word = hex_str[start:start + 64]
    return int(word, 16)


# ---------------------------------------------------------------------------
# Smart DB queries
# ---------------------------------------------------------------------------

async def _get_db_max_block(pool_id: str) -> Optional[int]:
    """Get the highest block number in the DB for a pool's swap events."""
    pool = POOLS[pool_id]
    contract = pool["contract"].lower()
    try:
        async with get_conn() as conn:
            cur = await conn.execute(
                "SELECT MAX(block) FROM uniswap_v3.swap_events WHERE pool_id = %s",
                (contract,),
            )
            row = await cur.fetchone()
            return row[0] if row and row[0] is not None else None
    except Exception:
        return None


async def get_pool_coverage(pool_id: str) -> dict:
    """Get DB coverage stats for a pool."""
    pool = POOLS[pool_id]
    contract = pool["contract"].lower()
    try:
        async with get_conn() as conn:
            cur = await conn.execute(
                "SELECT MIN(block), MAX(block), COUNT(*) "
                "FROM uniswap_v3.swap_events WHERE pool_id = %s",
                (contract,),
            )
            row = await cur.fetchone()
            if row and row[2] and row[2] > 0:
                chain_head = await get_chain_head()
                total_range = chain_head - pool["deploy_block"]
                covered_range = row[1] - row[0] if row[0] and row[1] else 0
                coverage_pct = (covered_range / total_range * 100) if total_range > 0 else 0
                return {
                    "db_min_block": row[0],
                    "db_max_block": row[1],
                    "db_row_count": row[2],
                    "coverage_pct": round(coverage_pct, 1),
                }
    except Exception:
        pass
    return {"db_min_block": None, "db_max_block": None, "db_row_count": 0, "coverage_pct": 0}


# ---------------------------------------------------------------------------
# Parquet → PostgreSQL loader
# ---------------------------------------------------------------------------

async def load_parquet_to_db(pool_id: str) -> int:
    """Read parquet files via DuckDB CLI, decode Swap ABI, insert into PostgreSQL."""
    pool = POOLS[pool_id]
    output_dir = pool["output_dir"]
    contract = pool["contract"].lower()

    parquet_pattern = os.path.join(output_dir, "*.parquet")
    parquet_files = sorted(globmod.glob(parquet_pattern))
    if not parquet_files:
        return 0

    # Use DuckDB CLI to read all parquet and output JSON with hex-encoded fields
    glob_path = os.path.join(output_dir, "*.parquet")
    query = (
        "SELECT "
        "  block_number, "
        "  log_index, "
        "  lower('0x' || hex(transaction_hash)) as tx_hash, "
        "  lower('0x' || right(hex(topic1), 40)) as sender, "
        "  lower('0x' || right(hex(topic2), 40)) as recipient, "
        "  hex(data) as data_hex "
        f"FROM '{glob_path}' "
        "WHERE topic0 IS NOT NULL "
        "  AND topic1 IS NOT NULL "
        "  AND topic2 IS NOT NULL "
        "  AND data IS NOT NULL "
        "  AND octet_length(data) >= 160"
    )

    proc = await asyncio.create_subprocess_exec(
        DUCKDB_BIN, "-json", "-c", query,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        err = stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"DuckDB read failed: {err[:500]}")

    raw = stdout.decode("utf-8").strip()
    if not raw or raw == "[]":
        return 0

    records = json.loads(raw)
    if not records:
        return 0

    # Decode ABI and build row tuples
    rows = []
    for rec in records:
        data_hex = rec["data_hex"]
        if not data_hex or len(data_hex) < 320:  # 160 bytes = 320 hex chars
            continue
        try:
            amount0 = _decode_int256(data_hex, 0)
            amount1 = _decode_int256(data_hex, 1)
            sqrt_price_x96 = _decode_uint256(data_hex, 2)
            liquidity = _decode_uint256(data_hex, 3)
            tick = _decode_int256(data_hex, 4)
        except (ValueError, IndexError):
            continue

        rows.append((
            1,  # chain_id
            contract,
            rec["block_number"],
            rec["tx_hash"],
            rec["log_index"],
            rec["sender"],
            rec["recipient"],
            str(amount0),
            str(amount1),
            str(sqrt_price_x96),
            str(liquidity),
            tick,
        ))

    if not rows:
        return 0

    # Batch insert with dedup via ON CONFLICT on the primary key
    insert_sql = (
        "INSERT INTO uniswap_v3.swap_events "
        "(chain_id, pool_id, block, tx_hash, log_index, "
        " sender, recipient, amount0, amount1, sqrt_price_x96, liquidity, tick) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
        "ON CONFLICT (chain_id, pool_id, block, tx_hash, log_index) DO NOTHING"
    )

    total_inserted = 0
    batch_size = 1000
    async with get_conn() as conn:
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            cur = await conn.executemany(insert_sql, batch, returning=False)
            total_inserted += len(batch)
        await conn.commit()

    return total_inserted
