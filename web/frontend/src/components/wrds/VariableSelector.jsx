/**
 * Column picker — checkboxes to choose which columns to include in SELECT.
 * Columns are fetched from /api/tables/public/{table}/columns.
 */

import { useState, useEffect } from "react";

export default function VariableSelector({ table, defaultColumns, selected, onChange }) {
  const [allColumns, setAllColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!table) return;
    setLoading(true);
    fetch(`/api/tables/public/${table}/columns`)
      .then((r) => r.json())
      .then((data) => {
        setAllColumns(data.columns ?? []);
        // Initialise selection to defaultColumns (intersected with actual columns)
        const names = (data.columns ?? []).map((c) => c.name);
        const initial = defaultColumns.filter((c) => names.includes(c));
        onChange(initial.length > 0 ? initial : names);
      })
      .catch(() => setAllColumns([]))
      .finally(() => setLoading(false));
  }, [table]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleColumn = (name) => {
    onChange(
      selected.includes(name)
        ? selected.filter((c) => c !== name)
        : [...selected, name]
    );
  };

  const selectAll = () => onChange(allColumns.map((c) => c.name));
  const selectNone = () => onChange([]);

  if (loading) {
    return (
      <div style={{ color: "var(--text-secondary)", fontSize: 13, padding: "8px 0" }}>
        Loading columns…
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Variables ({selected.length} selected)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "2px 8px" }} onClick={selectAll}>
            All
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: "2px 8px" }} onClick={selectNone}>
            None
          </button>
        </div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 4,
        maxHeight: 220,
        overflowY: "auto",
        padding: "8px 4px",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-sm)",
      }}>
        {allColumns.map((col) => (
          <label
            key={col.name}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px", cursor: "pointer", borderRadius: 4 }}
          >
            <input
              type="checkbox"
              checked={selected.includes(col.name)}
              onChange={() => toggleColumn(col.name)}
              style={{ accentColor: "var(--accent)" }}
            />
            <span style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>{col.name}</span>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{col.type}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
