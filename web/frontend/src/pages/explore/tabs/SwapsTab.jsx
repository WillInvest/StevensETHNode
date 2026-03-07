import { useState, useEffect } from "react";
import TxHashLink from "../../../components/TxHashLink";

const PAGE_SIZE = 50;

function shortAddr(addr) {
  if (!addr) return "—";
  return addr.slice(0, 8) + "..." + addr.slice(-6);
}

function formatAmount(rawAmount, symbol) {
  if (rawAmount == null) return "—";
  const n = BigInt(rawAmount);
  const abs = n < 0n ? -n : n;
  const sign = n < 0n ? "-" : "+";
  // Display in token units with 6 sig figs (no price conversion)
  const whole = abs / BigInt(1e18.toString());
  return `${sign}${Number(whole).toLocaleString()} ${symbol ?? ""}`.trim();
}

export default function SwapsTab({ protocol, version, address, meta }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setOffset(0);
  }, [address]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);

    fetch(`/api/explore/pool/${protocol}/${version}/${address}/events?event_type=swaps&limit=${PAGE_SIZE}&offset=${offset}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setRows(json.data ?? []);
        setTotal(json.meta?.total ?? 0);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [address, protocol, version, offset]);

  const token0 = meta?.metadata?.token0_symbol ?? "T0";
  const token1 = meta?.metadata?.token1_symbol ?? "T1";
  const pages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

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
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {loading ? "Loading..." : `${total.toLocaleString()} total swaps`}
        </span>
        {pages > 1 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              style={paginationBtn(offset === 0)}
            >
              Prev
            </button>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {currentPage} / {pages}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              style={paginationBtn(offset + PAGE_SIZE >= total)}
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={thStyle}>Block</th>
              <th style={thStyle}>Tx</th>
              <th style={thStyle}>{token0} Amount</th>
              <th style={thStyle}>{token1} Amount</th>
              <th style={thStyle}>Tick</th>
              <th style={thStyle}>Sender</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                <td style={tdStyle}>{row.block?.toLocaleString()}</td>
                <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  <TxHashLink hash={row.tx_hash} />
                </td>
                <td style={{ ...tdStyle, color: Number(row.amount0) < 0 ? "var(--red)" : "var(--green)" }}>
                  {row.amount0}
                </td>
                <td style={{ ...tdStyle, color: Number(row.amount1) < 0 ? "var(--red)" : "var(--green)" }}>
                  {row.amount1}
                </td>
                <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  {row.tick?.toLocaleString()}
                </td>
                <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  {shortAddr(row.sender)}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                  No swap events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function paginationBtn(disabled) {
  return {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 6,
    border: "1px solid var(--border-subtle)",
    background: "transparent",
    color: disabled ? "var(--text-muted)" : "var(--text-secondary)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
  };
}
