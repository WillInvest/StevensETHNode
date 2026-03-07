import { useState, useEffect } from "react";
import TxHashLink from "../../../components/TxHashLink";

const PAGE_SIZE = 50;

function shortAddr(addr) {
  if (!addr) return "—";
  return addr.slice(0, 8) + "..." + addr.slice(-6);
}

function EventsTable({ rows, loading, type }) {
  const thStyle = {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    borderBottom: "1px solid var(--border-subtle)",
    whiteSpace: "nowrap",
  };
  const tdStyle = {
    padding: "7px 12px",
    fontSize: 12,
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border-subtle)",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Block</th>
            <th style={thStyle}>Tx</th>
            <th style={thStyle}>Amount0</th>
            <th style={thStyle}>Amount1</th>
            <th style={thStyle}>Tick Low</th>
            <th style={thStyle}>Tick High</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
              <td style={tdStyle}>{row.block?.toLocaleString()}</td>
              <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                <TxHashLink hash={row.tx_hash} />
              </td>
              <td style={tdStyle}>{row.amount0}</td>
              <td style={tdStyle}>{row.amount1}</td>
              <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{row.tick_lower}</td>
              <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>{row.tick_upper}</td>
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={6} style={{ ...tdStyle, textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                No {type} events found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function EventSection({ protocol, version, address, eventType, label }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setOffset(0); }, [address]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);

    fetch(`/api/explore/pool/${protocol}/${version}/${address}/events?event_type=${eventType}&limit=${PAGE_SIZE}&offset=${offset}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setRows(json.data ?? []);
        setTotal(json.meta?.total ?? 0);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [address, protocol, version, eventType, offset]);

  const pages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
          {label}
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>
            {loading ? "" : total.toLocaleString()}
          </span>
        </h3>
        {pages > 1 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0} style={paginBtn(offset === 0)}>Prev</button>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{currentPage}/{pages}</span>
            <button onClick={() => setOffset(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total} style={paginBtn(offset + PAGE_SIZE >= total)}>Next</button>
          </div>
        )}
      </div>
      <EventsTable rows={rows} loading={loading} type={label} />
    </div>
  );
}

function paginBtn(disabled) {
  return {
    fontSize: 12,
    padding: "3px 8px",
    borderRadius: 6,
    border: "1px solid var(--border-subtle)",
    background: "transparent",
    color: disabled ? "var(--text-muted)" : "var(--text-secondary)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
  };
}

export default function LiquidityTab({ protocol, version, address }) {
  return (
    <div>
      <EventSection
        protocol={protocol}
        version={version}
        address={address}
        eventType="mints"
        label="Mints"
      />
      <EventSection
        protocol={protocol}
        version={version}
        address={address}
        eventType="burns"
        label="Burns"
      />
    </div>
  );
}
