import { useState, useCallback } from "react";

const STORAGE_KEY_EXPANDED = "explore_sidebar_expanded";
const STORAGE_KEY_SEARCH = "explore_sidebar_search";
const STORAGE_KEY_POOL_GROUPS = "explore_sidebar_pool_groups";

function loadExpanded() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXPANDED);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveExpanded(state) {
  try {
    localStorage.setItem(STORAGE_KEY_EXPANDED, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function loadSearch() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SEARCH);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSearch(state) {
  try {
    localStorage.setItem(STORAGE_KEY_SEARCH, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function loadPoolGroups() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_POOL_GROUPS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePoolGroups(state) {
  try {
    localStorage.setItem(STORAGE_KEY_POOL_GROUPS, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

/**
 * Tracks which sidebar nodes are expanded, search queries, and pool group expanded states.
 * All persisted in localStorage.
 *
 * Keys:
 *   - expanded nodes: "dex", "dex/uniswap", "dex/uniswap/v3"
 *   - search queries: keyed by "protocol/version" (e.g., "uniswap/v3")
 *   - pool group states: keyed by "protocol/version/pairName" (e.g., "uniswap/v3/USDC-WETH")
 */
export function useSidebarState() {
  const [expanded, setExpanded] = useState(loadExpanded);
  const [searchQueries, setSearchQueries] = useState(loadSearch);
  const [poolGroups, setPoolGroups] = useState(loadPoolGroups);

  const toggle = useCallback((nodeKey) => {
    setExpanded((prev) => {
      const next = { ...prev, [nodeKey]: !prev[nodeKey] };
      saveExpanded(next);
      return next;
    });
  }, []);

  const isExpanded = useCallback(
    (nodeKey) => Boolean(expanded[nodeKey]),
    [expanded]
  );

  const setSearchQuery = useCallback((versionKey, query) => {
    setSearchQueries((prev) => {
      const next = { ...prev, [versionKey]: query };
      saveSearch(next);
      return next;
    });
  }, []);

  const getSearchQuery = useCallback(
    (versionKey) => searchQueries[versionKey] || "",
    [searchQueries]
  );

  const togglePoolGroup = useCallback((groupKey) => {
    setPoolGroups((prev) => {
      const next = { ...prev, [groupKey]: !prev[groupKey] };
      savePoolGroups(next);
      return next;
    });
  }, []);

  const isPoolGroupOpen = useCallback(
    (groupKey) => Boolean(poolGroups[groupKey]),
    [poolGroups]
  );

  return {
    isExpanded,
    toggle,
    setSearchQuery,
    getSearchQuery,
    togglePoolGroup,
    isPoolGroupOpen,
  };
}
