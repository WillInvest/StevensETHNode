import { NavLink } from "react-router-dom";

const navGroups = [
  {
    label: "Markets",
    items: [
      { to: "/pools", label: "Pools Overview", icon: "\u25A6" },
      { to: "/compare", label: "Compare", icon: "\u2261" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { to: "/eth-distribution", label: "ETH Distribution", icon: "\u25A8" },
      { to: "/fear-index", label: "Fear Index", icon: "\u26A1" },
      { to: "/sci", label: "SCI", icon: "\u25C6" },
    ],
  },
  {
    label: "Data",
    items: [
      { to: "/data", label: "Data Explorer", icon: "\u25AB" },
      { to: "/extraction", label: "Extraction", icon: "\u21E3" },
      { to: "/query", label: "SQL Query", icon: "\u2318" },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/mempool", label: "Mempool", icon: "\u25C9" },
      { to: "/monitoring", label: "Monitoring", icon: "\u25CE" },
      { to: "/stress-test", label: "Stress Test", icon: "\u2622" },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-logo" onClick={onToggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        <div className="logo-icon">
          <span>S</span>
        </div>
        {!collapsed && (
          <div className="logo-text">
            Stevens<span className="dim">Blockchain</span>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="sidebar-group-label">{group.label}</div>
            {group.items.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? " active" : ""}`
                }
                title={collapsed ? label : undefined}
              >
                <span className="nav-icon">{icon}</span>
                <span className="nav-label">{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sidebar-collapse-btn"
          onClick={onToggle}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "\u276F" : "\u276E"}
        </button>
      </div>
    </aside>
  );
}
