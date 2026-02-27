import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Overview" },
  { to: "/data", label: "Data" },
  { to: "/mempool", label: "Mempool" },
  { to: "/extraction", label: "Extraction" },
  { to: "/query", label: "Query" },
];

export default function Layout() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{
        background: "rgba(10, 10, 20, 0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 28px",
        display: "flex",
        alignItems: "center",
        gap: 40,
        height: 56,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <h1 style={{
          fontSize: 17,
          fontWeight: 700,
          margin: 0,
          letterSpacing: "-0.02em",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 2,
            background: "var(--accent)",
            boxShadow: "0 0 8px var(--accent-glow)",
          }} />
          Stevens Blockchain
        </h1>
        <nav style={{ display: "flex", gap: 4 }}>
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              style={({ isActive }) => ({
                padding: "6px 14px",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                fontWeight: 500,
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                textDecoration: "none",
                transition: "all var(--transition-fast)",
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main style={{
        padding: "28px 32px",
        maxWidth: 1280,
        width: "100%",
        margin: "0 auto",
        flex: 1,
      }}>
        <Outlet />
      </main>
    </div>
  );
}
