import { useState } from "react";
import useSSE from "../useSSE";

function gwei(n) {
  return n != null ? n.toFixed(2) : "--";
}

function formatNum(n) {
  return n != null ? n.toLocaleString() : "--";
}

function truncAddr(addr) {
  if (!addr) return "Contract Create";
  return `${addr.slice(0, 8)}\u2026${addr.slice(-6)}`;
}

function GasCard({ label, value, unit, color }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: color || "var(--text-accent)" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{unit}</div>
    </div>
  );
}

function UtilBar({ ratio, label }) {
  const pct = Math.round(ratio * 100);
  const color = pct > 80 ? "var(--red)" : pct > 50 ? "var(--amber)" : "var(--green)";
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Mempool() {
  const { data, connected } = useSSE("/api/mempool/stream");
  const [tab, setTab] = useState("overview");

  if (!data || data.error) {
    return (
      <div className="fade-in-up">
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Mempool</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          <span className={`status-dot ${connected ? "connected" : "disconnected"}`} />
          {data?.error ? `RPC error: ${data.error}` : "Connecting to Erigon..."}
        </p>
      </div>
    );
  }

  const { gas, pending, latest_block, high_value_txs, top_gas_bidders, fee_history, txpool, burn } = data;

  return (
    <div className="fade-in-up">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Mempool</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          <span className={`status-dot ${connected ? "connected" : "disconnected"}`} />
          {connected ? "Live \u00b7 updating every 3s" : "Connecting..."}
          {" \u00b7 "}
          Block <span className="num">{formatNum(data.block_number)}</span>
          {data.syncing && (
            <span style={{ color: "var(--amber)", marginLeft: 8 }}>
              (syncing{data.sync_info ? ` — ${formatNum(data.sync_info.current_block)} / ${formatNum(data.sync_info.highest_block)}` : ""})
            </span>
          )}
        </p>
      </div>

      {/* Gas Station */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <GasCard label="Gas Price" value={gwei(gas.price_gwei)} unit="gwei" />
        <GasCard label="Base Fee" value={gwei(gas.base_fee_gwei)} unit="gwei" color="var(--green)" />
        <GasCard label="Priority Fee" value={gwei(gas.priority_fee_gwei)} unit="gwei" color="var(--amber)" />
        <GasCard label="Next Base Fee" value={gwei(gas.next_base_fee_gwei)} unit="gwei (est.)" color={
          gas.next_base_fee_gwei > gas.base_fee_gwei ? "var(--red)" : "var(--green)"
        } />
      </div>

      {/* Pending Block Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
            {txpool ? "Txpool Total" : "Pending Txs"}
          </div>
          <div className="mono num" style={{ fontSize: 26, fontWeight: 700 }}>
            {txpool ? formatNum(txpool.total) : pending.tx_count}
          </div>
          {txpool && (
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {formatNum(txpool.pending_count)} pending + {formatNum(txpool.queued_count)} queued
            </div>
          )}
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Total Value</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--green)" }}>
            {pending.total_value_eth.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>ETH</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Contract Deploys</div>
          <div className="mono num" style={{ fontSize: 26, fontWeight: 700 }}>{pending.contract_creates}</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Block Utilization</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: latest_block.utilization > 80 ? "var(--red)" : "var(--text-accent)" }}>
            {latest_block.utilization}%
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {formatNum(latest_block.gas_used)} gas
          </div>
        </div>
      </div>

      {/* ETH Burn & Tx Type Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {burn && (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>ETH Burned (latest block)</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--red)" }}>
                {burn.latest_block_eth.toFixed(4)} ETH
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Last 20 Blocks</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--amber)" }}>
                {burn.last_20_blocks_eth.toFixed(4)} ETH
              </div>
            </div>
          </div>
        )}
        {latest_block.tx_types && (
          <div className="card">
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
              Tx Types (block {formatNum(latest_block.number)})
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { label: "EIP-1559", count: latest_block.tx_types.eip1559, color: "var(--text-accent)" },
                { label: "Legacy", count: latest_block.tx_types.legacy, color: "var(--text-muted)" },
                { label: "Blob", count: latest_block.tx_types.blob, color: "var(--green)" },
                { label: "2930", count: latest_block.tx_types.eip2930, color: "var(--amber)" },
              ].filter(t => t.count > 0).map(t => (
                <div key={t.label} style={{ textAlign: "center" }}>
                  <div className="mono num" style={{ fontSize: 18, fontWeight: 700, color: t.color }}>{t.count}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tab buttons */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[
          { key: "overview", label: "Fee History" },
          { key: "whales", label: `Whale Watch (${high_value_txs.length})` },
          { key: "gas_war", label: "Gas Bidders" },
          ...(txpool ? [{ key: "txpool", label: `Txpool (${formatNum(txpool.total)})` }] : []),
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`btn ${tab === key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Fee History */}
      {tab === "overview" && fee_history.length > 0 && (
        <div className="card fade-in">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
            Recent Fee History (last {fee_history.length} blocks)
          </div>

          {/* Gas utilization bars — latest first */}
          <div style={{ marginBottom: 16 }}>
            {[...fee_history].reverse().slice(0, 10).map((b) => (
              <UtilBar key={b.block} ratio={b.gas_used_ratio} label={`Block ${formatNum(b.block)}`} />
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Block</th>
                  <th>Base Fee</th>
                  <th>Burn</th>
                  <th>Gas %</th>
                  <th>P10</th>
                  <th>P25</th>
                  <th>P50</th>
                  <th>P75</th>
                  <th>P90</th>
                </tr>
              </thead>
              <tbody>
                {[...fee_history].reverse().map((b) => (
                  <tr key={b.block}>
                    <td><span className="num">{formatNum(b.block)}</span></td>
                    <td>{gwei(b.base_fee_gwei)}</td>
                    <td style={{ color: "var(--red)", fontSize: 12 }}>{b.burn_eth?.toFixed(4)}</td>
                    <td style={{ color: b.gas_used_ratio > 0.8 ? "var(--red)" : b.gas_used_ratio > 0.5 ? "var(--amber)" : "var(--green)" }}>
                      {Math.round(b.gas_used_ratio * 100)}%
                    </td>
                    <td>{gwei(b.priority_p10_gwei)}</td>
                    <td>{gwei(b.priority_p25_gwei)}</td>
                    <td style={{ fontWeight: 600 }}>{gwei(b.priority_p50_gwei)}</td>
                    <td>{gwei(b.priority_p75_gwei)}</td>
                    <td>{gwei(b.priority_p90_gwei)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Whale Watch */}
      {tab === "whales" && (
        <div className="card fade-in">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
            Pending High-Value Transfers (&gt; 1 ETH)
          </div>
          {high_value_txs.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No high-value transactions in the pending block right now.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tx Hash</th>
                    <th>From</th>
                    <th>To</th>
                    <th style={{ textAlign: "right" }}>Value (ETH)</th>
                    <th style={{ textAlign: "right" }}>Gas Price</th>
                  </tr>
                </thead>
                <tbody>
                  {high_value_txs.map((tx) => (
                    <tr key={tx.hash}>
                      <td>
                        <a href={`https://etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" title={tx.hash}>
                          {tx.hash.slice(0, 10)}&hellip;{tx.hash.slice(-6)}
                        </a>
                      </td>
                      <td>
                        <a href={`https://etherscan.io/address/${tx.from}`} target="_blank" rel="noopener noreferrer" title={tx.from} className="mono">
                          {truncAddr(tx.from)}
                        </a>
                      </td>
                      <td>
                        {tx.to ? (
                          <a href={`https://etherscan.io/address/${tx.to}`} target="_blank" rel="noopener noreferrer" title={tx.to} className="mono">
                            {truncAddr(tx.to)}
                          </a>
                        ) : (
                          <span className="badge badge-pending">Deploy</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="num" style={{ color: tx.value_eth > 100 ? "var(--green)" : "var(--text-accent)" }}>
                          {tx.value_eth.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>{gwei(tx.gas_price_gwei)} gwei</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Gas War — Top Gas Bidders */}
      {tab === "gas_war" && (
        <div className="card fade-in">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
            Top Gas Bidders (highest gas price in pending block)
          </div>
          {top_gas_bidders.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No pending transactions.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tx Hash</th>
                    <th>From</th>
                    <th>To</th>
                    <th style={{ textAlign: "right" }}>Gas Price</th>
                    <th style={{ textAlign: "right" }}>Priority</th>
                    <th style={{ textAlign: "right" }}>Value</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {top_gas_bidders.map((tx, i) => (
                    <tr key={tx.hash}>
                      <td style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                      <td>
                        <a href={`https://etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" title={tx.hash}>
                          {tx.hash.slice(0, 10)}&hellip;{tx.hash.slice(-6)}
                        </a>
                      </td>
                      <td className="mono">
                        <a href={`https://etherscan.io/address/${tx.from}`} target="_blank" rel="noopener noreferrer" title={tx.from}>
                          {truncAddr(tx.from)}
                        </a>
                      </td>
                      <td className="mono">
                        {tx.to ? (
                          <a href={`https://etherscan.io/address/${tx.to}`} target="_blank" rel="noopener noreferrer" title={tx.to}>
                            {truncAddr(tx.to)}
                          </a>
                        ) : (
                          <span className="badge badge-pending">Deploy</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="num" style={{ color: tx.gas_price_gwei > gas.price_gwei * 2 ? "var(--red)" : "var(--text-accent)" }}>
                          {gwei(tx.gas_price_gwei)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>{gwei(tx.priority_gwei)}</td>
                      <td style={{ textAlign: "right" }}>{tx.value_eth > 0 ? tx.value_eth.toFixed(4) : "--"}</td>
                      <td className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{tx.method_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Txpool Deep Dive */}
      {tab === "txpool" && txpool && (
        <div className="fade-in">
          {/* Pool status cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Pending</div>
              <div className="mono num" style={{ fontSize: 26, fontWeight: 700, color: "var(--green)" }}>
                {formatNum(txpool.pending_count)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>ready to execute</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Queued</div>
              <div className="mono num" style={{ fontSize: 26, fontWeight: 700, color: "var(--amber)" }}>
                {formatNum(txpool.queued_count)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>waiting on nonce</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Base Fee Pool</div>
              <div className="mono num" style={{ fontSize: 26, fontWeight: 700 }}>
                {formatNum(txpool.base_fee_count)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>underpaying base fee</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Stuck Txs</div>
              <div className="mono num" style={{ fontSize: 26, fontWeight: 700, color: txpool.stuck_txs > 0 ? "var(--red)" : "var(--text-muted)" }}>
                {formatNum(txpool.stuck_txs)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>nonce gap / queued</div>
            </div>
          </div>

          {/* Top senders */}
          {txpool.top_senders.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
                Top Senders by Pending Volume
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Address</th>
                      <th style={{ textAlign: "right" }}>Pending Txs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txpool.top_senders.map((s, i) => (
                      <tr key={s.address}>
                        <td style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                        <td>
                          <a href={`https://etherscan.io/address/${s.address}`} target="_blank" rel="noopener noreferrer" className="mono" title={s.address}>
                            {truncAddr(s.address)}
                          </a>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="num" style={{ color: s.pending_count > 10 ? "var(--amber)" : undefined }}>
                            {s.pending_count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Nonce gaps */}
          {txpool.nonce_gaps.length > 0 && (
            <div className="card">
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
                Nonce Gaps (stuck accounts)
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Address</th>
                      <th style={{ textAlign: "right" }}>Queued</th>
                      <th>Gap Nonces</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txpool.nonce_gaps.map((g) => (
                      <tr key={g.address}>
                        <td>
                          <a href={`https://etherscan.io/address/${g.address}`} target="_blank" rel="noopener noreferrer" className="mono" title={g.address}>
                            {truncAddr(g.address)}
                          </a>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="num">{g.queued_count}</span>
                        </td>
                        <td className="mono" style={{ fontSize: 11, color: "var(--red)" }}>
                          {g.gap_nonces.join(", ")}{g.gap_nonces.length >= 5 ? "…" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
