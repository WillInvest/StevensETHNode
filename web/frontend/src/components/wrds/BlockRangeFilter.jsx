/**
 * Block range filter — min/max block_num inputs with quick-select shortcuts.
 * Hidden automatically if the dataset has no blockColumn.
 */

const QUICK_RANGES = [
  { label: "Last 1k blocks", value: 1_000 },
  { label: "Last 10k blocks", value: 10_000 },
  { label: "Last 100k blocks", value: 100_000 },
  { label: "Last 1M blocks", value: 1_000_000 },
];

export default function BlockRangeFilter({ blockColumn, blockRange, onChange }) {
  if (!blockColumn) return null;

  const applyQuickRange = async (delta) => {
    try {
      const resp = await fetch("/api/query/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: `SELECT MAX(${blockColumn}) AS tip FROM ${blockColumn}`, limit: 1 }),
      });
      // If the tip lookup fails, just clear — user can type manually.
      const data = await resp.json();
      const tip = data?.rows?.[0]?.tip;
      if (tip) {
        onChange({ min: tip - delta, max: tip });
        return;
      }
    } catch (_) { /* ignore */ }
    // Fallback: just set a relative min, no max
    onChange({ min: null, max: null });
  };

  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>
        Block Range
      </label>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="number"
            placeholder="Min block"
            value={blockRange.min ?? ""}
            onChange={(e) => onChange({ ...blockRange, min: e.target.value ? Number(e.target.value) : null })}
            style={{
              width: 130,
              padding: "6px 10px",
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text)",
              fontSize: 13,
              fontFamily: "var(--font-mono)",
            }}
          />
          <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>–</span>
          <input
            type="number"
            placeholder="Max block"
            value={blockRange.max ?? ""}
            onChange={(e) => onChange({ ...blockRange, max: e.target.value ? Number(e.target.value) : null })}
            style={{
              width: 130,
              padding: "6px 10px",
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text)",
              fontSize: 13,
              fontFamily: "var(--font-mono)",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {QUICK_RANGES.map(({ label, value }) => (
            <button
              key={value}
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: "4px 10px" }}
              onClick={() => applyQuickRange(value)}
            >
              {label}
            </button>
          ))}
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "4px 10px", color: "var(--text-tertiary)" }}
            onClick={() => onChange({ min: null, max: null })}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
