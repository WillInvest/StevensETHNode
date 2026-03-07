import { NavLink, Outlet, useLocation } from "react-router-dom";

const navItems = [
  { to: "/data", label: "Data", icon: "◫" },
  { to: "/query", label: "Query", icon: "⌘" },
];

export default function Layout({ user, onLogout }) {
  const location = useLocation();
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    onLogout();
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <header style={{
        background: "rgba(8, 8, 26, 0.88)",
        backdropFilter: "blur(16px) saturate(1.8)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        gap: 32,
        height: 52,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        {/* Logo */}
        <NavLink to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "linear-gradient(135deg, var(--accent) 0%, #818cf8 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 12px rgba(99, 102, 241, 0.3)",
          }}>
            <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>S</span>
          </div>
          <span style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}>
            Stevens
            <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 5 }}>Blockchain</span>
          </span>
        </NavLink>

        {/* Nav */}
        <nav style={{ display: "flex", gap: 1, flex: 1 }}>
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              style={({ isActive }) => ({
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                fontSize: 12.5,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#fff" : "var(--text-secondary)",
                background: isActive ? "rgba(99, 102, 241, 0.15)" : "transparent",
                textDecoration: "none",
                transition: "all var(--transition-fast)",
                display: "flex",
                alignItems: "center",
                gap: 5,
                position: "relative",
              })}
            >
              <span style={{ fontSize: 11, opacity: 0.7 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: "rgba(99, 102, 241, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-accent)",
            }}>
              {user.username?.[0]?.toUpperCase() || "U"}
            </div>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{user.username}</span>
            <button
              onClick={handleLogout}
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                background: "none",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                padding: "4px 10px",
                transition: "all var(--transition-fast)",
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = "var(--border-hover)";
                e.target.style.color = "var(--text-secondary)";
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = "var(--border-subtle)";
                e.target.style.color = "var(--text-muted)";
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      {/* Main content */}
      <main style={{
        padding: "28px 32px",
        maxWidth: 1320,
        width: "100%",
        margin: "0 auto",
        flex: 1,
      }}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{
        padding: "16px 32px",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 11,
        color: "var(--text-muted)",
        maxWidth: 1320,
        width: "100%",
        margin: "0 auto",
      }}>
        <span>Stevens Blockchain Analytics</span>
        <span>Ethereum Mainnet · Erigon Archive Node</span>
      </footer>
    </div>
  );
}
