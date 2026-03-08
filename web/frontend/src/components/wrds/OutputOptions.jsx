/**
 * Output options — row limit selector and SQL preview toggle.
 */

const LIMIT_OPTIONS = [100, 1000, 5000, 10000];

export default function OutputOptions({ limit, onLimitChange, showSQL, onToggleSQL }) {
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Row limit</label>
        <div style={{ display: "flex", gap: 4 }}>
          {LIMIT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => onLimitChange(n)}
              className={`btn ${limit === n ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: 12, padding: "4px 12px" }}
            >
              {n.toLocaleString()}
            </button>
          ))}
        </div>
      </div>
      <button
        className={`btn ${showSQL ? "btn-primary" : "btn-ghost"}`}
        style={{ fontSize: 12, padding: "4px 12px" }}
        onClick={onToggleSQL}
      >
        {showSQL ? "Hide SQL" : "View SQL"}
      </button>
    </div>
  );
}
