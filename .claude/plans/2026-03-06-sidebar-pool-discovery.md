# Implementation Plan: Improved Pool Navigation/Discovery UX for Explore Sidebar

## Overview
The Explore sidebar currently displays pools with duplicate pair names repeated for different fee tiers, making navigation cluttered. This plan introduces grouped pool discovery with search, filtering, and metadata badges to help power users quickly find pools. The implementation prioritizes incremental value delivery through 4 phases, each independently mergeable.

## Problem Analysis
- Current state: Flat list of 20 pools sorted by swap count, with names like "USDC-WETH (0.3%)", "USDC-WETH (0.05%)" repeated
- Pain point: Hard to scan when looking for a specific pair; multiple fee tiers for same pair scattered throughout list
- Backend capability: Already returns `pool_address`, `display_name`, `fee_label`, `token0_symbol`, `token1_symbol`, `swap_count`
- User persona: Power users analyzing DeFi pools, want quick access to favorite pairs and TVL/volume context

## Architecture Changes
- **New component**: `PoolSearchFilter.jsx` — search input + sort selector at top of PoolNodes
- **New hook**: `usePoolGrouping.js` — groups pools by pair name, supports sort/filter
- **Enhanced usePoolList**: Optionally extend backend `/api/explore/pools/{protocol}/{version}` to return TVL data (Phase 3)
- **New localStorage key**: Track pinned pools and recently viewed pools
- **Styling**: Use existing CSS variables for badge styling (dark theme with cyan accents)

## Requirements
- Search/filter must be responsive and instant (client-side for <100 pools)
- Grouping must preserve fee tier information and swap counts
- Pinning feature optional but encouraged for power users
- Recent pools feature improves discoverability without cognitive load
- All changes maintain accessibility and keyboard navigation
- Keep sidebar width unchanged (240px)

## Implementation Steps

### Phase 1: Search/Filter Bar (Quick Win, ~2 hours)
Highest impact, lowest complexity. Users can type pool names to reduce list immediately.

1. **Create PoolSearchFilter component** (File: `web/frontend/src/components/explore/PoolSearchFilter.jsx`)
   - Action: Build a controlled input component with debounce
   - Features:
     - Text input that filters pools by token symbols (USDC, WETH, etc.)
     - Case-insensitive substring matching on both `display_name` and `token0_symbol`/`token1_symbol`
     - Real-time filtering (no server call — use existing pool data)
     - Clear button (X icon) to reset
     - Visual cue showing "X of Y pools" below input
   - Styling:
     - Use `--sidebar-bg` for input background
     - Border: `1px solid var(--sidebar-border)`
     - Focus: `box-shadow: 0 0 8px var(--cyan-bg)`
     - Inline with sidebar hierarchy (at top of version section)
   - Error handling: Graceful no-results state
   - Keyboard: Escape to clear, Tab to navigate

2. **Integrate PoolSearchFilter into PoolNodes** (File: `web/frontend/src/components/explore/SidebarTree.jsx`)
   - Action: Add state hook for search query, pass filtered pools to render loop
   - Modify `PoolNodes` component to:
     - Accept optional `searchQuery` prop
     - Filter pools before rendering
     - Show filtered count in a small badge
   - Why: Keeps search state isolated to the version node
   - Dependencies: Step 1
   - Risk: Low

3. **Add search state management** (File: `web/frontend/src/hooks/useSidebarState.js`)
   - Action: Extend existing hook to track search queries per version (keyed by `protocol/version`)
   - Store in localStorage under `explore_sidebar_search`
   - Why: Preserve user's search across page reloads
   - Dependencies: None
   - Risk: Low

4. **Add styling for results count badge** (File: `web/frontend/src/index.css`)
   - Action: Add CSS class `.pool-search-results-badge` with muted text and small font
   - Example: "12 of 47 pools"
   - Why: Visual feedback on filtering effectiveness
   - Risk: Low

### Phase 2: Group Pools by Pair + Fee Tier Badges (Core Feature, ~3 hours)
Makes the list scannable by grouping identical pairs, showing fee tiers as sub-items.

