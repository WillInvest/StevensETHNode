/**
 * Tests for poolGrouping.js utility functions
 */

import { groupPoolsByPair } from "../poolGrouping.js";

describe("poolGrouping", () => {
  describe("groupPoolsByPair", () => {
    const mockPools = [
      {
        pool_address: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
        display_name: "USDC-WETH",
        token0_symbol: "USDC",
        token1_symbol: "WETH",
        fee_label: "0.05%",
        swap_count: 100,
      },
      {
        pool_address: "0x8ad599c3a0ff1de082011efddc58f1908762efb6",
        display_name: "USDC-WETH",
        token0_symbol: "USDC",
        token1_symbol: "WETH",
        fee_label: "0.3%",
        swap_count: 1000,
      },
      {
        pool_address: "0xa4b1a00b3b6c21eb56e06f3dd8c1a0b1e0d4c6e0",
        display_name: "USDC-WETH",
        token0_symbol: "USDC",
        token1_symbol: "WETH",
        fee_label: "1%",
        swap_count: 50,
      },
      {
        pool_address: "0x11b815efb8f581194ae79006d24e0d814b7697f6",
        display_name: "WETH-DAI",
        token0_symbol: "WETH",
        token1_symbol: "DAI",
        fee_label: "0.3%",
        swap_count: 500,
      },
    ];

    test("groups pools by normalized pair name", () => {
      const result = groupPoolsByPair(mockPools);

      expect(result).toHaveLength(2);
      expect(result[0].pairName).toBe("USDC/WETH");
      expect(result[0].pools).toHaveLength(3);
      expect(result[1].pairName).toBe("DAI/WETH");
      expect(result[1].pools).toHaveLength(1);
    });

    test("sorts pools within group by fee tier (ascending)", () => {
      const result = groupPoolsByPair(mockPools);
      const usdcWethGroup = result.find((g) => g.pairName === "USDC/WETH");

      expect(usdcWethGroup.pools[0].fee_label).toBe("0.05%");
      expect(usdcWethGroup.pools[1].fee_label).toBe("0.3%");
      expect(usdcWethGroup.pools[2].fee_label).toBe("1%");
    });

    test("sorts groups by highest swap count (descending)", () => {
      const result = groupPoolsByPair(mockPools);

      // USDC/WETH has max swap count of 1000
      // DAI/WETH has max swap count of 500
      expect(result[0].pairName).toBe("USDC/WETH");
      expect(result[1].pairName).toBe("DAI/WETH");
    });

    test("handles reversed token order", () => {
      const reversedPools = [
        {
          pool_address: "0x1",
          display_name: "WETH-USDC",
          token0_symbol: "WETH",
          token1_symbol: "USDC",
          fee_label: "0.3%",
          swap_count: 100,
        },
        {
          pool_address: "0x2",
          display_name: "USDC-WETH",
          token0_symbol: "USDC",
          token1_symbol: "WETH",
          fee_label: "0.3%",
          swap_count: 100,
        },
      ];

      const result = groupPoolsByPair(reversedPools);

      // Both should group as "USDC/WETH"
      expect(result).toHaveLength(1);
      expect(result[0].pairName).toBe("USDC/WETH");
      expect(result[0].pools).toHaveLength(2);
    });

    test("falls back to display_name when symbols unavailable", () => {
      const poolsWithoutSymbols = [
        {
          pool_address: "0x1",
          display_name: "USDC-WETH",
          fee_label: "0.3%",
          swap_count: 100,
        },
        {
          pool_address: "0x2",
          display_name: "USDC-WETH",
          fee_label: "0.05%",
          swap_count: 100,
        },
      ];

      const result = groupPoolsByPair(poolsWithoutSymbols);

      expect(result).toHaveLength(1);
      expect(result[0].pairName).toBe("USDC-WETH");
      expect(result[0].pools).toHaveLength(2);
    });

    test("handles empty array", () => {
      expect(groupPoolsByPair([])).toEqual([]);
    });

    test("handles single pool", () => {
      const result = groupPoolsByPair([mockPools[0]]);

      expect(result).toHaveLength(1);
      expect(result[0].pairName).toBe("USDC/WETH");
      expect(result[0].pools).toHaveLength(1);
    });

    test("handles pools with missing swap_count", () => {
      const poolsWithoutCount = [
        {
          pool_address: "0x1",
          display_name: "USDC-WETH",
          token0_symbol: "USDC",
          token1_symbol: "WETH",
          fee_label: "0.3%",
        },
        {
          pool_address: "0x2",
          display_name: "DAI-USDC",
          token0_symbol: "DAI",
          token1_symbol: "USDC",
          fee_label: "0.3%",
          swap_count: 100,
        },
      ];

      const result = groupPoolsByPair(poolsWithoutCount);

      // DAI-USDC should be first (swap_count 100 vs 0)
      expect(result[0].pairName).toBe("DAI/USDC");
      expect(result[1].pairName).toBe("USDC/WETH");
    });

    test("groups multiple pools with same fee tier", () => {
      const duplicateFees = [
        {
          pool_address: "0x1",
          display_name: "USDC-WETH",
          token0_symbol: "USDC",
          token1_symbol: "WETH",
          fee_label: "0.3%",
          swap_count: 100,
        },
        {
          pool_address: "0x2",
          display_name: "USDC-WETH",
          token0_symbol: "USDC",
          token1_symbol: "WETH",
          fee_label: "0.3%",
          swap_count: 50,
        },
      ];

      const result = groupPoolsByPair(duplicateFees);

      expect(result).toHaveLength(1);
      expect(result[0].pools).toHaveLength(2);
      expect(result[0].pools[0].fee_label).toBe("0.3%");
      expect(result[0].pools[1].fee_label).toBe("0.3%");
    });
  });
});
