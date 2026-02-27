import { useState, useEffect, useCallback } from "react";
import useSSE from "../useSSE";

const styles = {
  heading: { marginBottom: "8px" },
  subtitle: { color: "#666", marginBottom: "24px", fontSize: "14px" },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  },
  card: {
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "20px",
    background: "#fafafa",
  },
  cardTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "4px" },
  contract: {
    fontFamily: "monospace",
    fontSize: "12px",
    color: "#888",
    marginBottom: "12px",
    wordBreak: "break-all",
  },
  meta: { fontSize: "13px", color: "#666", marginBottom: "16px" },
  btn: {
    padding: "8px 20px",
    border: "none",
    borderRadius: "4px",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
  },
  btnDisabled: {
    padding: "8px 20px",
    border: "none",
    borderRadius: "4px",
    background: "#a0a0c0",
    color: "#fff",
    cursor: "not-allowed",
    fontSize: "14px",
    fontWeight: 500,
  },
  progressBar: {
    height: "20px",
    background: "#e0e0e0",
    borderRadius: "10px",
    overflow: "hidden",
    marginBottom: "8px",
  },
  stat: { fontSize: "13px", color: "#444", marginBottom: "4px" },
  error: { color: "red", fontSize: "13px" },
  connDot: (ok) => ({
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: ok ? "#22c55e" : "#ef4444",
    marginRight: "6px",
  }),
};

function progressFill(pct) {
  return {
    height: "100%",
    width: `${Math.min(pct, 100)}%`,
    background: pct >= 100 ? "#22c55e" : "#2563eb",
    borderRadius: "10px",
    transition: "width 0.5s ease",
  };
}

function badge(status) {
  const colors = {
    running: { bg: "#dbeafe", fg: "#1d4ed8" },
    completed: { bg: "#dcfce7", fg: "#166534" },
    failed: { bg: "#fee2e2", fg: "#991b1b" },
    pending: { bg: "#f3f4f6", fg: "#666" },
  };
  const c = colors[status] || colors.pending;
  return {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 600,
    background: c.bg,
    color: c.fg,
  };
}

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

  return (
    <div>
      <h2 style={styles.heading}>Cryo Extraction Dashboard</h2>
      <p style={styles.subtitle}>
        <span style={styles.connDot(connected)} />
        {connected ? "Live updates connected" : "Connecting..."}
        {pools.length > 0 && (
          <span>
            {" "}
            &middot; Chain head: {formatNum(pools[0]?.chain_head)}
          </span>
        )}
      </p>

      {loadError && <p style={styles.error}>Error loading pools: {loadError}</p>}

      <div style={styles.grid}>
        {pools.map((pool) => {
          const job = jobForPool(pool.pool_id);
          const isRunning = job?.status === "running";
          const canStart = !isRunning && starting !== pool.pool_id;

          return (
            <div key={pool.pool_id} style={styles.card}>
              <div style={styles.cardTitle}>{pool.label}</div>
              <div style={styles.contract}>{pool.contract}</div>
              <div style={styles.meta}>
                Deploy block: {formatNum(pool.deploy_block)} | Total blocks:{" "}
                {formatNum(pool.total_blocks)}
              </div>

              <button
                style={canStart ? styles.btn : styles.btnDisabled}
                disabled={!canStart}
                onClick={() => handleStart(pool.pool_id)}
              >
                {starting === pool.pool_id
                  ? "Starting..."
                  : isRunning
                  ? "Running..."
                  : "Start Extraction"}
              </button>

              {job && (
                <div style={{ marginTop: "16px" }}>
                  <div style={{ marginBottom: "6px" }}>
                    <span style={badge(job.status)}>{job.status}</span>
                  </div>
                  <div style={styles.progressBar}>
                    <div style={progressFill(job.percent)} />
                  </div>
                  <div style={styles.stat}>
                    <strong>{job.percent}%</strong> &mdash;{" "}
                    {formatNum(job.completed_chunks)} /{" "}
                    {formatNum(job.expected_chunks)} chunks
                  </div>
                  <div style={styles.stat}>
                    {formatNum(job.completed_blocks)} /{" "}
                    {formatNum(job.total_blocks)} blocks
                  </div>
                  <div style={styles.stat}>
                    Elapsed: {formatDuration(job.elapsed_seconds)}
                    {job.eta_seconds != null && (
                      <>
                        {" "}
                        | ETA: ~{formatDuration(job.eta_seconds)} remaining
                      </>
                    )}
                  </div>
                  {job.error_message && (
                    <div style={{ ...styles.error, marginTop: "8px" }}>
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
