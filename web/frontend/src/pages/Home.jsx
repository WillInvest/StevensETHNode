import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

function StatCard({ value, label, color, delay = 0 }) {
  return (
    <div className="card stat-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || "var(--text-accent)" }}>
        {value}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      <td><div className="skeleton" style={{ width: 60, height: 14 }} /></td>
      <td><div className="skeleton" style={{ width: 140, height: 14 }} /></td>
      <td style={{ textAlign: "right" }}><div className="skeleton" style={{ width: 80, height: 14, marginLeft: "auto" }} /></td>
    </tr>
  );
}

export default function Home() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/tables")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setTables(data.tables))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalRows = tables.reduce((sum, t) => sum + (t.row_count || 0), 0);
  const schemas = [...new Set(tables.map((t) => t.schema))];

  return (
    <div className="fade-in-up">
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h2 className="page-title">Database Overview</h2>
        <p className="page-subtitle">
          {loading ? (
            <span className="loading-pulse">Scanning tables...</span>
          ) : (
            <>
              <span className="num">{tables.length}</span> tables across{" "}
              <span className="num">{schemas.length}</span> schemas
              {" · "}
              <span className="num">{totalRows.toLocaleString()}</span> total rows
            </>
          )}
        </p>
      </div>

      {error && (
        <div className="card-static" style={{
          borderColor: "rgba(248, 113, 113, 0.3)",
          marginBottom: 20,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{ color: "var(--red)", fontSize: 16 }}>!</span>
          <span style={{ color: "var(--red)", fontSize: 13 }}>{error}</span>
        </div>
      )}

      {/* Stat cards */}
      {!loading && !error && (
        <>
          <div className="stagger-children" style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            marginBottom: 28,
          }}>
            <StatCard value={tables.length} label="Tables" />
            <StatCard value={schemas.length} label="Schemas" color="var(--cyan)" />
            <StatCard value={totalRows.toLocaleString()} label="Total Rows" color="var(--green)" />
            <Link to="/data" style={{ textDecoration: "none" }}>
              <div className="card stat-card" style={{ height: "100%" }}>
                <div className="stat-label">Explore</div>
                <div className="stat-value" style={{ color: "var(--accent)", fontSize: 24 }}>→</div>
              </div>
            </Link>
          </div>

          {/* Quick links */}
          <div style={{
            display: "flex",
            gap: 8,
            marginBottom: 24,
            flexWrap: "wrap",
          }}>
            <Link to="/query" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <span style={{ opacity: 0.6 }}>⌘</span> SQL Editor
            </Link>
            <Link to="/mempool" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <span style={{ opacity: 0.6 }}>◉</span> Mempool
            </Link>
            <Link to="/sci" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <span style={{ opacity: 0.6 }}>◆</span> SCI Dashboard
            </Link>
            <Link to="/fear-index" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <span style={{ opacity: 0.6 }}>⚡</span> Fear Index
            </Link>
            <Link to="/extraction" className="btn btn-ghost" style={{ fontSize: 12 }}>
              <span style={{ opacity: 0.6 }}>⇣</span> Extraction
            </Link>
          </div>

          {/* Table listing grouped by schema */}
          {schemas.map((schema) => {
            const schemaTables = tables.filter((t) => t.schema === schema);
            return (
              <div key={schema} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <span style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    background: schema === "public" ? "var(--accent)" : "var(--green)",
                  }} />
                  {schema}
                  <span style={{ fontSize: 10, fontWeight: 400 }}>
                    ({schemaTables.length} tables)
                  </span>
                </div>
                <div style={{
                  overflowX: "auto",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-card)",
                }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Table</th>
                        <th style={{ textAlign: "right" }}>Rows</th>
                        <th style={{ textAlign: "right", width: 80 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {schemaTables.map((t) => (
                        <tr key={`${t.schema}.${t.table}`}>
                          <td style={{ fontWeight: 500 }}>
                            <Link to={`/browse/${t.schema}/${t.table}`}>
                              {t.table}
                            </Link>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span className="num">
                              {t.row_count != null ? t.row_count.toLocaleString() : "—"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Link
                              to={`/browse/${t.schema}/${t.table}`}
                              className="btn btn-ghost"
                              style={{ fontSize: 11, padding: "2px 10px" }}
                            >
                              Browse
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            marginBottom: 28,
          }}>
            {[1,2,3,4].map((i) => (
              <div key={i} className="card-static stat-card">
                <div className="skeleton" style={{ width: 50, height: 10, margin: "0 auto 10px" }} />
                <div className="skeleton" style={{ width: 80, height: 28, margin: "0 auto" }} />
              </div>
            ))}
          </div>
          <div style={{
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-card)",
            overflow: "hidden",
          }}>
            <table className="data-table">
              <thead>
                <tr><th>Table</th><th>Schema</th><th>Rows</th></tr>
              </thead>
              <tbody>
                {[1,2,3,4,5].map((i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
