import { isTxHash, getTxUrl } from "../utils/etherscan";

/**
 * TxHashLink - Renders a transaction hash as a clickable link to Etherscan
 *
 * @param {Object} props
 * @param {string} props.hash - The transaction hash to render
 * @param {boolean} [props.fullHash=false] - If true, show full hash; otherwise show shortened (first 8 + last 6)
 * @returns {JSX.Element}
 */
export default function TxHashLink({ hash, fullHash = false }) {
  // If not a valid tx hash, just render plain text
  if (!isTxHash(hash)) {
    return <span style={{ opacity: 0.5 }}>—</span>;
  }

  const url = getTxUrl(hash);
  const displayHash = fullHash ? hash : `${hash.slice(0, 8)}...${hash.slice(-6)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={hash}
      style={{
        color: "var(--text-accent)",
        textDecoration: "none",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        cursor: "pointer",
        transition: "color var(--transition-fast), text-shadow var(--transition-fast)",
        borderBottom: "1px solid rgba(165, 180, 252, 0.3)",
      }}
      onMouseEnter={(e) => {
        e.target.style.color = "var(--cyan)";
        e.target.style.textShadow = "0 0 8px rgba(34, 211, 238, 0.4)";
        e.target.style.borderBottomColor = "rgba(34, 211, 238, 0.6)";
      }}
      onMouseLeave={(e) => {
        e.target.style.color = "var(--text-accent)";
        e.target.style.textShadow = "none";
        e.target.style.borderBottomColor = "rgba(165, 180, 252, 0.3)";
      }}
    >
      {displayHash}
    </a>
  );
}
