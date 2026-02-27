import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const CHART_TYPES = ["Line", "Bar", "Area"];
const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#818cf8"];

export default function QueryChart({ columns, rows }) {
  const [chartType, setChartType] = useState("Line");
  const [xCol, setXCol] = useState(columns[0] || "");
  const [yCols, setYCols] = useState(columns.length > 1 ? [columns[1]] : []);

  if (!columns.length || !rows.length) return null;

  const numericCols = columns.filter((col) =>
    rows.some((r) => typeof r[col] === "number" || !isNaN(Number(r[col])))
  );

  const data = rows.map((row) => {
    const d = { [xCol]: row[xCol] };
    for (const y of yCols) {
      d[y] = Number(row[y]) || 0;
    }
    return d;
  });

  const toggleYCol = (col) => {
    setYCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const ChartComponent = chartType === "Bar" ? BarChart : chartType === "Area" ? AreaChart : LineChart;
  const DataComponent = chartType === "Bar" ? Bar : chartType === "Area" ? Area : Line;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>Chart</label>
          <div style={{ display: "flex", gap: 4 }}>
            {CHART_TYPES.map((t) => (
              <button
                key={t}
                className={`btn ${chartType === t ? "btn-primary" : "btn-ghost"}`}
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => setChartType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>X Axis</label>
          <select
            value={xCol}
            onChange={(e) => setXCol(e.target.value)}
            style={{
              background: "var(--bg-input)", color: "var(--text-primary)",
              border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
              padding: "4px 8px", fontSize: 12, fontFamily: "var(--font-mono)",
            }}
          >
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>Y Axis</label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {numericCols.filter((c) => c !== xCol).map((col) => (
              <button
                key={col}
                className={`btn ${yCols.includes(col) ? "btn-primary" : "btn-ghost"}`}
                style={{ padding: "2px 8px", fontSize: 11 }}
                onClick={() => toggleYCol(col)}
              >
                {col}
              </button>
            ))}
          </div>
        </div>
      </div>

      {yCols.length > 0 && (
        <ResponsiveContainer width="100%" height={350}>
          <ChartComponent data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey={xCol}
              tick={{ fill: "#8888a8", fontSize: 11 }}
              tickFormatter={(v) => String(v).length > 12 ? String(v).slice(0, 12) + "..." : v}
            />
            <YAxis tick={{ fill: "#8888a8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: "#16162a", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, fontSize: 12, color: "#e8e8f0",
              }}
            />
            {yCols.map((col, i) => (
              <DataComponent
                key={col}
                type="monotone"
                dataKey={col}
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={chartType === "Area" ? 0.15 : 0.8}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </ChartComponent>
        </ResponsiveContainer>
      )}
    </div>
  );
}
