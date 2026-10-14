import { useCallback, useEffect, useState } from "react";
import { loadHomeDigest, type HomeDigest } from "@/lib/home/load-digest";
import { todayDateString } from "@/lib/time-utils";

/** The no-AI digest for today, read from this device. `reload` re-reads it after a pin. */
export function useHomeDigest() {
  const [digest, setDigest] = useState<HomeDigest | null>(null);

  const reload = useCallback(async () => {
    try {
      setDigest(await loadHomeDigest(todayDateString()));
    } catch (error) {
      console.error("Error loading the Home digest:", error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadHomeDigest(todayDateString())
      .then((next) => {
        if (!cancelled) setDigest(next);
      })
      .catch((error) => console.error("Error loading the Home digest:", error));
    return () => {
      cancelled = true;
    };
  }, []);

  return { digest, reload };
}
