/**
 * Pure utility functions for pool filtering.
 * No side effects, easy to test.
 */

/**
 * Filters pools by a search query.
 * Matches against display_name, token0_symbol, token1_symbol, and fee_label.
 * Case-insensitive, substring matching.
 *
 * @param {Array} pools - Array of pool objects
 * @param {string} query - Search query string
 * @returns {Array} Filtered pools
 */
export function filterPoolsByQuery(pools, query) {
  if (!query || !query.trim()) return pools;

  const q = query.trim().toLowerCase();

  return pools.filter((pool) => {
    const displayName = (pool.display_name || "").toLowerCase();
    const token0 = (pool.token0_symbol || "").toLowerCase();
    const token1 = (pool.token1_symbol || "").toLowerCase();
    const feeLabel = (pool.fee_label || "").toLowerCase();
    const address = (pool.pool_address || "").toLowerCase();

    return (
      displayName.includes(q) ||
      token0.includes(q) ||
      token1.includes(q) ||
      feeLabel.includes(q) ||
      address.includes(q)
    );
  });
}

/**
 * Formats fee tier (in basis points) as a percentage string.
 * Examples:
 *   500 → "0.05%"
 *   3000 → "0.3%"
 *   10000 → "1%"
 *
 * @param {number} feeTier - Fee tier in basis points (hundredths of a percent)
 * @returns {string} Formatted fee percentage
 */
export function formatFeeTier(feeTier) {
  if (typeof feeTier !== "number" || feeTier < 0) return "";
  const percentage = feeTier / 10000;
  // Format with up to 2 decimals, then remove trailing zeros
  return percentage.toFixed(2).replace(/\.?0+$/, "") + "%";
}

/**
 * Parses a fee_label string to extract the numeric fee tier.
 * Examples:
 *   "0.05%" → 500
 *   "0.3%" → 3000
 *   "1%" → 10000
 *
 * @param {string} feeLabel - Fee label string (e.g., "0.3%")
 * @returns {number} Fee tier in basis points, or Infinity if invalid
 */
export function parseFeeTier(feeLabel) {
  if (!feeLabel || typeof feeLabel !== "string") return Infinity;
  const match = feeLabel.match(/[\d.]+/);
  if (!match) return Infinity;
  const percentage = parseFloat(match[0]);
  return Math.round(percentage * 10000);
}

/**
 * Normalizes a pair name for grouping purposes.
 * Ensures consistent ordering by sorting token symbols alphabetically.
 *
 * @param {string} token0Symbol - First token symbol
 * @param {string} token1Symbol - Second token symbol
 * @returns {string} Normalized pair name (e.g., "USDC/WETH")
 */
export function normalizePairName(token0Symbol, token1Symbol) {
  if (!token0Symbol || !token1Symbol) return null;
  const symbols = [token0Symbol, token1Symbol].sort();
  return symbols.join("/");
}
