/**
 * Tests for queryFormLogic.js — pure business logic for the WRDS query form.
 * Run with: node --test src/lib/__tests__/queryFormLogic.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createConditionRow,
  updateConditionRow,
  removeConditionRow,
  isNumericType,
  getOperatorsForType,
  shouldShowValueInput,
  hasActiveFilter,
  canSubmitForm,
  normalizeBlockRange,
} from "../queryFormLogic.js";

describe("createConditionRow", () => {
  it("creates a new condition row with required fields", () => {
    const row = createConditionRow();
    assert.strictEqual(typeof row.id, "number");
    assert.ok(row.id > 0);
    assert.strictEqual(row.column, "");
    assert.strictEqual(row.op, "=");
    assert.strictEqual(row.value, "");
  });

  it("creates rows with unique IDs", () => {
    const row1 = createConditionRow();
    const row2 = createConditionRow();
    assert.notStrictEqual(row1.id, row2.id);
  });
});

describe("updateConditionRow", () => {
  it("updates a row by ID without mutating the input", () => {
    const original = [
      { id: 1, column: "fee", op: "=", value: "" },
      { id: 2, column: "", op: "=", value: "" },
    ];
    const updated = updateConditionRow(original, 1, { op: ">", value: "500" });

    // Original unchanged
    assert.strictEqual(original[0].op, "=");
    assert.strictEqual(original[0].value, "");

    // New array updated
    assert.strictEqual(updated[0].op, ">");
    assert.strictEqual(updated[0].value, "500");
    assert.strictEqual(updated[1], original[1]); // Other rows unchanged
  });

  it("returns the same array length", () => {
    const conditions = [
      { id: 1, column: "fee", op: "=", value: "3000" },
      { id: 2, column: "amount", op: ">", value: "1000" },
    ];
    const updated = updateConditionRow(conditions, 1, { value: "5000" });
    assert.strictEqual(updated.length, 2);
  });

  it("does nothing if ID not found (returns unchanged array)", () => {
    const conditions = [{ id: 1, column: "fee", op: "=", value: "" }];
    const updated = updateConditionRow(conditions, 999, { column: "amount" });
    assert.deepStrictEqual(updated, conditions);
  });

  it("can update multiple fields at once", () => {
    const conditions = [{ id: 1, column: "fee", op: "=", value: "" }];
    const updated = updateConditionRow(conditions, 1, {
      column: "amount",
      op: ">=",
      value: "10000",
    });
    assert.strictEqual(updated[0].column, "amount");
    assert.strictEqual(updated[0].op, ">=");
    assert.strictEqual(updated[0].value, "10000");
  });
});

describe("removeConditionRow", () => {
  it("removes a row by ID without mutating the input", () => {
    const original = [
      { id: 1, column: "fee", op: "=", value: "3000" },
      { id: 2, column: "amount", op: ">", value: "1000" },
    ];
    const removed = removeConditionRow(original, 1);

    // Original unchanged
    assert.strictEqual(original.length, 2);

    // New array has one fewer item
    assert.strictEqual(removed.length, 1);
    assert.strictEqual(removed[0].id, 2);
  });

  it("returns empty array when removing the only row", () => {
    const conditions = [{ id: 1, column: "fee", op: "=", value: "" }];
    const removed = removeConditionRow(conditions, 1);
    assert.deepStrictEqual(removed, []);
  });

  it("does nothing if ID not found", () => {
    const conditions = [{ id: 1, column: "fee", op: "=", value: "" }];
    const removed = removeConditionRow(conditions, 999);
    assert.deepStrictEqual(removed, conditions);
  });
});

describe("isNumericType", () => {
  it("returns true for numeric types", () => {
    assert.ok(isNumericType("integer"));
    assert.ok(isNumericType("bigint"));
    assert.ok(isNumericType("numeric"));
    assert.ok(isNumericType("double precision"));
    assert.ok(isNumericType("real"));
  });

  it("returns false for non-numeric types", () => {
    assert.ok(!isNumericType("text"));
    assert.ok(!isNumericType("varchar"));
    assert.ok(!isNumericType("timestamp"));
    assert.ok(!isNumericType("boolean"));
  });

  it("is case-insensitive", () => {
    assert.ok(isNumericType("INTEGER"));
    assert.ok(isNumericType("Integer"));
    assert.ok(isNumericType("DOUBLE PRECISION"));
  });

  it("returns false for null/undefined/empty", () => {
    assert.ok(!isNumericType(null));
    assert.ok(!isNumericType(undefined));
    assert.ok(!isNumericType(""));
  });
});

describe("getOperatorsForType", () => {
  it("returns all operators for numeric types", () => {
    const ops = getOperatorsForType("integer");
    assert.deepStrictEqual(ops, [
      "=",
      "!=",
      ">",
      "<",
      ">=",
      "<=",
      "IS NULL",
      "IS NOT NULL",
    ]);
  });

  it("returns only string operators for non-numeric types", () => {
    const ops = getOperatorsForType("text");
    assert.deepStrictEqual(ops, ["=", "!=", "IS NULL", "IS NOT NULL"]);
  });

  it("handles null/undefined by returning string operators", () => {
    assert.deepStrictEqual(getOperatorsForType(null), [
      "=",
      "!=",
      "IS NULL",
      "IS NOT NULL",
    ]);
    assert.deepStrictEqual(getOperatorsForType(undefined), [
      "=",
      "!=",
      "IS NULL",
      "IS NOT NULL",
    ]);
  });
});

describe("shouldShowValueInput", () => {
  it("returns true for value-required operators", () => {
    assert.ok(shouldShowValueInput("="));
    assert.ok(shouldShowValueInput("!="));
    assert.ok(shouldShowValueInput(">"));
    assert.ok(shouldShowValueInput("<"));
    assert.ok(shouldShowValueInput(">="));
    assert.ok(shouldShowValueInput("<="));
  });

  it("returns false for operators that don't need values", () => {
    assert.ok(!shouldShowValueInput("IS NULL"));
    assert.ok(!shouldShowValueInput("IS NOT NULL"));
  });
});

describe("hasActiveFilter", () => {
  it("returns true if min block range is set", () => {
    const result = hasActiveFilter({ min: 19000000, max: null }, []);
    assert.ok(result);
  });

  it("returns true if max block range is set", () => {
    const result = hasActiveFilter({ min: null, max: 20000000 }, []);
    assert.ok(result);
  });

  it("returns true if both min and max block range are set", () => {
    const result = hasActiveFilter({ min: 19000000, max: 20000000 }, []);
    assert.ok(result);
  });

  it("returns false if no block range and no conditions", () => {
    const result = hasActiveFilter({ min: null, max: null }, []);
    assert.ok(!result);
  });

  it("returns true if a condition has column and value", () => {
    const conditions = [
      { id: 1, column: "fee", op: "=", value: "3000" },
    ];
    const result = hasActiveFilter({ min: null, max: null }, conditions);
    assert.ok(result);
  });

  it("returns true if a condition uses IS NULL", () => {
    const conditions = [
      { id: 1, column: "tick_lower", op: "IS NULL", value: "" },
    ];
    const result = hasActiveFilter({ min: null, max: null }, conditions);
    assert.ok(result);
  });

  it("returns true if a condition uses IS NOT NULL", () => {
    const conditions = [
      { id: 1, column: "tick_lower", op: "IS NOT NULL", value: "" },
    ];
    const result = hasActiveFilter({ min: null, max: null }, conditions);
    assert.ok(result);
  });

  it("ignores conditions with no column", () => {
    const conditions = [
      { id: 1, column: "", op: "=", value: "3000" },
    ];
    const result = hasActiveFilter({ min: null, max: null }, conditions);
    assert.ok(!result);
  });

  it("ignores conditions with column but no value (non-IS NULL op)", () => {
    const conditions = [
      { id: 1, column: "fee", op: "=", value: "" },
    ];
    const result = hasActiveFilter({ min: null, max: null }, conditions);
    assert.ok(!result);
  });

  it("counts only valid conditions as active", () => {
    const conditions = [
      { id: 1, column: "", op: "=", value: "3000" }, // invalid, no column
      { id: 2, column: "fee", op: "=", value: "" }, // invalid, no value
      { id: 3, column: "amount", op: ">", value: "1000" }, // valid
    ];
    const result = hasActiveFilter({ min: null, max: null }, conditions);
    assert.ok(result);
  });
});

describe("canSubmitForm", () => {
  it("returns true if dataset has no requiresFilter flag", () => {
    const dataset = { table: "test", requiresFilter: false };
    const result = canSubmitForm(dataset, { min: null, max: null }, []);
    assert.ok(result);
  });

  it("returns true if dataset has no requiresFilter flag (undefined)", () => {
    const dataset = { table: "test" };
    const result = canSubmitForm(dataset, { min: null, max: null }, []);
    assert.ok(result);
  });

  it("returns false if dataset requires filter but none provided", () => {
    const dataset = { table: "erc20_transfers", requiresFilter: true };
    const result = canSubmitForm(dataset, { min: null, max: null }, []);
    assert.ok(!result);
  });

  it("returns true if dataset requires filter and block range provided", () => {
    const dataset = { table: "erc20_transfers", requiresFilter: true };
    const result = canSubmitForm(
      dataset,
      { min: 19000000, max: null },
      []
    );
    assert.ok(result);
  });

  it("returns true if dataset requires filter and condition provided", () => {
    const dataset = { table: "erc20_transfers", requiresFilter: true };
    const conditions = [
      { id: 1, column: "contract_address", op: "=", value: "0x..." },
    ];
    const result = canSubmitForm(dataset, { min: null, max: null }, conditions);
    assert.ok(result);
  });

  it("returns false if dataset requires filter and only empty conditions", () => {
    const dataset = { table: "erc20_transfers", requiresFilter: true };
    const conditions = [
      { id: 1, column: "", op: "=", value: "" },
    ];
    const result = canSubmitForm(dataset, { min: null, max: null }, conditions);
    assert.ok(!result);
  });
});

describe("normalizeBlockRange", () => {
  it("returns numbers for valid numeric strings", () => {
    const result = normalizeBlockRange({ min: "19000000", max: "20000000" });
    assert.deepStrictEqual(result, { min: 19000000, max: 20000000 });
  });

  it("returns numbers for numeric values", () => {
    const result = normalizeBlockRange({ min: 19000000, max: 20000000 });
    assert.deepStrictEqual(result, { min: 19000000, max: 20000000 });
  });

  it("converts null to null", () => {
    const result = normalizeBlockRange({ min: null, max: null });
    assert.deepStrictEqual(result, { min: null, max: null });
  });

  it("converts empty strings to null", () => {
    const result = normalizeBlockRange({ min: "", max: "" });
    assert.deepStrictEqual(result, { min: null, max: null });
  });

  it("converts undefined to null", () => {
    const result = normalizeBlockRange({ min: undefined, max: undefined });
    assert.deepStrictEqual(result, { min: null, max: null });
  });

  it("converts non-numeric strings to null", () => {
    const result = normalizeBlockRange({ min: "abc", max: "xyz" });
    assert.deepStrictEqual(result, { min: null, max: null });
  });

  it("handles mixed valid and invalid values", () => {
    const result = normalizeBlockRange({ min: "19000000", max: "invalid" });
    assert.deepStrictEqual(result, { min: 19000000, max: null });
  });

  it("handles null/undefined input gracefully", () => {
    const result = normalizeBlockRange(null);
    assert.deepStrictEqual(result, { min: null, max: null });
  });

  it("handles partial input gracefully", () => {
    const result = normalizeBlockRange({ min: "19000000" });
    assert.deepStrictEqual(result, { min: 19000000, max: null });
  });
});
