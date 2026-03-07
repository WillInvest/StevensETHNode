// Etherscan block explorer integration

export const ETHERSCAN_BASE = "https://etherscan.io";

/**
 * Check if a value looks like a transaction hash (66-char 0x-prefixed hex string)
 * @param {string} value
 * @returns {boolean}
 */
export function isTxHash(value) {
  if (!value || typeof value !== "string") return false;
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

/**
 * Check if a value looks like an address (42-char 0x-prefixed hex string)
 * @param {string} value
 * @returns {boolean}
 */
export function isAddress(value) {
  if (!value || typeof value !== "string") return false;
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

/**
 * Get Etherscan URL for a transaction hash
 * @param {string} hash
 * @returns {string}
 */
export function getTxUrl(hash) {
  if (!isTxHash(hash)) return null;
  return `${ETHERSCAN_BASE}/tx/${hash}`;
}

/**
 * Get Etherscan URL for an address
 * @param {string} address
 * @returns {string}
 */
export function getAddressUrl(address) {
  if (!isAddress(address)) return null;
  return `${ETHERSCAN_BASE}/address/${address}`;
}
