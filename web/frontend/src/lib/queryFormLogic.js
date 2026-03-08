/**
 * Pure business logic for the WRDS query form.
 * All functions are pure — same input always produces same output, no side effects.
 * This separation allows thorough unit testing without React/DOM.
 */

/**
 * Create a new empty condition row for the WHERE clause builder.
 * @returns {object} { id: number, column: "", op: "=", value: "" }
 */
export function createConditionRow() {
  return {
    id: Math.random(),
    column: "",
    op: "=",
    value: "",
  };
}

/**
 * Update a single condition row by ID.
 * @param {object[]} conditions - Array of condition rows
 * @param {number} id - Row ID to update
 * @param {object} patch - Fields to update (e.g., { column: "fee", op: ">" })
 * @returns {object[]} New array with updated row (immutable)
 */
export function updateConditionRow(conditions, id, patch) {
  return conditions.map((row) =>
    row.id === id ? { ...row, ...patch } : row
  );
}

/**
 * Remove a condition row by ID.
 * @param {object[]} conditions - Array of condition rows
 * @param {id} id - Row ID to remove
 * @returns {object[]} New array without the removed row (immutable)
 */
export function removeConditionRow(conditions, id) {
  return conditions.filter((row) => row.id !== id);
}

/**
 * Determine if a column is numeric based on its type.
 * Numeric types allow all operators; string types allow only =, !=, IS NULL, IS NOT NULL.
 * @param {string} type - Column data type (e.g., "integer", "text", "numeric")
 * @returns {boolean} true if the column is numeric
 */
export function isNumericType(type) {
  if (!type) return false;
  const numericTypes = ["integer", "bigint", "numeric", "double precision", "real"];
  return numericTypes.includes(String(type).toLowerCase());
}

/**
 * Get the allowed operators for a column based on its type.
 * @param {string} type - Column data type
 * @returns {string[]} Array of allowed operators
 */
export function getOperatorsForType(type) {
  const allOps = ["=", "!=", ">", "<", ">=", "<=", "IS NULL", "IS NOT NULL"];
  const stringOps = ["=", "!=", "IS NULL", "IS NOT NULL"];
  return isNumericType(type) ? allOps : stringOps;
}

/**
 * Determine if a value is required for a given operator.
 * IS NULL and IS NOT NULL do not need a value.
 * @param {string} op - Operator (e.g., "=", "IS NULL")
 * @returns {boolean} true if a value input should be shown
 */
export function shouldShowValueInput(op) {
  const noValueOps = ["IS NULL", "IS NOT NULL"];
  return !noValueOps.includes(op);
}

/**
 * Check if the query form has at least one active filter.
 * A filter is active if:
 *   - blockRange.min or blockRange.max is set, OR
 *   - At least one condition has a column and a value (or IS NULL/IS NOT NULL)
 * @param {object} blockRange - { min: number|null, max: number|null }
 * @param {object[]} conditions - Array of condition rows
 * @returns {boolean} true if at least one filter is active
 */
export function hasActiveFilter(blockRange, conditions) {
  // Check block range
  if (blockRange?.min != null || blockRange?.max != null) {
    return true;
  }

  // Check conditions
  for (const cond of conditions) {
    if (!cond.column) continue; // Column must be selected
    const noValueOps = ["IS NULL", "IS NOT NULL"];
    const hasValue = cond.value || noValueOps.includes(cond.op);
    if (hasValue) return true;
  }

  return false;
}

/**
 * Determine if the form can be submitted based on dataset requirements and current filters.
 * @param {object} dataset - Dataset metadata (may have requiresFilter flag)
 * @param {object} blockRange - { min: number|null, max: number|null }
 * @param {object[]} conditions - Array of condition rows
 * @returns {boolean} true if form can be submitted
 */
export function canSubmitForm(dataset, blockRange, conditions) {
  // If dataset doesn't require filters, always allow submission
  if (!dataset.requiresFilter) {
    return true;
  }

  // Dataset requires filters — check if at least one filter exists
  return hasActiveFilter(blockRange, conditions);
}

/**
 * Validate block range input values.
 * Returns normalized range with null for invalid/empty values.
 * @param {object} blockRange - { min: string|number|null, max: string|number|null }
 * @returns {object} Normalized { min: number|null, max: number|null }
 */
export function normalizeBlockRange(blockRange) {
  const normalize = (val) => {
    if (val === null || val === undefined || val === "") return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  };

  return {
    min: normalize(blockRange?.min),
    max: normalize(blockRange?.max),
  };
}
