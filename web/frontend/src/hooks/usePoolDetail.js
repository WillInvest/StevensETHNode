import { useState, useEffect } from "react";

/**
 * Fetches metadata + summary counts for a single pool.
 */
export function usePoolDetail(protocol, version, address) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!protocol || !version || !address) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/explore/pool/${protocol}/${version}/${address}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (!cancelled) {
          setData(json.data ?? null);
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
  }, [protocol, version, address]);

  return { data, loading, error };
}
