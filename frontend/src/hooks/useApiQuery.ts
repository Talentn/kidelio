import { useEffect, useState } from "react";
import { apiV1, peekCacheV1 } from "../lib/api";

/**
 * Fetch GET data with instant render from cache (no skeleton flash on navigation).
 * Shows loading only when there is nothing cached yet for this URL.
 */
export function useApiQuery<T>(path: string | null, deps: unknown[] = []) {
  const url = path ? `/api/v1${path}` : null;

  const [data, setData] = useState<T | null>(() =>
    url ? peekCacheV1<T>(path!) : null
  );
  const [loading, setLoading] = useState(() =>
    url ? peekCacheV1<T>(path!) === null : false
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;

    let cancelled = false;
    const cached = peekCacheV1<T>(path);

    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError(false);

    apiV1<T>(path)
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  return { data, loading, error };
}
