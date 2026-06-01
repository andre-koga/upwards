import { useCallback, useEffect, useRef, useState } from "react";
import { toDateString } from "@/lib/time-utils";
import {
  computeAndSaveLoginStreak,
  loadLastOpenedDate,
  loadLoginStreak,
  saveLastOpenedDate,
} from "@/lib/session/last-opened";

export interface AppOpenRecapState {
  recapDate: string | null;
  loginStreak: number;
  open: boolean;
  dismiss: () => void;
}

export function useAppOpenRecap(): AppOpenRecapState {
  const [recapDate, setRecapDate] = useState<string | null>(null);
  const [loginStreak, setLoginStreak] = useState(loadLoginStreak);
  const [open, setOpen] = useState(false);

  // Track whether we've already processed the current visibility session so
  // re-renders don't re-trigger the check.
  const checkedRef = useRef(false);

  const check = useCallback(() => {
    const today = toDateString(new Date());
    const lastDate = loadLastOpenedDate();

    // Compute and persist the new login streak before deciding what to show.
    const streak = computeAndSaveLoginStreak(lastDate, today);
    setLoginStreak(streak);

    if (lastDate && lastDate < today) {
      // User is opening for the first time after a previous day — show recap.
      setRecapDate(lastDate);
      setOpen(true);
    }

    saveLastOpenedDate(today);
  }, []);

  useEffect(() => {
    if (!checkedRef.current) {
      checkedRef.current = true;
      check();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        check();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [check]);

  const dismiss = useCallback(() => {
    setOpen(false);
  }, []);

  return { recapDate, loginStreak, open, dismiss };
}
