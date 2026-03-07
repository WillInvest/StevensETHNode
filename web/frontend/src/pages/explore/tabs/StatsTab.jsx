import { useState, useEffect } from "react";

function BarChart({ data, valueKey, labelKey, color, height = 80 }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
        No data
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d[valueKey]));
  if (max === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height, overflow: "hidden" }}>
      {data.map((d, i) => {
        const pct = max > 0 ? (d[valueKey] / max) * 100 : 0;
        return (
          <div
            key={i}
            title={`${d[labelKey]}: ${d[valueKey].toLocaleString()}`}
            style={{
              flex: 1,
              minWidth: 2,
              height: `${Math.max(pct, 2)}%`,
              background: color ?? "var(--stevens-primary)",
              borderRadius: "2px 2px 0 0",
              opacity: 0.85,
              cursor: "default",
              transition: "opacity 100ms",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.85"; }}
          />
        );
      })}
    </div>
  );
}

export default function StatsTab({ protocol, version, address, meta }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);

    fetch(`/api/explore/pool/${protocol}/${version}/${address}/stats?days=${days}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          setStats(json.data ?? null);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [address, protocol, version, days]);

  const labelStyle = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: 8,
  };

  const chartBox = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-subtle)",
    borderRadius: 10,
    padding: "14px 16px",
  };

  const dayBtnStyle = (active) => ({
    fontSize: 11,
    padding: "3px 8px",
    borderRadius: 5,
    border: "1px solid",
    borderColor: active ? "var(--stevens-primary)" : "var(--border-subtle)",
    background: active ? "rgba(44,62,80,0.4)" : "transparent",
    color: active ? "var(--text-primary)" : "var(--text-muted)",
    cursor: "pointer",
  });

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[7, 30, 90].map((d) => (
          <button key={d} style={dayBtnStyle(days === d)} onClick={() => setDays(d)}>
            {d}d
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading stats...</div>
      )}

      {!loading && stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Daily swaps chart */}
          <div style={chartBox}>
            <div style={labelStyle}>Daily Swaps</div>
            <BarChart
              data={stats.daily_swaps}
              valueKey="swap_count"
              labelKey="day"
              color="var(--stevens-primary)"
              height={100}
            />
            {stats.daily_swaps.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                Total: {stats.daily_swaps.reduce((s, d) => s + d.swap_count, 0).toLocaleString()} swaps
              </div>
            )}
          </div>

          {/* Daily mints chart */}
          <div style={chartBox}>
            <div style={labelStyle}>Daily Mints / Burns</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "var(--green)", display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--green)", display: "inline-block" }} />
                Mints
              </span>
              <span style={{ fontSize: 11, color: "var(--red)", display: "flex", alignItems: "center", gap: 3, marginLeft: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--red)", display: "inline-block" }} />
                Burns
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <BarChart
                data={stats.daily_liquidity}
                valueKey="mints"
                labelKey="day"
                color="var(--green)"
                height={80}
              />
            </div>
            {stats.daily_liquidity.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                {stats.daily_liquidity.reduce((s, d) => s + d.mints, 0).toLocaleString()} mints &middot;{" "}
                {stats.daily_liquidity.reduce((s, d) => s + d.burns, 0).toLocaleString()} burns
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && !stats && (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No stats available.</div>
      )}
    </div>
  );
}
