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

function scoreLabel(score) {
  if (score == null) return "";
  if (score >= 70) return "High Activity";
  if (score >= 50) return "Elevated";
  if (score >= 30) return "Normal";
  return "Suppressed";
}

function ComponentCard({ label, score, weight, icon }) {
  const color = scoreColor(score);
  return (
    <div className="card stat-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 12, opacity: 0.5 }}>{icon}</span>
        <span className="stat-label" style={{ margin: 0 }}>{label}</span>
      </div>
      <div className="stat-value" style={{ color, fontSize: 32 }}>
        {score != null ? score.toFixed(1) : "--"}
      </div>
      <div className="stat-sub">
        weight: {(weight * 100).toFixed(0)}%
      </div>
    </div>
  );
}

function GaugeRing({ score, size = 180 }) {
  const color = scoreColor(score);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score != null ? (score / 100) * circumference : 0;

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={8}
        />
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.5s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div className="mono" style={{ fontSize: 48, fontWeight: 700, color, lineHeight: 1 }}>
          {score != null ? score.toFixed(1) : "--"}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {scoreLabel(score)}
        </div>
      </div>
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
    { key: "dex_score", label: "DEX Activity", weight: 0.25, icon: "◈" },
    { key: "lending_score", label: "Lending", weight: 0.20, icon: "◫" },
    { key: "liquidation_score", label: "Liquidation", weight: 0.15, icon: "⚡" },
    { key: "gas_score", label: "Gas Market", weight: 0.15, icon: "◉" },
    { key: "network_score", label: "Network", weight: 0.15, icon: "◎" },
    { key: "bridge_score", label: "Bridge", weight: 0.10, icon: "⇄" },
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
        <h2 className="page-title">Stevens Crypto Index</h2>
        <p className="page-subtitle">
          <span className={`status-dot ${connected ? "connected" : "disconnected"}`} />
          {connected ? "Live — updating every 30s" : "Connecting..."}
          {data && data.block_num && (
            <> · Block <span className="num">{data.block_num.toLocaleString()}</span></>
          )}
        </p>
      </div>

      {/* Large SCI Gauge */}
      <div className="card-accent" style={{
        textAlign: "center",
        marginBottom: 24,
        padding: "32px 24px",
      }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Composite SCI Score
        </div>
        <GaugeRing score={data && !data.error ? data.sci_score : null} />
      </div>

      {/* Component Cards */}
      <div className="stagger-children" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        {components.map((c) => (
          <ComponentCard
            key={c.key}
            label={c.label}
            icon={c.icon}
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
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ opacity: 0.5 }}>◈</span> Component Breakdown
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#8888a8", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#4d4d6a", fontSize: 9 }} />
                <Radar
                  dataKey="value"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* History line chart */}
        {history.length > 0 && (
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ opacity: 0.5 }}>◫</span> 30-Day History
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="block_num"
                  tick={{ fill: "#8888a8", fontSize: 10 }}
                  tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`}
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
                <Line type="monotone" dataKey="sci_score" stroke="#6366f1" strokeWidth={2} dot={false} name="SCI" />
                <Line type="monotone" dataKey="dex_score" stroke="#34d399" strokeWidth={1} dot={false} name="DEX" />
                <Line type="monotone" dataKey="gas_score" stroke="#fbbf24" strokeWidth={1} dot={false} name="Gas" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
