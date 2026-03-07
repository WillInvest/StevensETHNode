import { useState, useEffect } from "react";

function formatBytes(bytes) {
  if (bytes > 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes > 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  return (bytes / 1e3).toFixed(0) + " KB";
}

export default function Monitoring() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/monitoring/status")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fade-in-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 className="page-title">System Monitor</h2>
          <p className="page-subtitle">
            {loading ? (
              <span className="loading-pulse">Refreshing...</span>
            ) : (
              "Infrastructure health and resource usage"
            )}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={loading} style={{ fontSize: 12 }}>
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {data && (
        <>
          {/* Status cards */}
          <div className="stagger-children" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            <div className="card stat-card">
              <div className="stat-label">Database Size</div>
              <div className="stat-value" style={{ color: "var(--text-accent)" }}>
                {data.db.size_mb} <span style={{ fontSize: 14, color: "var(--text-muted)" }}>MB</span>
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Erigon Status</div>
              <div className="stat-value" style={{
                color: data.erigon.healthy ? "var(--green)" : "var(--red)",
                fontSize: 22,
              }}>
                {data.erigon.healthy ? "Healthy" : "Down"}
              </div>
              {data.erigon.syncing && (
                <div className="stat-sub" style={{ color: "var(--amber)" }}>Syncing...</div>
              )}
            </div>
            <div className="card stat-card">
              <div className="stat-label">Chain Head</div>
              <div className="stat-value num" style={{ fontSize: 20 }}>
                {data.erigon.chain_head ? data.erigon.chain_head.toLocaleString() : "--"}
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Indexer Lag</div>
              <div className="stat-value" style={{
                color: data.indexer_lag > 1000 ? "var(--red)" : data.indexer_lag > 100 ? "var(--amber)" : "var(--green)",
              }}>
                {data.indexer_lag != null ? data.indexer_lag.toLocaleString() : "--"}
              </div>
              <div className="stat-sub">blocks behind</div>
            </div>
          </div>

          {/* Table sizes */}
          <div className="card-static">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ opacity: 0.5 }}>◫</span> Table Sizes
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Schema</th>
                    <th>Table</th>
                    <th style={{ textAlign: "right" }}>Rows</th>
                    <th style={{ textAlign: "right" }}>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tables.map((t) => (
                    <tr key={`${t.schema}.${t.table}`}>
                      <td style={{ color: "var(--text-muted)" }}>{t.schema}</td>
                      <td style={{ fontWeight: 500 }}>{t.table}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="num">{t.row_count.toLocaleString()}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>{formatBytes(t.size_bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Loading skeleton */}
      {!data && loading && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {[1,2,3,4].map((i) => (
              <div key={i} className="card-static stat-card">
                <div className="skeleton" style={{ width: 60, height: 10, margin: "0 auto 10px" }} />
                <div className="skeleton" style={{ width: 80, height: 26, margin: "0 auto" }} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
