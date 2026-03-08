/**
 * WRDS-style dataset registry.
 * Maps protocol → version → datasets (DB tables).
 *
 * Each dataset defines:
 *   table          - actual PostgreSQL table name
 *   label          - human-friendly name
 *   description    - one-line description shown in the dataset picker
 *   blockColumn    - column used for block-range filtering (usually "block_num")
 *   defaultColumns - columns pre-selected when the form opens
 */

export const DATASET_REGISTRY = [
  {
    id: "uniswap",
    label: "Uniswap",
    category: "dex",
    versions: [
      {
        id: "v3",
        label: "V3",
        datasets: [
          {
            id: "mints",
            label: "Mints",
            table: "uniswap_v3_mints",
            description: "Liquidity addition events (mint) on Uniswap V3 pools",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "pool_address", "amount", "amount0", "amount1", "tick_lower", "tick_upper"],
          },
          {
            id: "burns",
            label: "Burns",
            table: "uniswap_v3_burns",
            description: "Liquidity removal events (burn) on Uniswap V3 pools",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "pool_address", "amount", "amount0", "amount1", "tick_lower", "tick_upper"],
          },
          {
            id: "tick_snapshots",
            label: "Tick Snapshots",
            table: "uniswap_v3_tick_snapshots",
            description: "Periodic tick-level liquidity snapshots for Uniswap V3 pools",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "pool_address", "tick", "liquidity_gross", "liquidity_net"],
          },
        ],
      },
    ],
  },
  {
    id: "aave",
    label: "Aave",
    category: "lending",
    versions: [
      {
        id: "v3",
        label: "V3",
        datasets: [
          {
            id: "supply",
            label: "Supply",
            table: "aave_v3_supply",
            description: "Assets supplied (deposited) into Aave V3 lending pools",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "reserve", "user", "amount", "on_behalf_of"],
          },
          {
            id: "borrow",
            label: "Borrow",
            table: "aave_v3_borrow",
            description: "Borrow events from Aave V3 — tracks debt positions",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "reserve", "user", "amount", "borrow_rate", "interest_rate_mode"],
          },
          {
            id: "repay",
            label: "Repay",
            table: "aave_v3_repay",
            description: "Debt repayment events on Aave V3",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "reserve", "user", "repayer", "amount"],
          },
          {
            id: "liquidation",
            label: "Liquidation",
            table: "aave_v3_liquidation",
            description: "Liquidation call events — undercollateralised position seizures",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "collateral_asset", "debt_asset", "user", "debt_to_cover", "liquidated_collateral_amount"],
          },
        ],
      },
    ],
  },
  {
    id: "compound",
    label: "Compound",
    category: "lending",
    versions: [
      {
        id: "v3",
        label: "V3",
        datasets: [
          {
            id: "supply",
            label: "Supply",
            table: "compound_v3_supply",
            description: "Supply events into Compound V3 comet contracts",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "comet", "from", "dst", "amount"],
          },
          {
            id: "withdraw",
            label: "Withdraw",
            table: "compound_v3_withdraw",
            description: "Withdrawal events from Compound V3",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "comet", "src", "to", "amount"],
          },
          {
            id: "absorb",
            label: "Absorb (Liquidation)",
            table: "compound_v3_absorb",
            description: "Liquidation (absorb) events in Compound V3",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "comet", "absorber", "borrower", "base_paid_out", "base_absorbed"],
          },
        ],
      },
    ],
  },
  {
    id: "curve",
    label: "Curve",
    category: "dex",
    versions: [
      {
        id: "v1",
        label: "Pools",
        datasets: [
          {
            id: "add_liquidity",
            label: "Add Liquidity",
            table: "curve_add_liquidity",
            description: "Liquidity provision events on Curve pools",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "pool_address", "provider", "token_amounts", "lp_token_supply"],
          },
          {
            id: "token_exchange",
            label: "Token Exchange (Swaps)",
            table: "curve_token_exchange",
            description: "Token swap events on Curve pools",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "pool_address", "buyer", "sold_id", "tokens_sold", "bought_id", "tokens_bought"],
          },
        ],
      },
    ],
  },
  {
    id: "lido",
    label: "Lido",
    category: "liquid_staking",
    versions: [
      {
        id: "v1",
        label: "stETH",
        datasets: [
          {
            id: "submitted",
            label: "Submissions (Staking)",
            table: "lido_submitted",
            description: "ETH staking submissions to Lido — new stETH minted",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "sender", "amount", "referral"],
          },
          {
            id: "transfer_shares",
            label: "Share Transfers",
            table: "lido_transfer_shares",
            description: "stETH share transfer events",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "from", "to", "shares_value"],
          },
        ],
      },
    ],
  },
  {
    id: "hyperliquid",
    label: "Hyperliquid",
    category: "perps",
    versions: [
      {
        id: "v1",
        label: "L1",
        datasets: [
          {
            id: "positions",
            label: "Positions",
            table: "hl_positions",
            description: "Open perpetual positions on Hyperliquid",
            blockColumn: null,
            defaultColumns: ["address", "coin", "size", "entry_px", "unrealized_pnl", "margin_used"],
          },
        ],
      },
    ],
  },
  {
    id: "bridges",
    label: "Bridges",
    category: "bridge",
    versions: [
      {
        id: "arbitrum",
        label: "Arbitrum",
        datasets: [
          {
            id: "message_delivered",
            label: "Messages Delivered",
            table: "arb_message_delivered",
            description: "Cross-chain message delivery events on the Arbitrum bridge",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "message_index", "before_inbox_acc", "inbox", "sender", "value"],
          },
        ],
      },
      {
        id: "base",
        label: "Base",
        datasets: [
          {
            id: "tx_deposited",
            label: "Deposits",
            table: "base_tx_deposited",
            description: "ETH/token deposit events into the Base bridge",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "from", "to", "mint"],
          },
        ],
      },
      {
        id: "optimism",
        label: "Optimism",
        datasets: [
          {
            id: "tx_deposited",
            label: "Deposits",
            table: "op_tx_deposited",
            description: "ETH/token deposit events into the Optimism bridge",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "from", "to", "mint"],
          },
        ],
      },
    ],
  },
  {
    id: "erc20",
    label: "ERC-20",
    category: "tokens",
    versions: [
      {
        id: "v1",
        label: "Transfers",
        datasets: [
          {
            id: "transfers",
            label: "Transfers",
            table: "erc20_transfers",
            description: "ERC-20 token transfer events — requires at least one filter (large table)",
            blockColumn: "block_num",
            defaultColumns: ["block_num", "tx_hash", "contract_address", "from", "to", "value"],
            requiresFilter: true,
          },
        ],
      },
    ],
  },
];

/** Look up a specific dataset by protocol / version / dataset IDs. */
export function findDataset(protocolId, versionId, datasetId) {
  const protocol = DATASET_REGISTRY.find((p) => p.id === protocolId);
  if (!protocol) return null;
  const version = protocol.versions.find((v) => v.id === versionId);
  if (!version) return null;
  return version.datasets.find((d) => d.id === datasetId) ?? null;
}
