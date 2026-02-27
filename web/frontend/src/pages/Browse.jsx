import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";

const styles = {
  heading: { marginBottom: "4px" },
  meta: { color: "#666", fontSize: "14px", marginBottom: "16px" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
    fontFamily: "monospace",
  },
  th: {
    textAlign: "left",
    padding: "8px 10px",
    borderBottom: "2px solid #e0e0e0",
    fontWeight: 600,
    fontSize: "12px",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "8px 10px",
    borderBottom: "1px solid #f0f0f0",
    maxWidth: "300px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  nav: {
    display: "flex",
    gap: "12px",
    marginTop: "16px",
    alignItems: "center",
  },
  btn: {
    padding: "6px 14px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    background: "#fff",
    cursor: "pointer",
    fontSize: "13px",
  },
  back: {
    color: "#2563eb",
    textDecoration: "none",
    fontSize: "14px",
    marginBottom: "12px",
    display: "inline-block",
  },
  error: { color: "red" },
  loading: { color: "#888" },
};

const PAGE_SIZE = 50;

export default function Browse() {
  const { schema, table } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/browse/${schema}/${table}?limit=${PAGE_SIZE}&offset=${offset}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [schema, table, offset]);

  const goPrev = () =>
    setSearchParams({ offset: Math.max(0, offset - PAGE_SIZE) });
  const goNext = () => setSearchParams({ offset: offset + PAGE_SIZE });

  return (
    <div>
      <Link to="/" style={styles.back}>
        &larr; Back to tables
      </Link>
      <h2 style={styles.heading}>
        {schema}.{table}
      </h2>

      {loading && <p style={styles.loading}>Loading...</p>}
      {error && <p style={styles.error}>Error: {error}</p>}

      {data && (
        <>
          <p style={styles.meta}>
            {data.total.toLocaleString()} rows &middot; showing{" "}
            {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)}
          </p>

          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {data.columns.map((col) => (
                    <th key={col.name} style={styles.th}>
                      {col.name}
                      <br />
                      <span style={{ fontWeight: 400, color: "#999" }}>
                        {col.type}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={i}>
                    {data.columns.map((col) => (
                      <td key={col.name} style={styles.td} title={String(row[col.name] ?? "")}>
                        {row[col.name] != null ? String(row[col.name]) : "null"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.nav}>
            <button
              style={styles.btn}
              onClick={goPrev}
              disabled={offset === 0}
            >
              Previous
            </button>
            <span style={{ fontSize: "13px", color: "#666" }}>
              Page {Math.floor(offset / PAGE_SIZE) + 1} of{" "}
              {Math.ceil(data.total / PAGE_SIZE)}
            </span>
            <button
              style={styles.btn}
              onClick={goNext}
              disabled={offset + PAGE_SIZE >= data.total}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
