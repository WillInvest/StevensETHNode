import { useState, useEffect, useCallback, useRef } from "react";
import useSSE from "../useSSE";

function formatDuration(seconds) {
  if (seconds == null) return "--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatNum(n) {
  return n != null ? n.toLocaleString() : "--";
}

export default function Extraction() {
  const [pools, setPools] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [starting, setStarting] = useState(null);
  const [toggling, setToggling] = useState(null);

  const { data: sseData, connected } = useSSE("/api/extraction/stream");

  useEffect(() => {
    fetch("/api/extraction/pools")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setPools(d.pools))
      .catch((e) => setLoadError(e.message));
  }, []);

  const jobs = sseData?.jobs || [];

  // Refresh pool data (coverage) when a job finishes
  const prevJobStatuses = useRef({});
  useEffect(() => {
    const current = {};
    for (const j of jobs) {
      current[j.job_id] = j.status;
    }
    const needsRefresh = jobs.some(
      (j) =>
        j.status === "completed" &&
        prevJobStatuses.current[j.job_id] &&
        prevJobStatuses.current[j.job_id] !== "completed"
    );
    prevJobStatuses.current = current;
    if (needsRefresh) {
      fetch("/api/extraction/pools")
        .then((r) => r.ok && r.json())
        .then((d) => d && setPools(d.pools))
        .catch(() => {});
    }
  }, [jobs]);

  const jobForPool = useCallback(
    (poolId) => {
      const matching = jobs.filter((j) => j.pool_id === poolId);
      return matching.sort((a, b) => b.created_at - a.created_at)[0] || null;
    },
    [jobs]
  );

  const handleStart = async (poolId) => {
    setStarting(poolId);
    try {
      const resp = await fetch("/api/extraction/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pool_id: poolId }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.detail || "Failed to start extraction");
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setStarting(null);
    }
  };

  const handlePauseResume = async (jobId, action) => {
    setToggling(jobId);
    try {
      const resp = await fetch(`/api/extraction/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(err.detail || `Failed to ${action}`);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="fade-in-up">
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
          Cryo Extraction
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          <span className={`status-dot ${connected ? "connected" : "disconnected"}`} />
          {connected ? "Live updates connected" : "Connecting..."}
          {pools.length > 0 && (
            <span>
              {" \u00b7 "}Chain head: <span className="num">{formatNum(pools[0]?.chain_head)}</span>
            </span>
          )}
        </p>
      </div>

      {loadError && (
        <div style={{ color: "var(--red)", marginBottom: 16 }}>
          Error loading pools: {loadError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {pools.map((pool) => {
          const job = jobForPool(pool.pool_id);
          const isRunning = job?.status === "running";
          const isPaused = job?.status === "paused";
          const isLoading = job?.status === "loading_to_db";
          const isActive = isRunning || isPaused || isLoading;
          const canStart = !isActive && starting !== pool.pool_id;

          return (
            <div key={pool.pool_id} className="card">
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>
                {pool.label}
              </div>
              <div className="mono" style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginBottom: 12,
                wordBreak: "break-all",
              }}>
                {pool.contract}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                Deploy block: <span className="num">{formatNum(pool.deploy_block)}</span>
                {" | "}
                Total blocks: <span className="num">{formatNum(pool.total_blocks)}</span>
              </div>

              {/* DB Coverage indicator */}
              {pool.db_row_count > 0 ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                    DB coverage: block{" "}
                    <span className="num">{formatNum(pool.db_min_block)}</span>
                    {" — "}
                    <span className="num">{formatNum(pool.db_max_block)}</span>
                    {" ("}
                    <span className="num">{formatNum(pool.db_row_count)}</span>
                    {" rows)"}
                  </div>
                  <div style={{
                    height: 4,
                    borderRadius: 2,
                    background: "var(--border)",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min(pool.coverage_pct, 100)}%`,
                      background: "var(--green, #22c55e)",
                      borderRadius: 2,
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {pool.coverage_pct}% of block range covered
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                  No data in database yet
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                {!isActive && (
                  <button
                    className={`btn ${canStart ? "btn-primary" : ""}`}
                    disabled={!canStart}
                    onClick={() => handleStart(pool.pool_id)}
                    style={!canStart ? { background: "var(--text-muted)", cursor: "not-allowed", color: "#fff" } : {}}
                  >
                    {starting === pool.pool_id ? "Starting..." : "Start Extraction"}
                  </button>
                )}
                {isRunning && job && (
                  <button
                    className="btn"
                    disabled={toggling === job.job_id}
                    onClick={() => handlePauseResume(job.job_id, "pause")}
                    style={{
                      background: "var(--amber)",
                      color: "#000",
                      fontWeight: 600,
                    }}
                  >
                    {toggling === job.job_id ? "Pausing..." : "Pause"}
                  </button>
                )}
                {isPaused && job && (
                  <button
                    className="btn btn-primary"
                    disabled={toggling === job.job_id}
                    onClick={() => handlePauseResume(job.job_id, "resume")}
                  >
                    {toggling === job.job_id ? "Resuming..." : "Resume"}
                  </button>
                )}
              </div>

              {job && (
                <div style={{ marginTop: 16 }} className="fade-in">
                  <div style={{ marginBottom: 8 }}>
                    <span className={`badge badge-${job.status}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="progress-bar" style={{ marginBottom: 10 }}>
                    <div
                      className={`progress-fill ${job.percent >= 100 ? "done" : ""}`}
                      style={{
                        width: `${Math.min(job.percent, 100)}%`,
                        ...(isPaused ? { background: "var(--amber)" } : {}),
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                    <strong style={{ color: "var(--text-primary)" }}>{job.percent}%</strong>
                    {" \u2014 "}
                    <span className="num">{formatNum(job.completed_chunks)}</span>
                    {" / "}
                    <span className="num">{formatNum(job.expected_chunks)}</span> chunks
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                    <span className="num">{formatNum(job.completed_blocks)}</span>
                    {" / "}
                    <span className="num">{formatNum(job.total_blocks)}</span> blocks
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    Elapsed: {formatDuration(job.elapsed_seconds)}
                    {job.eta_seconds != null && (
                      <>
                        {" | "}ETA: ~{formatDuration(job.eta_seconds)} remaining
                      </>
                    )}
                  </div>
                  {job.status === "loading_to_db" && (
                    <div style={{
                      fontSize: 13,
                      color: "var(--indigo, #6366f1)",
                      marginTop: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}>
                      <span className="status-dot connected" style={{ animation: "pulse 1.5s infinite" }} />
                      Loading to database...
                    </div>
                  )}
                  {job.loaded_rows != null && job.status === "completed" && (
                    <div style={{
                      fontSize: 13,
                      color: "var(--green, #22c55e)",
                      marginTop: 8,
                    }}>
                      Loaded <span className="num">{formatNum(job.loaded_rows)}</span> rows into database
                    </div>
                  )}
                  {job.error_message && (
                    <div style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>
                      {job.error_message}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
