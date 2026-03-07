const ETHERSCAN = "https://etherscan.io";

const TX_COLUMNS = new Set(["tx_hash", "transaction_hash", "txhash"]);
const ADDR_COLUMNS = new Set(["log_addr", "sender", "recipient", "from", "to", "address", "contract"]);

export function renderCell(colName, value) {
  if (value == null) {
    return <span style={{ color: "var(--text-muted)" }}>null</span>;
  }

  const str = String(value);

  if (TX_COLUMNS.has(colName) && str.startsWith("0x")) {
    return (
      <a
        href={`${ETHERSCAN}/tx/${str}`}
        target="_blank"
        rel="noopener noreferrer"
        title={str}
      >
        {str.slice(0, 10)}&hellip;{str.slice(-8)}
      </a>
    );
  }

  if (ADDR_COLUMNS.has(colName) && str.startsWith("0x") && str.length === 42) {
    return (
      <a
        href={`${ETHERSCAN}/address/${str}`}
        target="_blank"
        rel="noopener noreferrer"
        title={str}
      >
        {str.slice(0, 8)}&hellip;{str.slice(-6)}
      </a>
    );
  }

  return str;
}
