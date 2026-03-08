import { NavLink } from "react-router-dom";
import { PROTOCOL_REGISTRY } from "../../config/protocolRegistry";

const cardStyle = {
  background: "var(--glass-bg)",
  backdropFilter: "var(--glass-blur)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "20px 24px",
  textDecoration: "none",
  display: "block",
  transition: "border-color var(--transition), background var(--transition), box-shadow var(--transition)",
};

export default function ExploreHome() {
  return (
    <div style={{ padding: "32px 36px", maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.01em" }}>
        Explore Protocols
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 32 }}>
        Browse on-chain data indexed from Ethereum mainnet.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {PROTOCOL_REGISTRY.categories.map((cat) => (
          cat.comingSoon ? (
            <div
              key={cat.id}
              style={{ ...cardStyle, opacity: 0.4, cursor: "default" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                  {cat.label}
                </span>
                <span style={{
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.08)",
                  color: "var(--text-muted)",
                }}>
                  coming soon
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {cat.protocols?.map((p) => p.label).join(", ")}
              </p>
            </div>
          ) : (
            <NavLink
              key={cat.id}
              to={`/explore/${cat.id}`}
              style={({ isActive }) => ({
                ...cardStyle,
                borderColor: isActive ? "var(--border-accent)" : "var(--border)",
              })}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-accent)";
                e.currentTarget.style.boxShadow = "var(--accent-glow)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                {cat.label}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {cat.protocols?.filter((p) => !p.comingSoon).map((p) => p.label).join(", ")}
              </p>
            </NavLink>
          )
        ))}
      </div>
    </div>
  );
}
