import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

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

  return (
    <div className="fade-in-up">
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
          Database Overview
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          {loading ? "Loading..." : (
            <>
              <span className="num">{tables.length}</span> tables
              {" \u00b7 "}
              <span className="num">{totalRows.toLocaleString()}</span> total rows
            </>
          )}
        </p>
      </div>

      {error && (
        <div style={{ color: "var(--red)", marginBottom: 16 }}>Error: {error}</div>
      )}

      {/* Stats cards */}
      {!loading && !error && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
            marginBottom: 28,
          }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-accent)" }}>
                {tables.length}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Tables
              </div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: "var(--green)" }}>
                {totalRows.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Total Rows
              </div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <Link to="/data" style={{ textDecoration: "none" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-accent)" }}>
                  &rarr;
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Explore Data
                </div>
              </Link>
            </div>
          </div>

          {/* Table listing */}
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Schema</th>
                  <th>Table</th>
                  <th style={{ textAlign: "right" }}>Rows</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((t) => (
                  <tr key={`${t.schema}.${t.table}`}>
                    <td style={{ color: "var(--text-muted)" }}>{t.schema}</td>
                    <td>
                      <Link to={`/browse/${t.schema}/${t.table}`}>
                        {t.table}
                      </Link>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="num">
                        {t.row_count != null ? t.row_count.toLocaleString() : "\u2014"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
