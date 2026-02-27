import { useState, useEffect } from "react";
import useSSE from "../useSSE";
import {
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function scoreColor(score) {
  if (score == null) return "var(--text-muted)";
  if (score < 30) return "var(--red)";
  if (score < 60) return "var(--amber)";
  return "var(--green)";
}

function ComponentCard({ label, score, weight }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: scoreColor(score) }}>
        {score != null ? score.toFixed(1) : "--"}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>weight: {(weight * 100).toFixed(0)}%</div>
    </div>
  );
}

export default function SCI() {
  const { data, connected } = useSSE("/api/sci/stream");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch("/api/sci/history?days=30")
      .then((r) => r.json())
      .then(setHistory)
      .catch(() => {});
  }, []);

  const components = [
    { key: "dex_score", label: "DEX Activity", weight: 0.25 },
    { key: "lending_score", label: "Lending", weight: 0.20 },
    { key: "liquidation_score", label: "Liquidation Health", weight: 0.15 },
    { key: "gas_score", label: "Gas Market", weight: 0.15 },
    { key: "network_score", label: "Network Health", weight: 0.15 },
    { key: "bridge_score", label: "Bridge Activity", weight: 0.10 },
  ];

  const radarData = data && !data.error
    ? components.map((c) => ({
        subject: c.label,
        value: data[c.key] || 0,
        fullMark: 100,
      }))
    : [];

  return (
    <div className="fade-in-up">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Stevens Crypto Index</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          <span className={`status-dot ${connected ? "connected" : "disconnected"}`} />
          {connected ? "Live — updating every 30s" : "Connecting..."}
          {data && data.block_num && (
            <> — Block <span className="num">{data.block_num.toLocaleString()}</span></>
          )}
        </p>
      </div>

      {/* Large SCI Score */}
      <div className="card" style={{
        textAlign: "center", marginBottom: 24, padding: 32,
        borderColor: data && !data.error ? scoreColor(data.sci_score) + "40" : undefined,
      }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
          Composite SCI Score
        </div>
        <div className="mono" style={{
          fontSize: 64, fontWeight: 700, lineHeight: 1,
          color: data && !data.error ? scoreColor(data.sci_score) : "var(--text-muted)",
        }}>
          {data && !data.error ? data.sci_score.toFixed(1) : "--"}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          {data && !data.error && data.sci_score >= 60 && "Elevated activity"}
          {data && !data.error && data.sci_score >= 40 && data.sci_score < 60 && "Normal activity"}
          {data && !data.error && data.sci_score < 40 && "Suppressed activity"}
        </div>
      </div>

      {/* Component Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {components.map((c) => (
          <ComponentCard
            key={c.key}
            label={c.label}
            score={data && !data.error ? data[c.key] : null}
            weight={c.weight}
          />
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Radar chart */}
        {radarData.length > 0 && (
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Component Breakdown</div>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#8888a8", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#55556a", fontSize: 9 }} />
                <Radar
                  dataKey="value"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* History line chart */}
        {history.length > 0 && (
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>30-Day History</div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="block_num"
                  tick={{ fill: "#8888a8", fontSize: 10 }}
                  tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`}
                />
                <YAxis domain={[0, 100]} tick={{ fill: "#8888a8", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "#16162a", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, fontSize: 12, color: "#e8e8f0",
                  }}
                />
                <Line type="monotone" dataKey="sci_score" stroke="#6366f1" strokeWidth={2} dot={false} name="SCI" />
                <Line type="monotone" dataKey="dex_score" stroke="#22c55e" strokeWidth={1} dot={false} name="DEX" />
                <Line type="monotone" dataKey="gas_score" stroke="#f59e0b" strokeWidth={1} dot={false} name="Gas" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