1. **Create usePoolGrouping hook** (File: `web/frontend/src/hooks/usePoolGrouping.js`)
   - Action: Transform flat pool array into grouped structure
   - Logic:
     - Group by `display_name` (e.g., all "USDC-WETH" pools together)
     - Each group: `{ name, pools: [{ address, fee_label, swap_count }, ...] }`
     - Sort pools within group by fee_label (0.01%, 0.05%, 0.3%, 1%)
   - Return structure:
     ```javascript
     [
       {
         pairName: "USDC-WETH",
         pools: [
           { pool_address, display_name, fee_label, swap_count, ... },
           { pool_address, display_name, fee_label, swap_count, ... },
         ]
       },
       ...
     ]
     ```
   - Why: Consolidate duplicate pairs into one UI element
   - Dependencies: None (pure transformation)
   - Risk: Low

2. **Create PoolGroup component** (File: `web/frontend/src/components/explore/PoolGroup.jsx`)
   - Action: Render a collapsible group with fee tier sub-items
   - Structure:
     - Header: pair name (e.g., "USDC-WETH") with expand/collapse chevron
     - Collapsed state: shows "3 pools" badge
     - Expanded state: list fee tiers as links (0.3%, 0.05%, etc.)
   - Styling:
     - Group header: slightly bolder than individual pools, padding adjusted
     - Fee badge: small pill with `background: rgba(52, 152, 219, 0.12)`, use `--sidebar-text-muted`
     - Hover: highlight the group header only (not sub-items yet)
   - Interactivity:
     - Click chevron or header to toggle expanded
     - Click fee tier to navigate
     - Preserve expanded state in useSidebarState (new key: `pool_groups/{protocol/version}/{pairName}`)
   - Why: Reduce visual clutter while maintaining all pool access
   - Risk: Medium — managing sub-expand state

3. **Refactor PoolNodes to use grouping** (File: `web/frontend/src/components/explore/SidebarTree.jsx`)
   - Action: Replace flat map with grouped iteration
   - New flow:
     - Fetch pools (existing)
     - Group pools (new: usePoolGrouping)
     - Apply search filter (from Phase 1)
     - Render PoolGroup components instead of NavLinks
   - Keep existing keyboard nav working
   - Why: Consolidates rendering logic
   - Dependencies: Steps 2 and Phase 1
   - Risk: Medium — refactoring existing component

4. **Update pool metadata display** (File: `web/frontend/src/components/explore/PoolGroup.jsx`)
   - Action: Show fee_label inline next to pair name in header
   - Display swap_count in a muted badge for top pool in group
   - Example: "USDC-WETH — 5.2K swaps — 3 tiers"
   - Why: Power users understand TVL immediately from context
   - Risk: Low

### Phase 3: Sort Options + TVL Display (Enhancement, ~2 hours)
Adds TVL awareness and flexible sorting to match power user workflows.

1. **Extend backend to return TVL** (File: `web/routers/explore.py`)
   - Action: Update `/api/explore/pools/{protocol}/{version}` endpoint
   - Add TVL calculation in response:
     ```python
     # For each pool, query uniswap_v3.positions to estimate liquidity
     # Or use cached snapshots if available
     tvl_usd = calculated_tvl
     ```
   - New response field per pool:
     ```json
     {
       "pool_address": "0x...",
       "display_name": "USDC-WETH",
       "fee_label": "0.3%",
       "swap_count": 5432,
       "tvl_usd": 8500000.0,
       "token0_symbol": "USDC",
       "token1_symbol": "WETH"
     }
     ```
   - Why: Frontend needs TVL data to sort meaningfully
   - Note: If TVL queries are too expensive, skip this and use swap_count as proxy
   - Risk: Medium — query performance
   - Dependencies: None

2. **Create PoolSortSelector component** (File: `web/frontend/src/components/explore/PoolSortSelector.jsx`)
   - Action: Radio/select dropdown for sort options (placed next to search input)
   - Options:
     - "By Swap Count" (default, current behavior)
     - "By TVL" (if available, else disabled with tooltip)
     - "By Pair Name A-Z"
     - "By Fee Tier"
   - Styling: Small button/dropdown next to search input, same theme
   - Why: Power users may prefer different sort orders
   - Risk: Low
   - Dependencies: Phase 1 (layout)

