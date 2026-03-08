/**
 * Step 1 of 3: Protocol selector grid.
 * Shows a card per protocol; clicking selects it and advances to version picker.
 */

const PROTOCOL_ICONS = {
  uniswap: "🦄",
  aave: "👻",
  compound: "🏦",
  curve: "🌊",
  lido: "🔷",
  hyperliquid: "⚡",
  bridges: "🌉",
  erc20: "🪙",
};

const CATEGORY_LABELS = {
  dex: "Decentralized Exchange",
  lending: "Lending",
  liquid_staking: "Liquid Staking",
  perps: "Perpetuals",
  bridge: "Bridges",
  tokens: "Tokens",
};

export default function ProtocolGrid({ protocols, onSelect }) {
  const byCategory = protocols.reduce((acc, p) => {
    const cat = p.category ?? "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: "var(--text-secondary)" }}>
        Select a Protocol
      </h3>
      {Object.entries(byCategory).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-tertiary)", marginBottom: 10 }}>
            {CATEGORY_LABELS[cat] ?? cat}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {items.map((protocol) => (
              <button
                key={protocol.id}
                onClick={() => onSelect(protocol)}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 6,
                  padding: "14px 16px",
                  cursor: "pointer",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--surface)",
                  textAlign: "left",
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
                <span style={{ fontSize: 22 }}>{PROTOCOL_ICONS[protocol.id] ?? "📦"}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{protocol.label}</span>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {protocol.versions.length} version{protocol.versions.length !== 1 ? "s" : ""}
                  {" · "}
                  {protocol.versions.reduce((n, v) => n + v.datasets.length, 0)} datasets
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
