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
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>System Monitoring</h2>
        <button className="btn btn-ghost" onClick={load} disabled={loading} style={{ fontSize: 12 }}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {data && (
        <>
          {/* Status cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Database Size</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: "var(--text-accent)" }}>
                {data.db.size_mb} MB
              </div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Erigon Status</div>
              <div className="mono" style={{
                fontSize: 24, fontWeight: 700,
                color: data.erigon.healthy ? "var(--green)" : "var(--red)",
              }}>
                {data.erigon.healthy ? "Healthy" : "Down"}
              </div>
              {data.erigon.syncing && (
                <div style={{ fontSize: 11, color: "var(--amber)" }}>Syncing</div>
              )}
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Chain Head</div>
              <div className="mono num" style={{ fontSize: 20, fontWeight: 700 }}>
                {data.erigon.chain_head ? data.erigon.chain_head.toLocaleString() : "--"}
              </div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Indexer Lag</div>
              <div className="mono" style={{
                fontSize: 24, fontWeight: 700,
                color: data.indexer_lag > 1000 ? "var(--red)" : data.indexer_lag > 100 ? "var(--amber)" : "var(--green)",
              }}>
                {data.indexer_lag != null ? data.indexer_lag.toLocaleString() : "--"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>blocks behind</div>
            </div>
          </div>

          {/* Table sizes */}
          <div className="card">
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Table Sizes</div>
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
                      <td>{t.table}</td>
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
    </div>
  );
}
