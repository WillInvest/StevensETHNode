/**
 * Tests for poolFilters.js utility functions
 */

import {
  filterPoolsByQuery,
  formatFeeTier,
  parseFeeTier,
  normalizePairName,
} from "../poolFilters.js";

describe("poolFilters", () => {
  describe("filterPoolsByQuery", () => {
    const mockPools = [
      {
        pool_address: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
        display_name: "USDC-WETH",
        token0_symbol: "USDC",
        token1_symbol: "WETH",
        fee_label: "0.05%",
      },
      {
        pool_address: "0x8ad599c3a0ff1de082011efddc58f1908762efb6",
        display_name: "USDC-WETH",
        token0_symbol: "USDC",
        token1_symbol: "WETH",
        fee_label: "0.3%",
      },
      {
        pool_address: "0x11b815efb8f581194ae79006d24e0d814b7697f6",
        display_name: "WETH-DAI",
        token0_symbol: "WETH",
        token1_symbol: "DAI",
        fee_label: "0.3%",
      },
    ];

    test("returns all pools when query is empty", () => {
      expect(filterPoolsByQuery(mockPools, "")).toEqual(mockPools);
      expect(filterPoolsByQuery(mockPools, null)).toEqual(mockPools);
      expect(filterPoolsByQuery(mockPools, "   ")).toEqual(mockPools);
    });

    test("filters by display_name (case-insensitive)", () => {
      expect(filterPoolsByQuery(mockPools, "usdc")).toHaveLength(2);
      expect(filterPoolsByQuery(mockPools, "USDC")).toHaveLength(2);
      expect(filterPoolsByQuery(mockPools, "dai")).toHaveLength(1);
    });

    test("filters by token symbol", () => {
      expect(filterPoolsByQuery(mockPools, "WETH")).toHaveLength(3);
      expect(filterPoolsByQuery(mockPools, "DAI")).toHaveLength(1);
    });

    test("filters by fee_label", () => {
      expect(filterPoolsByQuery(mockPools, "0.3%")).toHaveLength(2);
      expect(filterPoolsByQuery(mockPools, "0.05%")).toHaveLength(1);
    });

    test("filters by pool address (substring)", () => {
      expect(filterPoolsByQuery(mockPools, "88e6")).toHaveLength(1);
      expect(filterPoolsByQuery(mockPools, "0x8ad5")).toHaveLength(1);
    });

    test("returns empty array for non-matching query", () => {
      expect(filterPoolsByQuery(mockPools, "USDT")).toHaveLength(0);
      expect(filterPoolsByQuery(mockPools, "2%")).toHaveLength(0);
    });

    test("handles pools with missing fields", () => {
      const poolsWithMissing = [
        { pool_address: "0x123", display_name: "USDC-WETH" },
        { token0_symbol: "DAI", token1_symbol: "USDC" },
      ];
      expect(filterPoolsByQuery(poolsWithMissing, "USDC")).toHaveLength(2);
      expect(filterPoolsByQuery(poolsWithMissing, "weth")).toHaveLength(1);
    });
  });

  describe("formatFeeTier", () => {
    test("formats common Uniswap V3 fee tiers", () => {
      expect(formatFeeTier(500)).toBe("0.05%");
      expect(formatFeeTier(3000)).toBe("0.3%");
      expect(formatFeeTier(10000)).toBe("1%");
    });

    test("removes trailing zeros", () => {
      expect(formatFeeTier(5000)).toBe("0.5%");
      expect(formatFeeTier(100)).toBe("0.01%");
    });

    test("handles edge cases", () => {
      expect(formatFeeTier(0)).toBe("0%");
      expect(formatFeeTier(1)).toBe("0.0001%");
    });

    test("returns empty string for invalid input", () => {
      expect(formatFeeTier(-1)).toBe("");
      expect(formatFeeTier(null)).toBe("");
      expect(formatFeeTier(undefined)).toBe("");
      expect(formatFeeTier("500")).toBe("");
    });
  });

  describe("parseFeeTier", () => {
    test("parses common fee labels", () => {
      expect(parseFeeTier("0.05%")).toBe(500);
      expect(parseFeeTier("0.3%")).toBe(3000);
      expect(parseFeeTier("1%")).toBe(10000);
      expect(parseFeeTier("0.5%")).toBe(5000);
    });

    test("returns Infinity for invalid input", () => {
      expect(parseFeeTier(null)).toBe(Infinity);
      expect(parseFeeTier(undefined)).toBe(Infinity);
      expect(parseFeeTier("")).toBe(Infinity);
      expect(parseFeeTier("invalid")).toBe(Infinity);
    });

    test("handles labels without % sign", () => {
      expect(parseFeeTier("0.05")).toBe(500);
      expect(parseFeeTier("1")).toBe(10000);
    });
  });

  describe("normalizePairName", () => {
    test("creates consistent pair names regardless of token order", () => {
      expect(normalizePairName("USDC", "WETH")).toBe("USDC/WETH");
      expect(normalizePairName("WETH", "USDC")).toBe("USDC/WETH");
    });

    test("sorts tokens alphabetically", () => {
      expect(normalizePairName("WETH", "DAI")).toBe("DAI/WETH");
      expect(normalizePairName("ZZZ", "AAA")).toBe("AAA/ZZZ");
    });

    test("returns null for missing symbols", () => {
      expect(normalizePairName(null, "WETH")).toBe(null);
      expect(normalizePairName("USDC", null)).toBe(null);
      expect(normalizePairName("", "WETH")).toBe(null);
    });

    test("handles case-sensitive symbols correctly", () => {
      expect(normalizePairName("usdc", "weth")).toBe("usdc/weth");
      expect(normalizePairName("USDC", "weth")).toBe("USDC/weth");
    });
  });
});
