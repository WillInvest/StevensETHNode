/**
 * Step 4: The actual query form shown after dataset selection.
 * Composes VariableSelector, BlockRangeFilter, ConditionBuilder, OutputOptions.
 * Builds SQL via queryBuilder.js and submits to /api/query/execute.
 */

import { useState } from "react";
import VariableSelector from "./VariableSelector.jsx";
import BlockRangeFilter from "./BlockRangeFilter.jsx";
import ConditionBuilder from "./ConditionBuilder.jsx";
import OutputOptions from "./OutputOptions.jsx";
import { buildSQL } from "../../lib/queryBuilder.js";
import { renderCell } from "../../cellRenderer.jsx";

export default function QueryForm({ dataset, onOpenInSQLEditor }) {
  const [selectedColumns, setSelectedColumns] = useState(dataset.defaultColumns ?? []);
  const [blockRange, setBlockRange] = useState({ min: null, max: null });
  const [conditions, setConditions] = useState([]);
  const [limit, setLimit] = useState(1000);
  const [showSQL, setShowSQL] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const generatedSQL = buildSQL({
    table: dataset.table,
    columns: selectedColumns,
    blockRange,
    conditions,
    limit,
  });

  const hasFilter =
    blockRange.min != null ||
    blockRange.max != null ||
    conditions.some((c) => c.column && (c.value || ["IS NULL", "IS NOT NULL"].includes(c.op)));

  const canSubmit = !dataset.requiresFilter || hasFilter;

  const runQuery = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/query/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: generatedSQL, limit }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.detail || "Query failed");
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const exportResult = (format) => {
    fetch("/api/export/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: generatedSQL, format }),
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${dataset.table}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── Variables ── */}
      <div className="card" style={{ padding: 16 }}>
        <VariableSelector
          table={dataset.table}
          defaultColumns={dataset.defaultColumns ?? []}
          selected={selectedColumns}
          onChange={setSelectedColumns}
        />
      </div>

      {/* ── Block range ── */}
      {dataset.blockColumn && (
        <div className="card" style={{ padding: 16 }}>
          <BlockRangeFilter
            blockColumn={dataset.blockColumn}
            blockRange={blockRange}
            onChange={setBlockRange}
          />
        </div>
      )}

      {/* ── Conditions ── */}
      <div className="card" style={{ padding: 16 }}>
        <ConditionBuilder
          table={dataset.table}
          conditions={conditions}
          onChange={setConditions}
        />
      </div>

      {/* ── Output options ── */}
      <div className="card" style={{ padding: 16 }}>
        <OutputOptions
          limit={limit}
          onLimitChange={setLimit}
          showSQL={showSQL}
          onToggleSQL={() => setShowSQL((v) => !v)}
        />
      </div>

      {/* ── Generated SQL preview ── */}
      {showSQL && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Generated SQL</label>
            {onOpenInSQLEditor && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "2px 10px" }}
                onClick={() => onOpenInSQLEditor(generatedSQL)}
              >
                Open in SQL Editor →
              </button>
            )}
          </div>
          <pre style={{
            background: "rgba(255,255,255,0.03)",
            padding: 12,
            borderRadius: "var(--radius-sm)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            overflowX: "auto",
            margin: 0,
            color: "var(--text-primary)",
          }}>
            {generatedSQL}
          </pre>
        </div>
      )}

      {/* ── Submit ── */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {dataset.requiresFilter && !hasFilter && (
          <span style={{ fontSize: 12, color: "var(--yellow)" }}>
            ⚠ Add at least one filter before querying this table
          </span>
        )}
        <button
          className="btn btn-primary"
          onClick={runQuery}
          disabled={loading || !canSubmit}
          style={{ minWidth: 120 }}
        >
          {loading ? "Running…" : "Get Data"}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="card" style={{ borderColor: "var(--red)", padding: 12 }}>
          <span style={{ color: "var(--red)", fontSize: 13 }}>{error}</span>
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {result.row_count} rows · {result.elapsed_seconds}s
            </span>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => exportResult("csv")}>
              Download CSV
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => exportResult("json")}>
              Download JSON
            </button>
          </div>
          <div style={{ overflowX: "auto", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
            <table className="data-table">
              <thead>
                <tr>
                  {result.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i}>
                    {result.columns.map((col) => (
                      <td key={col} title={String(row[col] ?? "")}>
                        {renderCell(col, row[col])}
                      </td>
                    ))}
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
