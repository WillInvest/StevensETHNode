import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, ReferenceLine,
} from "recharts";

function formatUsd(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function StressTest() {
  const [shock, setShock] = useState(10);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [grid, setGrid] = useState([]);

  // Load stress test grid on mount
  useEffect(() => {
    fetch("/api/fear-index/stress-grid")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setGrid(d?.grid || []))
      .catch(() => {});
  }, []);

  const runSimulation = useCallback(() => {
    setLoading(true);
    fetch("/api/fear-index/simulate-cascade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shock_pct: shock }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then(setResult)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shock]);

  const cascadeRounds = result?.liquidation_timeline || [];

  return (
    <div className="fade-in-up">
      <div style={{ marginBottom: 24 }}>
        <h2 className="page-title">Cascade Stress Test</h2>
        <p className="page-subtitle">
          Interactive liquidation cascade simulator with feedback loop modeling
        </p>
      </div>

      {/* Shock slider */}
      <div className="card-accent" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 11,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 12,
            }}>
              Initial Price Shock
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <input
                type="range"
                min={1}
                max={50}
                value={shock}
                onChange={(e) => setShock(Number(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: "var(--accent)",
                  height: 6,
                }}
              />
              <div className="mono" style={{
                fontSize: 32,
                fontWeight: 700,
                color: shock > 20 ? "var(--red)" : shock > 10 ? "var(--amber)" : "var(--text-accent)",
                minWidth: 80,
                textAlign: "right",
              }}>
                -{shock}%
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
              <span>-1%</span>
              <span>-10%</span>
              <span>-25%</span>
              <span>-50%</span>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={runSimulation}
            disabled={loading}
            style={{ padding: "12px 28px", fontSize: 14 }}
          >
            {loading ? "Simulating..." : "Run Cascade"}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="fade-in">
          {/* Summary cards */}
          <div className="stagger-children" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            <div className="card stat-card">
              <div className="stat-label">Final Price Drop</div>
              <div className="stat-value" style={{ color: "var(--red)" }}>
                {result.total_cascade_depth_pct?.toFixed(1)}%
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Cascade Rounds</div>
              <div className="stat-value" style={{ color: "var(--amber)" }}>
                {result.cascade_rounds}
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Total Liquidations</div>
              <div className="stat-value" style={{ color: "var(--text-accent)" }}>
                {formatUsd(result.total_liquidation_volume_usd || 0)}
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Amplification</div>
              <div className="stat-value" style={{
                color: (result.amplification_factor || 1) > 2 ? "var(--red)" : "var(--amber)",
              }}>
                {result.amplification_factor?.toFixed(2)}x
              </div>
              <div className="stat-sub">cascade / initial shock</div>
            </div>
          </div>

          {/* Cascade waterfall */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                Cascade Waterfall
              </div>
              {cascadeRounds.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={cascadeRounds}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="round"
                      tick={{ fill: "#8888a8", fontSize: 10 }}
                      tickFormatter={(v) => `R${v}`}
                    />
                    <YAxis
                      tick={{ fill: "#8888a8", fontSize: 10 }}
                      tickFormatter={(v) => formatUsd(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#13132a",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "#eaeaf4",
                      }}
                      formatter={(v) => formatUsd(v)}
                    />
                    <Bar dataKey="volume" name="Liquidation Volume" radius={[4, 4, 0, 0]}>
                      {cascadeRounds.map((_, i) => (
                        <Cell key={i} fill={`rgba(239, 68, 68, ${0.4 + (i / cascadeRounds.length) * 0.6})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" style={{ padding: "32px 16px" }}>
                  <div className="empty-text">No cascade rounds</div>
                </div>
              )}
            </div>

            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                Price Trajectory
              </div>
              {cascadeRounds.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={cascadeRounds}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="round"
                      tick={{ fill: "#8888a8", fontSize: 10 }}
                      tickFormatter={(v) => `R${v}`}
                    />
                    <YAxis
                      tick={{ fill: "#8888a8", fontSize: 10 }}
                      tickFormatter={(v) => `$${v.toLocaleString()}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#13132a",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "#eaeaf4",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#ef4444" }}
                      name="ETH Price"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" style={{ padding: "32px 16px" }}>
                  <div className="empty-text">Run simulation to see trajectory</div>
                </div>
              )}
            </div>
          </div>

          {/* Protocol breakdown per round */}
          {cascadeRounds.length > 0 && cascadeRounds[0]?.protocol_breakdown && (
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                Protocol Breakdown per Round
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Round</th>
                      <th>Price</th>
                      <th style={{ textAlign: "right" }}>Aave</th>
                      <th style={{ textAlign: "right" }}>Maker</th>
                      <th style={{ textAlign: "right" }}>Hyperliquid</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cascadeRounds.map((r) => (
                      <tr key={r.round}>
                        <td>Round {r.round}</td>
                        <td className="num">${r.price?.toLocaleString()}</td>
                        <td style={{ textAlign: "right" }}>{formatUsd(r.protocol_breakdown?.aave || 0)}</td>
                        <td style={{ textAlign: "right" }}>{formatUsd(r.protocol_breakdown?.maker || 0)}</td>
                        <td style={{ textAlign: "right" }}>{formatUsd(r.protocol_breakdown?.hyperliquid || 0)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{formatUsd(r.volume || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stress test grid */}
      {!result && grid.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            Pre-computed Stress Test Grid
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={grid}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="shock_pct"
                tick={{ fill: "#8888a8", fontSize: 10 }}
                tickFormatter={(v) => `-${v}%`}
              />
              <YAxis
                tick={{ fill: "#8888a8", fontSize: 10 }}
                tickFormatter={(v) => formatUsd(v)}
              />
              <Tooltip
                contentStyle={{
                  background: "#13132a",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#eaeaf4",
                }}
                formatter={(v) => formatUsd(v)}
              />
              <Bar dataKey="total_liquidation_usd" name="Total Liquidations" radius={[4, 4, 0, 0]}>
                {grid.map((entry, i) => (
                  <Cell key={i} fill={`rgba(99, 102, 241, ${0.3 + (i / grid.length) * 0.7})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Empty state when no grid and no result */}
      {!result && grid.length === 0 && !loading && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">⚡</div>
            <div className="empty-text">Set an initial shock and run the cascade simulation</div>
            <div className="empty-sub">
              The simulator models feedback loops between liquidations, AMM price impact, and additional liquidation triggers
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
