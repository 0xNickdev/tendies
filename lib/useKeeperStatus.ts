"use client";

import { useEffect, useState } from "react";
import { fetchStatus, type KeeperStatus } from "./keeper";

// Live treasury numbers from the keeper. Null means the service isn't wired up
// yet — the UI then shows "TBA" rather than inventing a figure.
export function useKeeperStatus(pollMs = 30_000) {
  const [status, setStatus] = useState<KeeperStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await fetchStatus();
      if (!cancelled) setStatus(next);
    };
    load();
    const timer = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollMs]);

  return status;
}
