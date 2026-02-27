import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const styles = {
  heading: { marginBottom: "8px" },
  subtitle: { color: "#666", marginBottom: "24px" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "2px solid #e0e0e0",
    fontWeight: 600,
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #f0f0f0",
  },
  link: {
    color: "#2563eb",
    textDecoration: "none",
  },
  error: { color: "red" },
  loading: { color: "#888" },
};

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
    <div>
      <h2 style={styles.heading}>Database Overview</h2>
      <p style={styles.subtitle}>
        {tables.length} tables, {totalRows.toLocaleString()} total rows
      </p>

      {loading && <p style={styles.loading}>Loading tables...</p>}
      {error && <p style={styles.error}>Error: {error}</p>}

      {!loading && !error && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Schema</th>
              <th style={styles.th}>Table</th>
              <th style={styles.th}>Rows</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr key={`${t.schema}.${t.table}`}>
                <td style={styles.td}>{t.schema}</td>
                <td style={styles.td}>
                  <Link
                    to={`/browse/${t.schema}/${t.table}`}
                    style={styles.link}
                  >
                    {t.table}
                  </Link>
                </td>
                <td style={styles.td}>
                  {t.row_count != null ? t.row_count.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