3. **Add TVL display in PoolGroup header** (File: `web/frontend/src/components/explore/PoolGroup.jsx`)
   - Action: Show TVL badge next to swap count
   - Format: "$8.5M TVL" (use `formatNumber` utility if available, else build one)
   - Styling: Aligned right, muted color, smaller font
   - Why: Users want to see pool size at a glance
   - Risk: Low
   - Dependencies: Step 1

4. **Implement sort logic in usePoolGrouping** (File: `web/frontend/src/hooks/usePoolGrouping.js`)
   - Action: Accept `sortBy` parameter and sort groups accordingly
   - Logic:
     - "By Swap Count": sort groups by max swap_count in group
     - "By TVL": sort groups by max tvl_usd
     - "By Name": alphabetical on pairName
     - "By Fee": sort by most common fee tier (0.3% first)
   - Why: Flexible grouping based on user selection
   - Dependencies: Step 2
   - Risk: Low

### Phase 4: Recent Pools + Pin Feature (Optional Polish, ~2 hours)
Improves discoverability for frequently-used pools without cluttering main list.

1. **Create useRecentPools hook** (File: `web/frontend/src/hooks/useRecentPools.js`)
   - Action: Track last 5 visited pools in localStorage
   - Structure: `explore_recent_pools: [{ pool_address, display_name, timestamp }, ...]`
   - Update on pool view (when user clicks a pool link in sidebar)
   - Expire entries older than 30 days
   - Why: Users often revisit same pools repeatedly
   - Risk: Low
   - Dependencies: None

2. **Create RecentPoolsSection component** (File: `web/frontend/src/components/explore/RecentPoolsSection.jsx`)
   - Action: Show recent pools at top of version node, above search bar
   - Features:
     - Horizontal pill layout: "Recent > USDC-WETH (0.3%) | WETH-DAI (0.3%)"
     - Click pill to navigate
     - Show "No recent" if empty
     - Styled like quick-access bar
   - Styling: Subtle background color, rounded pills
   - Why: Reduce friction for power users checking same pools
   - Risk: Low

3. **Create usePinnedPools hook** (File: `web/frontend/src/hooks/usePinnedPools.js`)
   - Action: Manage pinned/favorite pools in localStorage
   - Structure: `explore_pinned_pools: [pool_address, ...]`
   - Provide `pin(address)`, `unpin(address)`, `isPinned(address)` functions
   - Why: Users want to favorite important pools
   - Risk: Low

4. **Add pin/unpin button to pool items** (File: `web/frontend/src/components/explore/PoolGroup.jsx`)
   - Action: Add star icon (filled/hollow) to right of each pool in expanded group
   - Hover: show tooltip "Pin this pool"
   - Click: toggle pin status
   - Styling: Use `--cyan` when pinned
   - Why: Visual UI for favoriting
   - Risk: Low
   - Dependencies: Step 3

5. **Reorder groups to show pinned first** (File: `web/frontend/src/hooks/usePoolGrouping.js`)
   - Action: Extend grouping logic to move groups containing pinned pools to top
   - Style: Add subtle highlight to groups with pinned pools
   - Why: Pinned pools remain immediately accessible
   - Risk: Low
   - Dependencies: Steps 3 and 4

## File Structure Summary

### New Files (Phase 1)
- `web/frontend/src/components/explore/PoolSearchFilter.jsx`

### New Files (Phase 2)
- `web/frontend/src/hooks/usePoolGrouping.js`
- `web/frontend/src/components/explore/PoolGroup.jsx`

### New Files (Phase 3)
- `web/frontend/src/components/explore/PoolSortSelector.jsx`

### New Files (Phase 4)
- `web/frontend/src/hooks/useRecentPools.js`
- `web/frontend/src/hooks/usePinnedPools.js`
- `web/frontend/src/components/explore/RecentPoolsSection.jsx`

### Modified Files
- `web/frontend/src/components/explore/SidebarTree.jsx` — integrate search, grouping
- `web/frontend/src/hooks/useSidebarState.js` — extend to track search queries and group expanded states
- `web/routers/explore.py` — optionally add TVL endpoint (Phase 3)
- `web/frontend/src/index.css` — add badge and component styling

