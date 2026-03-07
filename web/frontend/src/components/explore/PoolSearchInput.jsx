import { useState } from "react";

const styles = {
  container: {
    padding: "8px 12px",
    marginBottom: 4,
  },
  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  input: {
    flex: 1,
    padding: "6px 8px",
    fontSize: 12,
    fontFamily: "monospace",
    background: "var(--sidebar-bg)",
    border: "1px solid var(--sidebar-border)",
    borderRadius: 6,
    color: "var(--sidebar-text)",
    outline: "none",
    transition: "all var(--transition-fast)",
  },
  inputFocus: {
    borderColor: "var(--cyber-cyan)",
    boxShadow: "0 0 8px rgba(34, 211, 238, 0.2)",
  },
  clearButton: {
    position: "absolute",
    right: 6,
    background: "none",
    border: "none",
    color: "var(--sidebar-text-muted)",
    cursor: "pointer",
    padding: 2,
    fontSize: 14,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.6,
    transition: "opacity var(--transition-fast)",
  },
  clearButtonHover: {
    opacity: 1,
  },
  resultsBadge: {
    fontSize: 10,
    color: "var(--sidebar-text-muted)",
    whiteSpace: "nowrap",
    padding: "2px 4px",
  },
};

/**
 * Search input component for filtering pools.
 * Emits onChange events with the search query string.
 *
 * @param {Object} props
 * @param {string} props.value - Current search query
 * @param {Function} props.onChange - Callback: (searchQuery) => void
 * @param {number} props.filteredCount - Number of pools matching the query
 * @param {number} props.totalCount - Total number of pools
 */
export default function PoolSearchInput({
  value = "",
  onChange = () => {},
  filteredCount = 0,
  totalCount = 0,
}) {
  const [focused, setFocused] = useState(false);
  const [clearHovered, setClearHovered] = useState(false);

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const handleClear = () => {
    onChange("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      handleClear();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.inputWrapper}>
        <input
          type="text"
          placeholder="Search pools..."
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            ...styles.input,
            ...(focused && styles.inputFocus),
            paddingRight: value ? 24 : 8,
          }}
        />
        {value && (
          <button
            onClick={handleClear}
            onMouseEnter={() => setClearHovered(true)}
            onMouseLeave={() => setClearHovered(false)}
            style={{
              ...styles.clearButton,
              ...(clearHovered && styles.clearButtonHover),
            }}
            title="Clear search"
            type="button"
          >
            ×
          </button>
        )}
      </div>
      {value && totalCount > 0 && (
        <div style={styles.resultsBadge}>
          {filteredCount} of {totalCount} pools
        </div>
      )}
    </div>
  );
}
