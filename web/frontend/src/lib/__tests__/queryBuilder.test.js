/**
 * Tests for queryBuilder.js — pure SQL generation from WRDS form state.
 * Run with: node --test src/lib/__tests__/queryBuilder.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSQL } from "../queryBuilder.js";

describe("buildSQL", () => {
  const BASE = {
    table: "uniswap_v3_mints",
    columns: ["block_num", "tx_hash", "amount"],
    blockRange: { min: null, max: null },
    conditions: [],
    limit: 1000,
  };

  // ── Happy path ───────────────────────────────────────────────────────────

  it("generates a basic SELECT with columns and limit", () => {
    const sql = buildSQL(BASE);
    assert.match(sql, /SELECT\s+block_num,\s*tx_hash,\s*amount/i);
    assert.match(sql, /FROM\s+uniswap_v3_mints/i);
    assert.match(sql, /LIMIT\s+1000/i);
  });

  it("selects all columns when columns array is empty", () => {
    const sql = buildSQL({ ...BASE, columns: [] });
    assert.match(sql, /SELECT \*/i);
  });

  it("adds ORDER BY block_num DESC by default", () => {
    const sql = buildSQL(BASE);
    assert.match(sql, /ORDER BY block_num DESC/i);
  });

  // ── Block range ──────────────────────────────────────────────────────────

  it("adds WHERE block_num >= min when only min is set", () => {
    const sql = buildSQL({ ...BASE, blockRange: { min: 19000000, max: null } });
    assert.match(sql, /WHERE/i);
    assert.match(sql, /block_num >= 19000000/);
  });

  it("adds WHERE block_num <= max when only max is set", () => {
    const sql = buildSQL({ ...BASE, blockRange: { min: null, max: 20000000 } });
    assert.match(sql, /block_num <= 20000000/);
  });

  it("applies both min and max block range", () => {
    const sql = buildSQL({ ...BASE, blockRange: { min: 19000000, max: 20000000 } });
    assert.match(sql, /block_num >= 19000000/);
    assert.match(sql, /block_num <= 20000000/);
  });

  // ── Conditions / filters ─────────────────────────────────────────────────

  it("adds a numeric equality condition", () => {
    const sql = buildSQL({
      ...BASE,
      conditions: [{ column: "fee", op: "=", value: "3000" }],
    });
    assert.match(sql, /fee = 3000/);
  });

  it("adds a string equality condition with quotes", () => {
    const sql = buildSQL({
      ...BASE,
      conditions: [{ column: "token0_symbol", op: "=", value: "USDC" }],
    });
    assert.match(sql, /token0_symbol = 'USDC'/);
  });

  it("combines block range and conditions with AND", () => {
    const sql = buildSQL({
      ...BASE,
      blockRange: { min: 19000000, max: null },
      conditions: [{ column: "fee", op: "=", value: "500" }],
    });
    assert.match(sql, /WHERE/i);
    assert.match(sql, /block_num >= 19000000/);
    assert.match(sql, /AND/i);
    assert.match(sql, /fee = 500/);
  });

  it("supports > < >= <= operators", () => {
    for (const op of [">", "<", ">=", "<="]) {
      const sql = buildSQL({
        ...BASE,
        conditions: [{ column: "amount", op, value: "1000" }],
      });
      assert.ok(sql.includes(`amount ${op} 1000`), `expected operator ${op}`);
    }
  });

  it("supports IS NULL operator", () => {
    const sql = buildSQL({
      ...BASE,
      conditions: [{ column: "tick_lower", op: "IS NULL", value: "" }],
    });
    assert.match(sql, /tick_lower IS NULL/);
  });

  it("ignores conditions with empty column", () => {
    const sql = buildSQL({
      ...BASE,
      conditions: [{ column: "", op: "=", value: "foo" }],
    });
    assert.doesNotMatch(sql, /WHERE/i);
  });

  it("ignores conditions with empty value (except IS NULL)", () => {
    const sql = buildSQL({
      ...BASE,
      conditions: [{ column: "fee", op: "=", value: "" }],
    });
    assert.doesNotMatch(sql, /WHERE/i);
  });

  // ── Security ─────────────────────────────────────────────────────────────

  it("escapes single quotes in string values", () => {
    const sql = buildSQL({
      ...BASE,
      conditions: [{ column: "label", op: "=", value: "O'Reilly" }],
    });
    assert.match(sql, /label = 'O''Reilly'/);
  });

  it("strips semicolons from table names", () => {
    const sql = buildSQL({ ...BASE, table: "uniswap_v3_mints; DROP TABLE users--" });
    assert.doesNotMatch(sql, /DROP TABLE/i);
  });

  it("strips semicolons from column names", () => {
    const sql = buildSQL({ ...BASE, columns: ["block_num; DROP TABLE x--", "tx_hash"] });
    assert.doesNotMatch(sql, /DROP TABLE/i);
  });

  // ── Limit ────────────────────────────────────────────────────────────────

  it("clamps limit to 10000 max", () => {
    const sql = buildSQL({ ...BASE, limit: 99999 });
    assert.match(sql, /LIMIT 10000/);
  });

  it("defaults limit to 1000 if not provided", () => {
    const { limit: _limit, ...rest } = BASE;
    const sql = buildSQL(rest);
    assert.match(sql, /LIMIT 1000/);
  });
});