## Testing Strategy

### Unit Tests
- `usePoolGrouping.test.js` — grouping logic, sorting
- `PoolSearchFilter.test.js` — filter matching, debounce
- `usePinnedPools.test.js` — localStorage persistence
- `useRecentPools.test.js` — recent pool tracking

### Integration Tests
- Pool list fetch → grouping → render flow
- Search filter + grouping combination
- Sort order changes update display
- Pin/recent localStorage roundtrips
- Sidebar state persistence across reloads

### E2E Tests (Selenium/Playwright)
- User opens sidebar → searches for "USDC" → sees filtered list
- User expands USDC-WETH group → clicks 0.3% fee tier → navigates to pool
- User pins USDC-WETH pool → closes/reopens sidebar → pinned pool shows first
- User visits 3 pools → Recent section shows all 3
- User changes sort to "By TVL" → list reorganizes

## Risks & Mitigations

- **Risk**: Grouping logic fails to match pairs correctly (e.g., "USDC-WETH" vs "WETH-USDC")
  - Mitigation: Normalize pair names in backend (always alphabetical symbols), document in code

- **Risk**: TVL query is too slow, blocks pool list
  - Mitigation: Make TVL optional; start without it, add caching layer if needed (Phase 3)

- **Risk**: Search input creates keyboard focus issues in expandable tree
  - Mitigation: Test keyboard navigation (Tab, Enter, Escape) thoroughly; use `onKeyDown` events

- **Risk**: Pinned/recent features create excessive localStorage writes
  - Mitigation: Debounce updates, batch writes, set reasonable limits (5 recent, 20 pinned max)

- **Risk**: Grouped list changes visual height, sidebar scroll position jumps when expanding groups
  - Mitigation: Use `scroll-behavior: smooth` CSS, preserve scroll position in state if needed

## Success Criteria

- [ ] Phase 1: Search/filter reduces 20-pool list to <10 pools by typing "USDC"
- [ ] Phase 1: Search clears properly and list returns to full view
- [ ] Phase 2: USDC-WETH appears once as collapsed group with "3 pools" badge
- [ ] Phase 2: Expanding USDC-WETH group shows 0.05%, 0.3%, 1% fee tiers as links
- [ ] Phase 2: Clicking fee tier navigates to correct pool
- [ ] Phase 2: Group expanded state persists across sidebar reloads (localStorage)
- [ ] Phase 3: Sort dropdown changes pool order when toggled
- [ ] Phase 3: TVL displays next to swap count (if implemented)
- [ ] Phase 4: Recent pools section shows last 3 visited pools
- [ ] Phase 4: Pinned pool shows star icon; clicking star toggles pin status
- [ ] Phase 4: Pinned pools appear at top of list
- [ ] All: Sidebar width unchanged (240px), no horizontal scroll
- [ ] All: Keyboard navigation works (Tab, Enter, Escape)
- [ ] All: Responsive to dark theme with cyan accents (CSS variables)
- [ ] All: Tests pass with 80%+ coverage

## Implementation Order (Recommended)

1. **Phase 1** → Merge (quick UX win)
2. **Phase 2** → Merge (complete core feature)
3. **Phase 3** → Merge (power user enhancement)
4. **Phase 4** → Optional (polish)

Each phase is independently useful and can be merged separately.

## Design Notes

- Keep all existing sidebar styling (padding, colors, transitions)
- Use `--sidebar-item-hover: rgba(52, 152, 219, 0.08)` for group header hover
- Use `--sidebar-text-muted: #7a93a8` for badges and secondary text
- Use `--cyan: #22d3ee` for pinned star icon
- Maintain `font-size: 12px` for pool items, `12.5px` for version headers
- Preserve keyboard accessibility: all interactive elements must be focusable and keyboard operable

## Future Enhancements (Out of Scope)

- Pair favoriting with custom sorting
- Pool watchlist synced to backend (per-user persistence)
- Advanced filtering (fee tier, TVL range, swap range)
- Pool comparison view
- Custom sidebar themes
