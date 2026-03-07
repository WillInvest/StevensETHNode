/**
 * Pure utility functions for grouping pools by pair.
 */

import { normalizePairName, parseFeeTier } from "./poolFilters.js";

/**
 * Groups pools by pair name and sorts sub-pools by fee tier.
 *
 * @param {Array} pools - Array of pool objects with display_name, token0_symbol, token1_symbol, fee_label
 * @returns {Array} Array of group objects: { pairName, pools: [...] }
 *
 * Example:
 *   Input: [
 *     { pool_address: "0x1", display_name: "USDC-WETH", token0_symbol: "USDC", token1_symbol: "WETH", fee_label: "0.3%" },
 *     { pool_address: "0x2", display_name: "USDC-WETH", token0_symbol: "USDC", token1_symbol: "WETH", fee_label: "0.05%" },
 *   ]
 *   Output: [
 *     {
 *       pairName: "USDC/WETH",
 *       pools: [
 *         { pool_address: "0x2", ..., fee_label: "0.05%" },
 *         { pool_address: "0x1", ..., fee_label: "0.3%" },
 *       ]
 *     }
 *   ]
 */
export function groupPoolsByPair(pools) {
  if (!Array.isArray(pools) || pools.length === 0) return [];

  // Group by normalized pair name
  const groupMap = {};

  pools.forEach((pool) => {
    // Try to use token symbols if available
    let pairName = null;
    if (pool.token0_symbol && pool.token1_symbol) {
      pairName = normalizePairName(pool.token0_symbol, pool.token1_symbol);
    }

    // Fall back to display_name if symbols unavailable
    if (!pairName) {
      pairName = pool.display_name || "Unknown";
    }

    if (!groupMap[pairName]) {
      groupMap[pairName] = [];
    }

    groupMap[pairName].push(pool);
  });

  // Convert to array and sort pools within each group by fee tier
  return Object.entries(groupMap)
    .map(([pairName, poolList]) => {
      // Sort pools by fee tier (ascending: 0.01% before 0.3% before 1%)
      const sorted = poolList.sort((a, b) => {
        const feeA = parseFeeTier(a.fee_label || "");
        const feeB = parseFeeTier(b.fee_label || "");
        return feeA - feeB;
      });

      return {
        pairName,
        pools: sorted,
      };
    })
    // Sort groups by the highest swap count in the group (for consistent ordering)
    .sort((groupA, groupB) => {
      const maxSwapA = Math.max(...groupA.pools.map((p) => p.swap_count || 0), 0);
      const maxSwapB = Math.max(...groupB.pools.map((p) => p.swap_count || 0), 0);
      return maxSwapB - maxSwapA;
    });
}
