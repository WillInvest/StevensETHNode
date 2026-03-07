import { useState, useEffect } from "react";

/**
 * Fetches and caches the pool list for a protocol/version.
 * Only fetches when the version node is expanded.
 */
export function usePoolList(protocol, version, enabled = true) {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !protocol || !version) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/explore/pools/${protocol}/${version}?limit=20`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (!cancelled) {
          setPools(json.data ?? []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [protocol, version, enabled]);

  return { pools, loading, error };
}
