import { useEffect, useRef, useState } from "react";

/**
 * useSSE — subscribe to a Server-Sent Events stream.
 * @param {string} url  SSE endpoint URL
 * @param {boolean} enabled  connect only when true
 * @returns {{ data: any, error: string|null, connected: boolean }}
 */
export default function useSSE(url, enabled = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const es = new EventSource(url);
    sourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        setData(JSON.parse(event.data));
      } catch {
        setError("Failed to parse SSE data");
      }
    };

    es.onerror = () => {
      setConnected(false);
      setError("SSE connection lost — retrying...");
    };

    return () => {
      es.close();
      sourceRef.current = null;
      setConnected(false);
    };
  }, [url, enabled]);

  return { data, error, connected };
}
