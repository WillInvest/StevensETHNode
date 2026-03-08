/**
 * Tests for datasetRegistry.js — protocol/version/dataset data structure.
 * Run with: node --test src/config/__tests__/datasetRegistry.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DATASET_REGISTRY, findDataset } from "../datasetRegistry.js";

describe("DATASET_REGISTRY structure", () => {
  // ── Data integrity ───────────────────────────────────────────────────────

  it("is an array with at least 1 protocol", () => {
    assert.ok(Array.isArray(DATASET_REGISTRY));
    assert.ok(DATASET_REGISTRY.length > 0);
  });

  it("each protocol has required fields", () => {
    for (const protocol of DATASET_REGISTRY) {
      assert.ok(protocol.id, "protocol must have id");
      assert.ok(protocol.label, "protocol must have label");
      assert.ok(protocol.category, "protocol must have category");
      assert.ok(Array.isArray(protocol.versions), "protocol must have versions array");
      assert.ok(protocol.versions.length > 0, "protocol must have at least 1 version");
    }
  });

  it("each version has required fields", () => {
    for (const protocol of DATASET_REGISTRY) {
      for (const version of protocol.versions) {
        assert.ok(version.id, `version in ${protocol.id} must have id`);
        assert.ok(version.label, `version in ${protocol.id} must have label`);
        assert.ok(Array.isArray(version.datasets), `version must have datasets array`);
        assert.ok(version.datasets.length > 0, `version must have at least 1 dataset`);
      }
    }
  });

  it("each dataset has required fields", () => {
    for (const protocol of DATASET_REGISTRY) {
      for (const version of protocol.versions) {
        for (const dataset of version.datasets) {
          assert.ok(dataset.id, `dataset in ${protocol.id}/${version.id} must have id`);
          assert.ok(dataset.label, `dataset in ${protocol.id}/${version.id} must have label`);
          assert.ok(dataset.table, `dataset in ${protocol.id}/${version.id} must have table`);
          assert.ok(dataset.description, `dataset in ${protocol.id}/${version.id} must have description`);
          assert.ok(dataset.blockColumn !== undefined, `dataset in ${protocol.id}/${version.id} must have blockColumn`);
          assert.ok(Array.isArray(dataset.defaultColumns), `dataset must have defaultColumns array`);
        }
      }
    }
  });

  it("all table names are strings and non-empty", () => {
    for (const protocol of DATASET_REGISTRY) {
      for (const version of protocol.versions) {
        for (const dataset of version.datasets) {
          assert.strictEqual(typeof dataset.table, "string", `table must be string in ${protocol.id}/${version.id}/${dataset.id}`);
          assert.ok(dataset.table.length > 0, `table must be non-empty in ${protocol.id}/${version.id}/${dataset.id}`);
          // Table names should be lowercase with underscores (SQL convention)
          assert.match(dataset.table, /^[a-z0-9_]+$/, `table name must be lowercase alphanumeric in ${protocol.id}/${version.id}/${dataset.id}`);
        }
      }
    }
  });

  it("all defaultColumns are non-empty arrays", () => {
    for (const protocol of DATASET_REGISTRY) {
      for (const version of protocol.versions) {
        for (const dataset of version.datasets) {
          // blockColumn is optional (null for non-block-indexed tables like Hyperliquid)
          if (dataset.blockColumn !== null) {
            assert.strictEqual(typeof dataset.blockColumn, "string", `blockColumn must be string when present`);
            assert.ok(dataset.blockColumn.length > 0, `blockColumn must be non-empty when present`);
          }
          // defaultColumns should have at least one column
          assert.ok(dataset.defaultColumns.length > 0, `defaultColumns must have at least 1 column in ${protocol.id}/${version.id}/${dataset.id}`);
          // All columns should be strings
          for (const col of dataset.defaultColumns) {
            assert.strictEqual(typeof col, "string", `defaultColumns must be strings in ${protocol.id}/${version.id}/${dataset.id}`);
            assert.ok(col.length > 0, `defaultColumns must be non-empty strings in ${protocol.id}/${version.id}/${dataset.id}`);
          }
        }
      }
    }
  });

  it("no duplicate protocol IDs", () => {
    const ids = DATASET_REGISTRY.map((p) => p.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(ids.length, uniqueIds.size, "protocol IDs must be unique");
  });

  it("no duplicate version IDs within each protocol", () => {
    for (const protocol of DATASET_REGISTRY) {
      const versionIds = protocol.versions.map((v) => v.id);
      const uniqueIds = new Set(versionIds);
      assert.strictEqual(
        versionIds.length,
        uniqueIds.size,
        `version IDs must be unique within ${protocol.id}`
      );
    }
  });

  it("no duplicate dataset IDs within each version", () => {
    for (const protocol of DATASET_REGISTRY) {
      for (const version of protocol.versions) {
        const datasetIds = version.datasets.map((d) => d.id);
        const uniqueIds = new Set(datasetIds);
        assert.strictEqual(
          datasetIds.length,
          uniqueIds.size,
          `dataset IDs must be unique within ${protocol.id}/${version.id}`
        );
      }
    }
  });

  it("optionally supports requiresFilter flag on datasets", () => {
    for (const protocol of DATASET_REGISTRY) {
      for (const version of protocol.versions) {
        for (const dataset of version.datasets) {
          // requiresFilter is optional, but if present must be a boolean
          if ("requiresFilter" in dataset) {
            assert.strictEqual(typeof dataset.requiresFilter, "boolean", `requiresFilter must be boolean in ${protocol.id}/${version.id}/${dataset.id}`);
          }
        }
      }
    }
  });
});

describe("findDataset function", () => {
  // ── Happy path ───────────────────────────────────────────────────────────

  it("finds a dataset by protocol/version/dataset IDs", () => {
    const result = findDataset("uniswap", "v3", "mints");
    assert.ok(result, "should find uniswap v3 mints");
    assert.strictEqual(result.table, "uniswap_v3_mints");
    assert.strictEqual(result.label, "Mints");
  });

  it("returns the complete dataset object with all fields", () => {
    const result = findDataset("aave", "v3", "supply");
    assert.ok(result);
    assert.strictEqual(result.id, "supply");
    assert.strictEqual(result.label, "Supply");
    assert.strictEqual(result.table, "aave_v3_supply");
    assert.ok(result.description);
    assert.strictEqual(result.blockColumn, "block_num");
    assert.ok(Array.isArray(result.defaultColumns));
  });

  it("finds datasets across all protocols", () => {
    const tests = [
      ["uniswap", "v3", "burns"],
      ["compound", "v3", "withdraw"],
      ["curve", "v1", "token_exchange"],
      ["lido", "v1", "submitted"],
      ["hyperliquid", "v1", "positions"],
      ["bridges", "arbitrum", "message_delivered"],
      ["bridges", "base", "tx_deposited"],
      ["bridges", "optimism", "tx_deposited"],
      ["erc20", "v1", "transfers"],
    ];
    for (const [proto, ver, data] of tests) {
      const result = findDataset(proto, ver, data);
      assert.ok(result, `should find ${proto}/${ver}/${data}`);
      assert.ok(result.table);
      assert.ok(result.label);
    }
  });

  // ── Edge cases / error handling ──────────────────────────────────────────

  it("returns null for unknown protocol ID", () => {
    const result = findDataset("unknown_protocol", "v1", "dataset");
    assert.strictEqual(result, null);
  });

  it("returns null for unknown version ID", () => {
    const result = findDataset("uniswap", "v99", "mints");
    assert.strictEqual(result, null);
  });

  it("returns null for unknown dataset ID", () => {
    const result = findDataset("uniswap", "v3", "unknown_dataset");
    assert.strictEqual(result, null);
  });

  it("returns null if version is correct but dataset doesn't exist in that version", () => {
    // Compound V3 doesn't have a "mints" dataset
    const result = findDataset("compound", "v3", "mints");
    assert.strictEqual(result, null);
  });

  it("handles undefined/null arguments gracefully", () => {
    assert.strictEqual(findDataset(undefined, "v1", "dataset"), null);
    assert.strictEqual(findDataset("protocol", undefined, "dataset"), null);
    assert.strictEqual(findDataset("protocol", "v1", undefined), null);
  });

  it("is case-sensitive (IDs must match exactly)", () => {
    // "Uniswap" vs "uniswap"
    const result = findDataset("Uniswap", "v3", "mints");
    assert.strictEqual(result, null);
  });

  it("does not modify the registry", () => {
    const before = JSON.stringify(DATASET_REGISTRY);
    findDataset("uniswap", "v3", "mints");
    const after = JSON.stringify(DATASET_REGISTRY);
    assert.strictEqual(before, after, "findDataset must not mutate DATASET_REGISTRY");
  });
});
