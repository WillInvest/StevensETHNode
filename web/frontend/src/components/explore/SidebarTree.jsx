import { NavLink, useParams } from "react-router-dom";
import { useState } from "react";
import { PROTOCOL_REGISTRY } from "../../config/protocolRegistry";
import { useSidebarState } from "../../hooks/useSidebarState";
import { usePoolList } from "../../hooks/usePoolList";
import { filterPoolsByQuery } from "../../utils/poolFilters.js";
import { groupPoolsByPair } from "../../utils/poolGrouping.js";
import PoolSearchInput from "./PoolSearchInput";
import PoolGroup from "./PoolGroup";

const styles = {
  category: {
    marginBottom: 2,
  },
  categoryHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--sidebar-text-muted)",
    userSelect: "none",
    borderRadius: 6,
    transition: "background var(--transition-fast)",
  },
  protocolHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 12px 5px 20px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--sidebar-text)",
    userSelect: "none",
    borderRadius: 6,
    transition: "background var(--transition-fast), color var(--transition-fast)",
  },
  versionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px 4px 32px",
    cursor: "pointer",
    fontSize: 12.5,
    fontWeight: 500,
    color: "var(--sidebar-text)",
    userSelect: "none",
    borderRadius: 6,
    transition: "background var(--transition-fast), color var(--transition-fast)",
  },
  poolLink: {
    display: "block",
    padding: "3px 12px 3px 44px",
    fontSize: 12,
    color: "var(--sidebar-text-muted)",
    textDecoration: "none",
    borderRadius: 6,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    transition: "background var(--transition-fast)",
  },
  badge: {
    fontSize: 10,
    padding: "1px 5px",
    borderRadius: 4,
    background: "rgba(255,255,255,0.08)",
    color: "var(--sidebar-text-muted)",
    marginLeft: "auto",
    flexShrink: 0,
  },
  chevron: (open) => ({
    fontSize: 9,
    opacity: 0.5,
    transform: open ? "rotate(90deg)" : "rotate(0deg)",
    transition: "transform 150ms ease",
    flexShrink: 0,
  }),
  loadingDot: {
    padding: "3px 12px 3px 44px",
    fontSize: 11,
    color: "var(--sidebar-text-muted)",
    opacity: 0.5,
  },
};

function PoolNodes({ protocol, version, versionKey }) {
  const { pools, loading, error } = usePoolList(protocol, version, true);
  const { poolAddress } = useParams();
  const { getSearchQuery, setSearchQuery, togglePoolGroup, isPoolGroupOpen } = useSidebarState();
  const [_dummy, setDummy] = useState(0); // Force re-render when search changes

  const searchQuery = getSearchQuery(versionKey);

  if (loading) return <div style={styles.loadingDot}>loading...</div>;
  if (error) return <div style={{ ...styles.loadingDot, color: "var(--red)" }}>error</div>;
  if (!pools.length) return <div style={styles.loadingDot}>no data</div>;

  // Apply search filter
  const filteredPools = filterPoolsByQuery(pools, searchQuery);

  // Group pools by pair
  const groupedPools = groupPoolsByPair(filteredPools);

  return (
    <div>
      <PoolSearchInput
        value={searchQuery}
        onChange={(query) => {
          setSearchQuery(versionKey, query);
          setDummy((d) => d + 1); // Trigger re-render
        }}
        filteredCount={filteredPools.length}
        totalCount={pools.length}
      />

      {groupedPools.map((group) => {
        const groupKey = `${versionKey}/${group.pairName}`;
        const isOpen = isPoolGroupOpen(groupKey);

        return (
          <PoolGroup
            key={group.pairName}
            pairName={group.pairName}
            pools={group.pools}
            protocol={protocol}
            version={version}
            isOpen={isOpen}
            onToggle={() => togglePoolGroup(groupKey)}
            activePoolAddress={poolAddress}
          />
        );
      })}

      {filteredPools.length === 0 && searchQuery && (
        <div style={styles.loadingDot}>no matches</div>
      )}
    </div>
  );
}

function VersionNode({ protocol, version, nodeKey, isExpanded, toggle }) {
  const open = isExpanded(nodeKey);
  const versionKey = `${protocol}/${version.id}`;

  return (
    <div>
      <div
        style={{
          ...styles.versionHeader,
          background: open ? "var(--sidebar-item-hover)" : "transparent",
        }}
        onClick={() => toggle(nodeKey)}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = "var(--sidebar-item-hover)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={styles.chevron(open)}>▶</span>
        {version.label}
        {version.comingSoon && <span style={styles.badge}>soon</span>}
      </div>
      {open && !version.comingSoon && (
        <PoolNodes protocol={protocol} version={version.id} versionKey={versionKey} />
      )}
    </div>
  );
}

function ProtocolNode({ categoryId, protocol, nodeKey, isExpanded, toggle }) {
  const open = isExpanded(nodeKey);

  if (protocol.comingSoon) {
    return (
      <div style={{ ...styles.protocolHeader, cursor: "default", opacity: 0.45 }}>
        {protocol.label}
        <span style={styles.badge}>soon</span>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          ...styles.protocolHeader,
          background: open ? "var(--sidebar-item-hover)" : "transparent",
        }}
        onClick={() => toggle(nodeKey)}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = "var(--sidebar-item-hover)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={styles.chevron(open)}>▶</span>
        {protocol.label}
      </div>
      {open &&
        protocol.versions?.map((ver) => {
          const vKey = `${nodeKey}/${ver.id}`;
          return (
            <VersionNode
              key={ver.id}
              protocol={protocol.id}
              version={ver}
              nodeKey={vKey}
              isExpanded={isExpanded}
              toggle={toggle}
            />
          );
        })}
    </div>
  );
}

function CategoryNode({ category, isExpanded, toggle }) {
  const open = isExpanded(category.id);

  return (
    <div style={styles.category}>
      <div
        style={{
          ...styles.categoryHeader,
          background: open ? "rgba(255,255,255,0.04)" : "transparent",
        }}
        onClick={() => !category.comingSoon && toggle(category.id)}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={styles.chevron(open)}>▶</span>
        {category.label}
        {category.comingSoon && <span style={styles.badge}>soon</span>}
      </div>
      {open && !category.comingSoon && (
        <div>
          {category.protocols?.map((proto) => {
            const pKey = `${category.id}/${proto.id}`;
            return (
              <ProtocolNode
                key={proto.id}
                categoryId={category.id}
                protocol={proto}
                nodeKey={pKey}
                isExpanded={isExpanded}
                toggle={toggle}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SidebarTree() {
  const { isExpanded, toggle } = useSidebarState();

  return (
    <div style={{ padding: "8px 4px" }}>
      {PROTOCOL_REGISTRY.categories.map((cat) => (
        <CategoryNode
          key={cat.id}
          category={cat}
          isExpanded={isExpanded}
          toggle={toggle}
        />
      ))}
    </div>
  );
}
