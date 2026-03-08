/**
 * Step 2 of 3: Version picker.
 * Shows pill buttons for each version of the selected protocol.
 */

export default function VersionPicker({ protocol, onSelect }) {
  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "var(--text-secondary)" }}>
        Select Version
      </h3>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {protocol.versions.map((version) => (
          <button
            key={version.id}
            onClick={() => onSelect(version)}
            className="btn"
            style={{
              padding: "10px 24px",
              fontSize: 15,
              fontWeight: 600,
              border: "1px solid var(--border-subtle)",
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              minWidth: 100,
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
            <span>{version.label}</span>
            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-secondary)" }}>
              {version.datasets.length} dataset{version.datasets.length !== 1 ? "s" : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
