import { NavLink } from "react-router-dom";

const styles = {
  groupHeader: (isOpen) => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px 5px 32px",
    cursor: "pointer",
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--sidebar-text)",
    userSelect: "none",
    borderRadius: 6,
    transition: "background var(--transition-fast)",
    background: isOpen ? "var(--sidebar-item-hover)" : "transparent",
    borderLeft: "2px solid",
    borderLeftColor: isOpen ? "var(--cyber-cyan)" : "transparent",
    marginLeft: -2,
  }),
  chevron: (open) => ({
    fontSize: 9,
    opacity: 0.5,
    transform: open ? "rotate(90deg)" : "rotate(0deg)",
    transition: "transform 150ms ease",
    flexShrink: 0,
  }),
  poolCount: {
    fontSize: 10,
    padding: "1px 6px",
    borderRadius: 3,
    background: "rgba(255,255,255,0.06)",
    color: "var(--sidebar-text-muted)",
    marginLeft: "auto",
    flexShrink: 0,
  },
  poolLink: {
    display: "block",
    padding: "3px 12px 3px 54px",
    fontSize: 12,
    color: "var(--sidebar-text-muted)",
    textDecoration: "none",
    borderRadius: 6,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    transition: "background var(--transition-fast)",
  },
  poolContent: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  feeBadge: {
    fontSize: 10,
    padding: "1px 5px",
    borderRadius: 3,
    background: "rgba(52, 152, 219, 0.12)",
    color: "var(--cyber-cyan)",
    flexShrink: 0,
    fontWeight: 500,
  },
  poolAddress: {
    fontSize: 11,
    color: "var(--sidebar-text-muted)",
    opacity: 0.6,
    fontFamily: "monospace",
    flexShrink: 0,
  },
};

/**
 * Renders a collapsible group of pools with the same pair.
 *
 * @param {Object} props
 * @param {string} props.pairName - Name of the pair (e.g., "USDC/WETH")
 * @param {Array} props.pools - Array of pool objects in this group
 * @param {string} props.protocol - Protocol ID (for navigation)
 * @param {string} props.version - Version ID (for navigation)
 * @param {boolean} props.isOpen - Whether the group is expanded
 * @param {Function} props.onToggle - Callback: () => void
 * @param {string} props.activePoolAddress - Currently active pool address (for highlighting)
 */
export default function PoolGroup({
  pairName,
  pools,
  protocol,
  version,
  isOpen,
  onToggle,
  activePoolAddress,
}) {
  if (!pools || pools.length === 0) return null;

  return (
    <div>
      <div
        style={{
          ...styles.groupHeader(isOpen),
        }}
        onClick={onToggle}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.background = "var(--sidebar-item-hover)";
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={styles.chevron(isOpen)}>▶</span>
        <span>{pairName}</span>
        <span style={styles.poolCount}>{pools.length}</span>
      </div>

      {isOpen && (
        <div>
          {pools.map((pool) => (
            <NavLink
              key={pool.pool_address}
              to={`/explore/dex/${protocol}/${version}/${pool.pool_address}`}
              style={({ isActive }) => ({
                ...styles.poolLink,
                background: isActive ? "var(--sidebar-item-active)" : "transparent",
                color: isActive ? "var(--sidebar-text-active)" : "var(--sidebar-text-muted)",
                fontWeight: isActive ? 600 : 400,
              })}
              title={pool.pool_address}
            >
              <div style={styles.poolContent}>
                {pool.fee_label && (
                  <span style={styles.feeBadge}>
                    {pool.fee_label}
                  </span>
                )}
                <span style={styles.poolAddress}>
                  {pool.pool_address.slice(0, 6)}…{pool.pool_address.slice(-4)}
                </span>
              </div>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
