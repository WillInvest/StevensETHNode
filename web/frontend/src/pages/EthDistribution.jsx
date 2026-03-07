import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, ComposedChart, Area,
} from "recharts";

const FEE_OPTIONS = [
  { value: "all", label: "All Fee Tiers" },
  { value: "500", label: "0.05%" },
  { value: "3000", label: "0.3%" },
  { value: "10000", label: "1%" },
];

/* ── WebSocket Hook ───────────────────────────────────────────────── */

function useBlockWebSocket(feeTier) {
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [blockInfo, setBlockInfo] = useState(null);
  const [wsData, setWsData] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/eth-distribution`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus("connected");
        ws.send(JSON.stringify({ fee_tier: feeTier }));
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "tick_update") {
            setBlockInfo({
              number: msg.block_number,
              timestamp: msg.block_timestamp,
              updatedAt: msg.updated_at,
            });
            setWsData(msg.data);
          }
        } catch {}
      };

      ws.onclose = () => {
        setWsStatus("disconnected");
        wsRef.current = null;
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Send updated fee tier when it changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ fee_tier: feeTier }));
    }
  }, [feeTier]);

  return { wsStatus, blockInfo, wsData };
}

/* ── Relative Time Hook ───────────────────────────────────────────── */

function useRelativeTime(timestamp) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!timestamp) { setText(""); return; }
    function update() {
      const secs = Math.floor(Date.now() / 1000 - timestamp);
      if (secs < 5) setText("just now");
      else if (secs < 60) setText(`${secs}s ago`);
      else setText(`${Math.floor(secs / 60)}m ago`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timestamp]);

  return text;
}

/* ── Status Bar ───────────────────────────────────────────────────── */

function StatusBar({ wsStatus, blockInfo, poolAddresses }) {
  const relTime = useRelativeTime(blockInfo?.updatedAt);
  const isLive = wsStatus === "connected";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 12px",
      marginBottom: 16,
      fontSize: 12,
      color: "var(--text-muted)",
      background: "rgba(255,255,255,0.02)",
      borderRadius: "var(--radius-sm)",
      border: "1px solid var(--border-subtle)",
    }}>
      {/* Status dot */}
      <span style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: isLive ? "#34d399" : "#ef4444",
        boxShadow: isLive ? "0 0 6px #34d399" : "none",
        animation: isLive ? "pulse-dot 2s infinite" : "none",
      }} />
      <span style={{ fontWeight: 600, color: isLive ? "#34d399" : "#ef4444" }}>
        {isLive ? "Live" : "Offline"}
      </span>

      {blockInfo?.number != null && (
        <>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
          <span>
            Block{" "}
            <a
              href={`https://etherscan.io/block/${blockInfo.number}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono"
              style={{ color: "#818cf8", textDecoration: "none" }}
            >
              #{blockInfo.number.toLocaleString()}
            </a>
          </span>
        </>
      )}

      {poolAddresses?.length > 0 && (
        <>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
          {poolAddresses.map((addr) => (
            <a
              key={addr}
              href={`https://etherscan.io/address/${addr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono"
              style={{ color: "#818cf8", textDecoration: "none", fontSize: 11 }}
            >
              {addr.slice(0, 6)}...{addr.slice(-4)}
            </a>
          ))}
        </>
      )}

      {relTime && (
        <>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
          <span>Updated {relTime}</span>
        </>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

function formatUsd(v) {
  if (v == null || isNaN(v)) return "$0";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function formatPct(v) {
  if (v == null || isNaN(v)) return "0%";
  return `${(v * 100).toFixed(3)}%`;
}

/* ── Tooltips ──────────────────────────────────────────────────────── */

const ttStyle = {
  background: "#13132a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 12,
  color: "#eaeaf4",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};

function LiquidityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={ttStyle}>
      <div style={{ marginBottom: 4 }}>
        <span style={{ color: "var(--text-muted)" }}>Price: </span>
        <span className="mono">${d.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
      </div>
      <div>
        <span style={{ color: "var(--text-muted)" }}>Liquidity: </span>
        <span className="mono">{formatUsd(d.liquidity_usd)}</span>
      </div>
      {d.is_current_tick && (
        <div style={{ color: "#34d399", marginTop: 4, fontWeight: 600 }}>Current Price Tick</div>
      )}
    </div>
  );
}

function LiqMapTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={ttStyle}>
      <div style={{ marginBottom: 4 }}>
        <span style={{ color: "var(--text-muted)" }}>Price: </span>
        <span className="mono">${d.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
      </div>
      {d.long_liq_usd > 0 && (
        <div>
          <span style={{ color: "#34d399" }}>Long Liqs: </span>
          <span className="mono">{formatUsd(d.long_liq_usd)}</span>
        </div>
      )}
      {d.short_liq_usd > 0 && (
        <div>
          <span style={{ color: "#ef4444" }}>Short Liqs: </span>
          <span className="mono">{formatUsd(d.short_liq_usd)}</span>
        </div>
      )}
    </div>
  );
}

function CascadeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={ttStyle}>
      <div style={{ marginBottom: 4 }}>
        <span style={{ color: "var(--text-muted)" }}>Trigger Price: </span>
        <span className="mono">${d.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
      </div>
      <div>
        <span style={{ color: "#f59e0b" }}>Cascade Loss: </span>
        <span className="mono">{formatUsd(d.cascade_loss_usd)}</span>
      </div>
      {d.cascade_rounds > 0 && (
        <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
          {d.cascade_rounds} rounds → final ${d.final_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */

export default function EthDistribution() {
  const [feeTier, setFeeTier] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // WebSocket for block-by-block updates
  const { wsStatus, blockInfo, wsData } = useBlockWebSocket(feeTier);

  // When WebSocket delivers data, use it as primary source
  useEffect(() => {
    if (wsData) {
      setData(wsData);
      setLoading(false);
      setError(null);
    }
  }, [wsData]);

  // Liquidation map state
  const [liqData, setLiqData] = useState(null);
  const [liqLoading, setLiqLoading] = useState(true);
  const [liqError, setLiqError] = useState(null);

  // Cascade simulator state
  const [cascadeData, setCascadeData] = useState(null);
  const [cascadeLoading, setCascadeLoading] = useState(false);
  const [cascadeError, setCascadeError] = useState(null);

  // Fallback: fetch tick liquidity via REST if WebSocket hasn't delivered data
  useEffect(() => {
    if (wsData) return; // WebSocket already providing data
    setLoading(true);
    setError(null);
    fetch(`/api/eth-distribution/ticks?fee_tier=${feeTier}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [feeTier]);

  // Fetch liquidation map on mount
  useEffect(() => {
    setLiqLoading(true);
    setLiqError(null);
    fetch("/api/eth-distribution/liquidation-map")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setLiqData(d);
      })
      .catch((e) => setLiqError(e.message))
      .finally(() => setLiqLoading(false));
  }, []);

  // Cascade simulation (on-demand)
  const runCascade = useCallback(() => {
    setCascadeLoading(true);
    setCascadeError(null);
    fetch("/api/eth-distribution/cascade-sim")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCascadeData(d);
      })
      .catch((e) => setCascadeError(e.message))
      .finally(() => setCascadeLoading(false));
  }, []);

  // Transform liquidation bars: short_liq_usd becomes negative for downward display
  const liqChartData = liqData?.bars?.map((b) => ({
    ...b,
    short_liq_neg: -(b.short_liq_usd || 0),
  })) || [];

  // Filter cascade bars to only show those with loss > 0
  const cascadeChartData = cascadeData?.bars?.filter((b) => b.cascade_loss_usd > 0) || [];

  return (
    <div className="fade-in-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 className="page-title">ETH Distribution</h2>
          <p className="page-subtitle">
            Uniswap V3 liquidity + Hyperliquid liquidation heatmap
          </p>
        </div>
        <select
          value={feeTier}
          onChange={(e) => setFeeTier(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            padding: "6px 12px",
            fontSize: 13,
            cursor: "pointer",
            outline: "none",
          }}
        >
          {FEE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} style={{ background: "#13132a" }}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Live Status Bar ─────────────────────────────────────── */}
      <StatusBar
        wsStatus={wsStatus}
        blockInfo={blockInfo}
        poolAddresses={data?.pool_addresses}
      />

      {/* ── Summary Stats ───────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-static" style={{ padding: 20 }}>
              <div className="skeleton" style={{ width: 80, height: 10, marginBottom: 12 }} />
              <div className="skeleton" style={{ width: 120, height: 28 }} />
            </div>
          ))}
        </div>
      ) : data && !error ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Current Price</div>
            <div className="stat-value mono">${data.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Liquidity</div>
            <div className="stat-value mono">{formatUsd(data.total_liquidity_usd)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Ticks</div>
            <div className="stat-value mono">{data.tick_count.toLocaleString()}</div>
          </div>
        </div>
      ) : null}

      {/* ── Liquidity Chart ─────────────────────────────────────── */}
      <div className="card" style={{ padding: "20px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, paddingLeft: 8 }}>
          Liquidity by Price
          {data && (
            <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
              {data.fee_label} · ±30% range
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="skeleton" style={{ width: "90%", height: 280, borderRadius: 8 }} />
          </div>
        ) : error ? (
          <div className="empty-state" style={{ padding: "48px 16px" }}>
            <div className="empty-icon">!</div>
            <div className="empty-text">Failed to load distribution data</div>
            <div className="empty-sub">{error}</div>
          </div>
        ) : data && data.ticks.length > 0 ? (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data.ticks} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="price"
                tick={{ fill: "#8888a8", fontSize: 10 }}
                tickFormatter={(v) => `$${v.toLocaleString()}`}
                interval="preserveStartEnd"
                minTickGap={60}
              />
              <YAxis
                tick={{ fill: "#8888a8", fontSize: 10 }}
                tickFormatter={(v) => formatUsd(v)}
                width={72}
              />
              <Tooltip content={<LiquidityTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <ReferenceLine
                x={data.ticks.find((t) => t.is_current_tick)?.price}
                stroke="#34d399"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: "Current Price", position: "insideTopRight", fill: "#34d399", fontSize: 10, fontWeight: 600, dy: 10 }}
              />
              <Bar dataKey="liquidity_usd" name="Liquidity" radius={[2, 2, 0, 0]} maxBarSize={8}>
                {data.ticks.map((tick, i) => (
                  <Cell
                    key={i}
                    fill={tick.is_current_tick ? "#34d399" : "#6366f1"}
                    fillOpacity={tick.is_current_tick ? 1 : 0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state" style={{ padding: "48px 16px" }}>
            <div className="empty-icon">|||</div>
            <div className="empty-text">No liquidity data</div>
            <div className="empty-sub">Tick data will appear once the Erigon node is reachable</div>
          </div>
        )}
      </div>

      {/* ── Pool Details ────────────────────────────────────────── */}
      {data && data.pools && data.pools.length > 1 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.pools.length}, 1fr)`, gap: 14, marginTop: 16 }}>
          {data.pools.map((pool) => (
            <div key={pool.name} className="card-static" style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{pool.name}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
                  ${pool.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {pool.tick_count} ticks
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Liquidation Heatmap ─────────────────────────────────── */}
      <div className="card" style={{ padding: "20px 16px", marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingLeft: 8 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Liquidation Map</span>
            <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
              Hyperliquid ETH Perps · estimated from OI distribution
            </span>
          </div>
          {liqData && (
            <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-muted)" }}>
              <span>OI: <span className="mono" style={{ color: "var(--text-primary)" }}>{formatUsd(liqData.open_interest_usd)}</span></span>
              <span>Funding: <span className="mono" style={{ color: liqData.funding_rate >= 0 ? "#34d399" : "#ef4444" }}>{formatPct(liqData.funding_rate)}</span></span>
              <span>L/S: <span className="mono" style={{ color: "var(--text-primary)" }}>{(liqData.long_ratio * 100).toFixed(1)}% / {(liqData.short_ratio * 100).toFixed(1)}%</span></span>
            </div>
          )}
        </div>

        {liqLoading ? (
          <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="skeleton" style={{ width: "90%", height: 240, borderRadius: 8 }} />
          </div>
        ) : liqError ? (
          <div className="empty-state" style={{ padding: "48px 16px" }}>
            <div className="empty-icon">!</div>
            <div className="empty-text">Failed to load liquidation map</div>
            <div className="empty-sub">{liqError}</div>
          </div>
        ) : liqChartData.length > 0 ? (
          <>
            {/* Legend */}
            <div style={{ display: "flex", gap: 20, paddingLeft: 80, marginBottom: 8, fontSize: 11 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: "#34d399" }} />
                <span style={{ color: "var(--text-muted)" }}>Long Liquidations (upward)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444" }} />
                <span style={{ color: "var(--text-muted)" }}>Short Liquidations (downward)</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={liqChartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }} stackOffset="sign">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="price"
                  tick={{ fill: "#8888a8", fontSize: 10 }}
                  tickFormatter={(v) => `$${v.toLocaleString()}`}
                  interval="preserveStartEnd"
                  minTickGap={60}
                />
                <YAxis
                  tick={{ fill: "#8888a8", fontSize: 10 }}
                  tickFormatter={(v) => formatUsd(Math.abs(v))}
                  width={72}
                />
                <Tooltip content={<LiqMapTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                {liqData && (
                  <ReferenceLine
                    x={liqData.mark_price}
                    stroke="#8b5cf6"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: "Mark", position: "top", fill: "#8b5cf6", fontSize: 10, fontWeight: 600 }}
                  />
                )}
                <Bar dataKey="long_liq_usd" name="Long Liqs" fill="#34d399" fillOpacity={0.8} radius={[2, 2, 0, 0]} maxBarSize={6} />
                <Bar dataKey="short_liq_neg" name="Short Liqs" fill="#ef4444" fillOpacity={0.8} radius={[0, 0, 2, 2]} maxBarSize={6} />
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <div className="empty-state" style={{ padding: "48px 16px" }}>
            <div className="empty-icon">|||</div>
            <div className="empty-text">No liquidation data</div>
            <div className="empty-sub">Hyperliquid API may be unreachable</div>
          </div>
        )}
      </div>

      {/* ── Cascade Simulator ──────────────────────────────────── */}
      <div className="card" style={{ padding: "20px 16px", marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingLeft: 8 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Cascade Liquidation Simulator</span>
            <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
              models feedback-loop liquidation cascades
            </span>
          </div>
          <button
            onClick={runCascade}
            disabled={cascadeLoading}
            className="btn-primary"
            style={{ padding: "6px 16px", fontSize: 12, opacity: cascadeLoading ? 0.6 : 1, cursor: cascadeLoading ? "not-allowed" : "pointer" }}
          >
            {cascadeLoading ? "Simulating..." : cascadeData ? "Re-Simulate" : "Simulate"}
          </button>
        </div>

        {cascadeLoading ? (
          <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="skeleton" style={{ width: "90%", height: 200, borderRadius: 8 }} />
          </div>
        ) : cascadeError ? (
          <div className="empty-state" style={{ padding: "40px 16px" }}>
            <div className="empty-icon">!</div>
            <div className="empty-text">Cascade simulation failed</div>
            <div className="empty-sub">{cascadeError}</div>
          </div>
        ) : cascadeChartData.length > 0 ? (
          <>
            {/* Cascade summary stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 16 }}>
              <div className="card-static" style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Peak Cascade Loss</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: "#f59e0b" }}>
                  {formatUsd(Math.max(...cascadeChartData.map((b) => b.cascade_loss_usd)))}
                </div>
              </div>
              <div className="card-static" style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Max Cascade Rounds</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
                  {Math.max(...cascadeChartData.map((b) => b.cascade_rounds))}
                </div>
              </div>
              <div className="card-static" style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Worst Final Price</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: "#ef4444" }}>
                  ${Math.min(...cascadeChartData.filter((b) => b.final_price > 0).map((b) => b.final_price)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={cascadeChartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="price"
                  tick={{ fill: "#8888a8", fontSize: 10 }}
                  tickFormatter={(v) => `$${v.toLocaleString()}`}
                  interval="preserveStartEnd"
                  minTickGap={60}
                />
                <YAxis
                  tick={{ fill: "#8888a8", fontSize: 10 }}
                  tickFormatter={(v) => formatUsd(v)}
                  width={72}
                />
                <Tooltip content={<CascadeTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                {cascadeData && (
                  <ReferenceLine
                    x={cascadeData.mark_price}
                    stroke="#8b5cf6"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: "Mark", position: "top", fill: "#8b5cf6", fontSize: 10, fontWeight: 600 }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="cascade_loss_usd"
                  name="Cascade Loss"
                  fill="#f59e0b"
                  fillOpacity={0.15}
                  stroke="#f59e0b"
                  strokeWidth={2}
                />
                <Bar dataKey="cascade_loss_usd" name="Cascade Loss" fill="#f59e0b" fillOpacity={0.6} radius={[2, 2, 0, 0]} maxBarSize={6} />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        ) : !cascadeData ? (
          <div className="empty-state" style={{ padding: "40px 16px" }}>
            <div className="empty-icon" style={{ fontSize: 28, opacity: 0.5 }}>~</div>
            <div className="empty-text">Click "Simulate" to run the cascade model</div>
            <div className="empty-sub">
              For each price level, models iterative liquidation cascades using
              Hyperliquid OI and order book depth
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: "40px 16px" }}>
            <div className="empty-icon">|||</div>
            <div className="empty-text">No cascade data</div>
            <div className="empty-sub">No significant cascade risk detected at current OI levels</div>
          </div>
        )}
      </div>
    </div>
  );
}
