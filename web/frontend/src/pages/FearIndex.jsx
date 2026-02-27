import { useState, useEffect } from "react";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";

function fearColor(value) {
  if (value == null) return "var(--text-muted)";
  if (value >= 80) return "#ef4444";
  if (value >= 60) return "#f97316";
  if (value >= 40) return "#fbbf24";
  if (value >= 20) return "#34d399";
  return "#22c55e";
}

function fearLabel(value) {
  if (value == null) return "";
  if (value >= 80) return "Extreme Fear";
  if (value >= 60) return "Fear";
  if (value >= 40) return "Neutral";
  if (value >= 20) return "Greed";
  return "Extreme Greed";
}

function FearGauge({ value, size = 220 }) {
  const color = fearColor(value);
  const radius = (size - 20) / 2;
  const circumference = Math.PI * radius; // half circle
  const progress = value != null ? (value / 100) * circumference : 0;

  return (
    <div style={{ position: "relative", width: size, height: size / 2 + 40, margin: "0 auto" }}>
      <svg width={size} height={size / 2 + 20} style={{ overflow: "visible" }}>
        {/* Background arc */}
        <path
          d={`M 10 ${size/2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size/2}`}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={12}
          strokeLinecap="round"
        />
        {/* Gradient stops for the arc */}
        <defs>
          <linearGradient id="fearGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="25%" stopColor="#34d399" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="75%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        {/* Progress arc */}
        <path
          d={`M 10 ${size/2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size/2}`}
          fill="none"
          stroke="url(#fearGradient)"
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div style={{
        position: "absolute",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        textAlign: "center",
      }}>
        <div className="mono" style={{ fontSize: 56, fontWeight: 700, color, lineHeight: 1 }}>
          {value != null ? value.toFixed(0) : "--"}
        </div>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color,
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>
          {fearLabel(value)}
        </div>
      </div>
    </div>
  );
}

export default function FearIndex() {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7d");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/fear-index/current").then((r) => r.ok ? r.json() : null),
      fetch(`/api/fear-index/history?range=${range}`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([cur, hist]) => {
        setCurrent(cur);
        setHistory(hist || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [range]);

  const components = current?.components || {};
  const componentData = [
    { name: "Aave", value: components.aave || 0, color: "#6366f1" },
    { name: "Maker", value: components.maker || 0, color: "#818cf8" },
    { name: "Hyperliquid", value: components.hyperliquid || 0, color: "#a5b4fc" },
    { name: "LP Distribution", value: components.lp_width || 0, color: "#34d399" },
    { name: "Gas Stress", value: components.gas || 0, color: "#fbbf24" },
    { name: "Bridge Flows", value: components.bridge || 0, color: "#22d3ee" },
  ];

  return (
    <div className="fade-in-up">
      <div style={{ marginBottom: 24 }}>
        <h2 className="page-title">Crypto Fear Index</h2>
        <p className="page-subtitle">
          Probability-weighted expected liquidation cascade risk
          {current?.block_number && (
            <> · Block <span className="num">{current.block_number.toLocaleString()}</span></>
          )}
        </p>
      </div>

      {/* Main gauge */}
      <div className="card-accent" style={{ padding: "32px 24px", marginBottom: 24, textAlign: "center" }}>
        <div style={{
          fontSize: 11,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 16,
        }}>
          F = ∫ P(x) · I<sub>cascade</sub>(x) dx
        </div>
        <FearGauge value={current?.value ?? null} />
        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Implied Vol</div>
            <div className="mono num" style={{ fontSize: 18, fontWeight: 600 }}>
              {current?.implied_vol != null ? `${(current.implied_vol * 100).toFixed(1)}%` : "--"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Max Cascade</div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: "var(--red)" }}>
              {current?.max_cascade_depth != null ? `${current.max_cascade_depth.toFixed(1)}%` : "--"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Distribution Skew</div>
            <div className="mono num" style={{ fontSize: 18, fontWeight: 600 }}>
              {current?.distribution_skew != null ? current.distribution_skew.toFixed(3) : "--"}
            </div>
          </div>
        </div>
      </div>

      {/* History chart + Component breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* History */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Historical Fear Index</div>
            <div className="tab-group">
              {["24h", "7d", "30d", "90d"].map((r) => (
                <button
                  key={r}
                  className={`tab-btn ${range === r ? "active" : ""}`}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="fearFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="timestamp"
                  tick={{ fill: "#8888a8", fontSize: 10 }}
                  tickFormatter={(v) => new Date(v * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                />
                <YAxis domain={[0, 100]} tick={{ fill: "#8888a8", fontSize: 10 }} />
                <Tooltip contentStyle={{
                  background: "#13132a",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#eaeaf4",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#6366f1"
                  fill="url(#fearFill)"
                  strokeWidth={2}
                  dot={false}
                  name="Fear Index"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">⚡</div>
              <div className="empty-text">No historical data yet</div>
              <div className="empty-sub">Fear index history will appear as data is computed</div>
            </div>
          )}
        </div>

        {/* Component breakdown */}
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Component Breakdown</div>
          {componentData.map((c) => (
            <div key={c.name} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                <span className="mono num" style={{ fontSize: 12 }}>{c.value.toFixed(1)}</span>
              </div>
              <div className="progress-bar">
                <div style={{
                  height: "100%",
                  width: `${Math.min(c.value, 100)}%`,
                  background: c.color,
                  borderRadius: 3,
                  transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Liquidation heatmap placeholder + link to stress test */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Liquidation Heatmap</div>
          {current?.liquidation_levels ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={current.liquidation_levels}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="price_drop_pct"
                  tick={{ fill: "#8888a8", fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  tick={{ fill: "#8888a8", fontSize: 10 }}
                  tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`}
                />
                <Tooltip contentStyle={{
                  background: "#13132a",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#eaeaf4",
                }} />
                <Bar dataKey="total_liquidation_usd" name="Liquidation Volume" radius={[4, 4, 0, 0]}>
                  {(current.liquidation_levels || []).map((_, i) => (
                    <Cell key={i} fill={`rgba(239, 68, 68, ${0.3 + (i / 10) * 0.7})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: "32px 16px" }}>
              <div className="empty-icon">◈</div>
              <div className="empty-text">Liquidation data loading</div>
              <div className="empty-sub">Scanning Aave, Maker, and Hyperliquid positions</div>
            </div>
          )}
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Cascade Simulator</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{
              fontSize: 48,
              opacity: 0.3,
              marginBottom: 12,
            }}>⚡</div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", marginBottom: 16 }}>
              Interactive what-if cascade simulation.
              <br />Model feedback loops between liquidations and AMM impact.
            </p>
            <a href="/stress-test" className="btn btn-primary" style={{ fontSize: 13 }}>
              Open Stress Test →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
