/**
 * Step 3 of 3: Dataset selector.
 * Lists available datasets for the selected protocol + version.
 */

export default function DatasetList({ version, onSelect }) {
  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "var(--text-secondary)" }}>
        Select Dataset
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {version.datasets.map((dataset) => (
          <button
            key={dataset.id}
            onClick={() => onSelect(dataset)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              cursor: "pointer",
              textAlign: "left",
              gap: 12,
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.background = "var(--surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-subtle)";
              e.currentTarget.style.background = "var(--surface)";
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{dataset.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{dataset.description}</div>
              {dataset.requiresFilter && (
                <div style={{ fontSize: 11, color: "var(--yellow)", marginTop: 4 }}>
                  ⚠ Large table — filter required before querying
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
              {dataset.table}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
