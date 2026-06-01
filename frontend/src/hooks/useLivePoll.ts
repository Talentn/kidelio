import { useEffect, useRef } from "react";

type LivePollOptions = {
  /** Poll interval in ms. Default 5 000. */
  interval?: number;
  /** When false, polling is paused. Default true. */
  enabled?: boolean;
};

/**
 * Polls a fetcher on an interval while the tab is visible.
 * Pauses when the tab is hidden; refreshes immediately when it becomes visible again.
 */
export function useLivePoll(
  fetcher: () => void | Promise<void>,
  deps: unknown[] = [],
  { interval = 5_000, enabled = true }: LivePollOptions = {}
) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.hidden) return;
      void fetcherRef.current();
    };

    const id = window.setInterval(tick, interval);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, enabled, ...deps]);
}
