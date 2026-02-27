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

# ---------------------------------------------------------------------------
# Job model
# ---------------------------------------------------------------------------

class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
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
        if j.pool_id == pool_id and j.status == JobStatus.RUNNING:
            raise ValueError(f"Job already running for {pool_id}: {j.job_id}")

    pool = POOLS[pool_id]
    rpc_url = os.environ.get("ERIGON_RPC_URL", "http://127.0.0.1:8545")

    if end_block is None:
        end_block = await get_chain_head()

    start_block = pool["deploy_block"]
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
    """Wait for Cryo subprocess to finish and update job status."""
    try:
        stdout, stderr = await process.communicate()
        if process.returncode == 0:
            job.status = JobStatus.COMPLETED
        else:
            if job.status != JobStatus.PAUSED:
                job.status = JobStatus.FAILED
            # Cryo may write errors to stdout or stderr
            err_text = stderr.decode("utf-8", errors="replace")
            out_text = stdout.decode("utf-8", errors="replace")
            job.error_message = (err_text or out_text)[-1000:]
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error_message = str(e)
    finally:
        job.finished_at = time.time()
