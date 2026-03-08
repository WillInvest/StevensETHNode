/**
 * Pure SQL builder for the WRDS-style query form.
 * Takes a form state object and returns a parameterless SQL string.
 * No side effects — same input always produces same output.
 */

const MAX_LIMIT = 10000;
const DEFAULT_LIMIT = 1000;

/** Remove characters that could enable SQL injection in identifiers. */
function sanitizeIdentifier(name) {
  return String(name).replace(/[^\w.]/g, "");
}

/** Determine if a value looks numeric. */
function isNumeric(value) {
  return value !== "" && !isNaN(Number(value));
}

/** Quote a string value for SQL, escaping internal single quotes. */
function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Build a WHERE clause fragment for a single condition.
 * Returns null if the condition should be skipped.
 */
function buildCondition({ column, op, value }) {
  if (!column) return null;

  const col = sanitizeIdentifier(column);

  if (op === "IS NULL") return `${col} IS NULL`;
  if (op === "IS NOT NULL") return `${col} IS NOT NULL`;

  if (!value && value !== 0) return null;

  const literal = isNumeric(value) ? Number(value) : quoteLiteral(value);
  return `${col} ${op} ${literal}`;
}

/**
 * Build a complete SELECT statement from WRDS form state.
 *
 * @param {object} state
 * @param {string}   state.table        - DB table name
 * @param {string[]} [state.columns]    - Columns to select ([] = SELECT *)
 * @param {object}   [state.blockRange] - { min: number|null, max: number|null }
 * @param {object[]} [state.conditions] - [{ column, op, value }]
 * @param {number}   [state.limit]      - Row limit (capped at MAX_LIMIT)
 * @returns {string} SQL query string
 */
export function buildSQL({
  table,
  columns = [],
  blockRange = { min: null, max: null },
  conditions = [],
  limit,
}) {
  const safeTable = sanitizeIdentifier(table);
  const safeLimit = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  // SELECT clause
  const selectClause =
    columns.length > 0
      ? columns.map(sanitizeIdentifier).join(", ")
      : "*";

  // WHERE fragments
  const whereParts = [];

  if (blockRange?.min != null) {
    whereParts.push(`block_num >= ${Number(blockRange.min)}`);
  }
  if (blockRange?.max != null) {
    whereParts.push(`block_num <= ${Number(blockRange.max)}`);
  }

  for (const cond of conditions) {
    const fragment = buildCondition(cond);
    if (fragment) whereParts.push(fragment);
  }

  const whereClause =
    whereParts.length > 0 ? `WHERE ${whereParts.join("\n  AND ")}` : "";

  return [
    `SELECT ${selectClause}`,
    `FROM ${safeTable}`,
    whereClause,
    `ORDER BY block_num DESC`,
    `LIMIT ${safeLimit}`,
  ]
    .filter(Boolean)
    .join("\n");
}
