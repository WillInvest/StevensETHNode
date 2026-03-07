import { useParams, useSearchParams, NavLink } from "react-router-dom";
import { usePoolDetail } from "../../hooks/usePoolDetail";
import SwapsTab from "./tabs/SwapsTab";
import LiquidityTab from "./tabs/LiquidityTab";
import StatsTab from "./tabs/StatsTab";
import QueryTab from "./tabs/QueryTab";

const TABS = [
  { id: "swaps", label: "Swaps" },
  { id: "liquidity", label: "Liquidity" },
  { id: "stats", label: "Stats" },
  { id: "query", label: "Query" },
];

export default function PoolView() {
  const { poolAddress } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "swaps";

  // Extract protocol/version from URL: /explore/dex/uniswap/v3/:address
  const protocol = "uniswap";
  const version = "v3";

  const { data, loading, error } = usePoolDetail(protocol, version, poolAddress);

  function setTab(id) {
    setSearchParams({ tab: id }, { replace: true });
  }

  const meta = data?.metadata;
  const displayName = meta?.display_name ?? poolAddress?.slice(0, 10) + "...";

  const tabBtnStyle = (active) => ({
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? "var(--text-primary)" : "var(--text-muted)",
    background: "none",
    border: "none",
    borderBottom: active ? "2px solid var(--stevens-primary)" : "2px solid transparent",
    padding: "10px 16px 9px",
    cursor: "pointer",
    transition: "color var(--transition-fast)",
  });

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* Pool header */}
      <div style={{ marginBottom: 20 }}>
        {loading && (
          <div style={{ height: 28, width: 200, borderRadius: 6, background: "var(--bg-card)" }} />
        )}
        {error && (
          <div style={{ color: "var(--red)", fontSize: 13 }}>Failed to load pool: {error}</div>
        )}
        {!loading && !error && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
                {displayName}
              </h1>
              {meta?.fee_label && (
                <span style={{
                  fontSize: 12,
                  padding: "2px 8px",
                  borderRadius: 5,
                  background: "rgba(44,62,80,0.5)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                }}>
                  {meta.fee_label}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 20, fontSize: 12, color: "var(--text-muted)" }}>
              <span>
                <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  {poolAddress}
                </code>
              </span>
              {data && (
                <>
                  <span>{data.swap_count?.toLocaleString()} swaps</span>
                  <span>{data.mint_count?.toLocaleString()} mints</span>
                  <span>{data.burn_count?.toLocaleString()} burns</span>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--border-subtle)",
        marginBottom: 20,
      }}>
        {TABS.map(({ id, label }) => (
          <button key={id} style={tabBtnStyle(tab === id)} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === "swaps" && (
          <SwapsTab protocol={protocol} version={version} address={poolAddress} meta={data} />
        )}
        {tab === "liquidity" && (
          <LiquidityTab protocol={protocol} version={version} address={poolAddress} />
        )}
        {tab === "stats" && (
          <StatsTab protocol={protocol} version={version} address={poolAddress} meta={data} />
        )}
        {tab === "query" && (
          <QueryTab address={poolAddress} meta={data} />
        )}
      </div>
    </div>
  );
}
