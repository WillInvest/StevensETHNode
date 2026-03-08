/**
 * WHERE clause builder — add/remove filter rows.
 * Each row: [column ▾] [operator ▾] [value input]
 */

import { useState, useEffect } from "react";

const OPERATORS = ["=", "!=", ">", "<", ">=", "<=", "IS NULL", "IS NOT NULL"];
const STRING_OPS = ["=", "!=", "IS NULL", "IS NOT NULL"];

function newRow() {
  return { id: Math.random(), column: "", op: "=", value: "" };
}

export default function ConditionBuilder({ table, conditions, onChange }) {
  const [columns, setColumns] = useState([]);

  useEffect(() => {
    if (!table) return;
    fetch(`/api/tables/public/${table}/columns`)
      .then((r) => r.json())
      .then((data) => setColumns(data.columns ?? []))
      .catch(() => setColumns([]));
  }, [table]);

  const addRow = () => onChange([...conditions, newRow()]);

  const updateRow = (id, patch) =>
    onChange(conditions.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id) => onChange(conditions.filter((r) => r.id !== id));

  const noValueOps = ["IS NULL", "IS NOT NULL"];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Conditions (WHERE)</label>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "2px 10px" }} onClick={addRow}>
          + Add
        </button>
      </div>
      {conditions.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", padding: "6px 0" }}>
          No conditions — all rows will be returned (up to the row limit).
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {conditions.map((row) => {
          const colMeta = columns.find((c) => c.name === row.column);
          const isStringCol = colMeta && !["integer","bigint","numeric","double precision","real"].includes(colMeta.type);
          const ops = isStringCol ? STRING_OPS : OPERATORS;
          const hideValue = noValueOps.includes(row.op);

          return (
            <div key={row.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {/* Column picker */}
              <select
                value={row.column}
                onChange={(e) => updateRow(row.id, { column: e.target.value, op: "=", value: "" })}
                style={selectStyle}
              >
                <option value="">— column —</option>
                {columns.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>

              {/* Operator picker */}
              <select
                value={row.op}
                onChange={(e) => updateRow(row.id, { op: e.target.value })}
                style={{ ...selectStyle, width: 130 }}
              >
                {ops.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>

              {/* Value input */}
              {!hideValue && (
                <input
                  type="text"
                  placeholder="value"
                  value={row.value}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    background: "var(--surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--text)",
                    fontSize: 13,
                    fontFamily: "var(--font-mono)",
                  }}
                />
              )}

              <button
                onClick={() => removeRow(row.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  fontSize: 16,
                  padding: "0 4px",
                  lineHeight: 1,
                }}
                title="Remove"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const selectStyle = {
  padding: "6px 10px",
  background: "var(--surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  fontSize: 13,
  width: 180,
  fontFamily: "var(--font-mono)",
};
