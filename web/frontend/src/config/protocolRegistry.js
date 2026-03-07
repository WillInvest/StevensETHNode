/**
 * Static protocol hierarchy for the Explore sidebar.
 * The structure mirrors /api/explore/registry but is kept here
 * to allow instant render without an extra network round-trip.
 */
export const PROTOCOL_REGISTRY = {
  categories: [
    {
      id: "dex",
      label: "Decentralized Exchange",
      protocols: [
        {
          id: "uniswap",
          label: "Uniswap",
          versions: [
            {
              id: "v3",
              label: "V3",
              active: true,
              tabs: ["swaps", "liquidity", "stats", "query"],
            },
            { id: "v2", label: "V2", comingSoon: true },
            { id: "v4", label: "V4", comingSoon: true },
          ],
        },
        { id: "curve", label: "Curve", comingSoon: true },
      ],
    },
    {
      id: "lending",
      label: "Decentralized Lending",
      comingSoon: true,
      protocols: [
        { id: "aave", label: "Aave V3", comingSoon: true },
        { id: "compound", label: "Compound V3", comingSoon: true },
      ],
    },
  ],
};
