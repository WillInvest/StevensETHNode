import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { renderCell } from "../cellRenderer";

export default function Data() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null); // "schema.table"
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

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

  const fetchPreview = (schema, table, sort, dir) => {
    setPreviewLoading(true);
    setPreview(null);
    const params = new URLSearchParams({ limit: "20", offset: "0" });
    if (sort) {
      params.set("sort_by", sort);
      params.set("sort_dir", dir);
    }
    fetch(`/api/browse/${schema}/${table}?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setPreview)
      .catch((e) => setPreview({ error: e.message }))
      .finally(() => setPreviewLoading(false));
  };

  const toggleTable = (schema, table) => {
    const key = `${schema}.${table}`;
    if (expanded === key) {
      setExpanded(null);
      setPreview(null);
      setSortBy(null);
      setSortDir("desc");
      return;
    }
    setExpanded(key);
    // Default sort by "block" desc if the table has that column
    setSortBy("block");
    setSortDir("desc");
    fetchPreview(schema, table, "block", "desc");
  };

  const handleSort = (colName) => {
    if (!expanded) return;
    const [schema, table] = expanded.split(".");
    let newDir = "desc";
    if (sortBy === colName) {
      newDir = sortDir === "desc" ? "asc" : "desc";
    }
    setSortBy(colName);
    setSortDir(newDir);
    fetchPreview(schema, table, colName, newDir);
  };

  const totalRows = tables.reduce((sum, t) => sum + (t.row_count || 0), 0);

  return (
    <div className="fade-in-up">
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
          Data Explorer
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          {loading ? "Loading..." : (
            <>
              <span className="num">{tables.length}</span> tables
              {" \u00b7 "}
              <span className="num">{totalRows.toLocaleString()}</span> total rows
              {" \u00b7 "}
              Click a table to preview rows, click column headers to sort
            </>
          )}
        </p>
      </div>

      {error && (
        <div style={{ color: "var(--red)", marginBottom: 16 }}>Error: {error}</div>
      )}

      {!loading && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tables.map((t) => {
            const key = `${t.schema}.${t.table}`;
            const isExpanded = expanded === key;
            return (
              <div key={key} className="card" style={isExpanded ? { borderColor: "var(--border-accent)" } : {}}>
                {/* Table header row */}
                <div
                  onClick={() => toggleTable(t.schema, t.table)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      borderRadius: "var(--radius-sm)",
                      background: isExpanded ? "var(--accent-glow)" : "rgba(255,255,255,0.04)",
                      color: isExpanded ? "var(--text-accent)" : "var(--text-muted)",
                      fontSize: 12,
                      transition: "all var(--transition-fast)",
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    }}>
                      &#9654;
                    </span>
                    <div>
                      <span className="mono" style={{ fontWeight: 600, fontSize: 14 }}>
                        {t.table}
                      </span>
                      <span style={{ color: "var(--text-muted)", fontSize: 12, marginLeft: 8 }}>
                        {t.schema}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span className="num" style={{ fontSize: 13 }}>
                      {t.row_count != null ? t.row_count.toLocaleString() : "\u2014"} rows
                    </span>
                    <Link
                      to={`/browse/${t.schema}/${t.table}`}
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: "4px 12px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Full view
                    </Link>
                  </div>
                </div>

                {/* Expanded preview */}
                {isExpanded && (
                  <div style={{ marginTop: 16 }} className="fade-in">
                    {previewLoading && (
                      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading preview...</p>
                    )}
                    {preview?.error && (
                      <p style={{ color: "var(--red)", fontSize: 13 }}>Error: {preview.error}</p>
                    )}
                    {preview && !preview.error && (
                      <div style={{ overflowX: "auto", borderRadius: "var(--radius-sm)" }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ width: 40, textAlign: "center" }}>#</th>
                              {preview.columns.map((col) => {
                                const isSorted = sortBy === col.name;
                                return (
                                  <th
                                    key={col.name}
                                    onClick={() => handleSort(col.name)}
                                    style={{ cursor: "pointer", userSelect: "none" }}
                                  >
                                    <span style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                      color: isSorted ? "var(--text-accent)" : undefined,
                                    }}>
                                      {col.name}
                                      {isSorted && (
                                        <span style={{ fontSize: 10 }}>
                                          {sortDir === "desc" ? "\u25BC" : "\u25B2"}
                                        </span>
                                      )}
                                    </span>
                                    <span style={{
                                      display: "block",
                                      fontWeight: 400,
                                      fontSize: 10,
                                      color: "var(--text-muted)",
                                      textTransform: "none",
                                      letterSpacing: 0,
                                    }}>
                                      {col.type}
                                    </span>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.rows.map((row, i) => (
                              <tr key={i}>
                                <td style={{
                                  textAlign: "center",
                                  color: "var(--text-muted)",
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 11,
                                }}>
                                  {i + 1}
                                </td>
                                {preview.columns.map((col) => (
                                  <td key={col.name} title={String(row[col.name] ?? "")}>
                                    {renderCell(col.name, row[col.name])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 12,
                          fontSize: 12,
                          color: "var(--text-muted)",
                        }}>
                          <span>
                            Showing {Math.min(20, preview.rows.length)} of{" "}
                            {preview.total.toLocaleString()} rows
                            {sortBy && (
                              <> &middot; sorted by <span style={{ color: "var(--text-accent)" }}>{sortBy}</span> {sortDir}</>
                            )}
                          </span>
                          <Link
                            to={`/browse/${t.schema}/${t.table}?sort_by=${sortBy || "block"}&sort_dir=${sortDir}`}
                            style={{ fontSize: 12 }}
                          >
                            Browse all rows &rarr;
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
