import { NavLink, Outlet, useLocation } from "react-router-dom";
import SidebarTree from "../components/explore/SidebarTree";

const SIDEBAR_WIDTH = 240;

function truncateAddress(s) {
  return /^0x[0-9a-fA-F]{40}$/.test(s) ? s.slice(0, 6) + "…" + s.slice(-4) : s;
}

function Breadcrumb() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  // segments[0] is "explore" — crumbs start from index 1
  const rest = segments.slice(1);

  if (!rest.length) return null;

  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
      <NavLink to="/explore" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
        Explore
      </NavLink>
      {rest.map((seg, i) => {
        const to = "/" + segments.slice(0, i + 2).join("/");
        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ opacity: 0.4 }}>/</span>
            <NavLink to={to} style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
              {truncateAddress(seg)}
            </NavLink>
          </span>
        );
      })}
    </nav>
  );
}

export default function ExploreLayout({ user, onLogout }) {
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    onLogout();
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <header style={{
        background: "rgba(8, 8, 26, 0.92)",
        backdropFilter: "blur(16px) saturate(1.8)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        gap: 24,
        height: 48,
        position: "sticky",
        top: 0,
        zIndex: 200,
        flexShrink: 0,
      }}>
        {/* Logo */}
        <NavLink to="/explore" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            background: "linear-gradient(135deg, var(--stevens-primary) 0%, #3a7bd5 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>S</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Stevens
            <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 4 }}>Blockchain</span>
          </span>
        </NavLink>

        {/* Breadcrumb */}
        <div style={{ flex: 1 }}>
          <Breadcrumb />
        </div>

        {/* Back to legacy tools */}
        <NavLink
          to="/data"
          style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", padding: "4px 8px", borderRadius: 6 }}
        >
          Tools
        </NavLink>

        {/* User */}
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{user.username}</span>
            <button
              onClick={handleLogout}
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                background: "none",
                border: "1px solid var(--border-subtle)",
                borderRadius: 6,
                cursor: "pointer",
                padding: "3px 8px",
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      {/* Body: sidebar + content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        <aside style={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
          overflowY: "auto",
          overflowX: "hidden",
          position: "sticky",
          top: 48,
          height: "calc(100vh - 48px)",
        }}>
          {/* Sidebar heading */}
          <div style={{
            padding: "14px 16px 8px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--sidebar-text-muted)",
            borderBottom: "1px solid var(--sidebar-border)",
            marginBottom: 4,
          }}>
            Protocols
          </div>
          <SidebarTree />
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: "auto", background: "var(--bg-primary)" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
