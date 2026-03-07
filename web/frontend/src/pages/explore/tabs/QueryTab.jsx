import { useState } from "react";
import TxHashLink from "../../../components/TxHashLink";
import { isTxHash } from "../../../utils/etherscan";

const SCHEMA_HINT = "uniswap_v3";

/**
 * Render a table cell with special handling for transaction hashes
 * Auto-detects tx_hash columns based on name pattern and value format
 */
function renderCell(colName, value) {
  if (!value || value === null) {
    return <span style={{ opacity: 0.3 }}>null</span>;
  }

  // Check if column name suggests it's a tx hash
  const isTxHashCol = /tx_hash|txhash|tx/i.test(colName);

  // Check if value looks like a tx hash
  if (isTxHashCol && isTxHash(value)) {
    return <TxHashLink hash={value} />;
  }

  return String(value);
}

export default function QueryTab({ address, meta }) {
  const poolFilter = address ? `WHERE pool_id = '${address}'` : "";
  const [sql, setSql] = useState(
    `SELECT block, tx_hash, amount0::text, amount1::text, tick\nFROM uniswap_v3.swap_events\n${poolFilter}\nORDER BY block DESC\nLIMIT 50`
  );
  const [rows, setRows] = useState(null);
  const [columns, setColumns] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const runQuery = async () => {
    setRunning(true);
    setError(null);
    setRows(null);

    try {
      const resp = await fetch("/api/query/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      });
      const json = await resp.json();
      if (!resp.ok || json.error) {
        setError(json.error ?? `HTTP ${resp.status}`);
      } else {
        setColumns(json.columns ?? []);
        setRows(json.rows ?? []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const thStyle = {
    padding: "7px 10px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid var(--border-subtle)",
    whiteSpace: "nowrap",
  };
  const tdStyle = {
    padding: "6px 10px",
    fontSize: 12,
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border-subtle)",
    maxWidth: 300,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: "var(--font-mono)",
  };

  return (
    <div>
      <div style={{ marginBottom: 10, fontSize: 12, color: "var(--text-muted)" }}>
        Schema: <code style={{ fontFamily: "var(--font-mono)", color: "var(--text-accent)" }}>{SCHEMA_HINT}</code>
        {address && (
          <span style={{ marginLeft: 12 }}>
            Pool: <code style={{ fontFamily: "var(--font-mono)", color: "var(--text-accent)", fontSize: 11 }}>{address}</code>
          </span>
        )}
      </div>

      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        rows={6}
        style={{
          width: "100%",
          background: "var(--bg-input)",
          border: "1px solid var(--border-default)",
          borderRadius: 8,
          color: "var(--text-primary)",
          fontFamily: "var(--font-mono)",
          fontSize: 12.5,
          padding: "10px 12px",
          resize: "vertical",
          outline: "none",
          marginBottom: 10,
        }}
        spellCheck={false}
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <button
          onClick={runQuery}
          disabled={running}
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "7px 18px",
            borderRadius: 7,
            border: "none",
            background: "var(--stevens-primary)",
            color: "#fff",
            cursor: running ? "not-allowed" : "pointer",
            opacity: running ? 0.7 : 1,
          }}
        >
          {running ? "Running..." : "Run Query"}
        </button>
        {rows !== null && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {rows.length} row{rows.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {error && (
        <div style={{
          padding: "10px 14px",
          borderRadius: 8,
          background: "var(--red-bg)",
          border: "1px solid rgba(255,102,68,0.2)",
          color: "var(--red)",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col} style={thStyle}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                  {columns.map((col) => (
                    <td key={col} style={tdStyle} title={String(row[col] ?? "")}>
                      {renderCell(col, row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
