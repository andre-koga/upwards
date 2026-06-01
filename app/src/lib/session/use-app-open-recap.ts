import { useCallback, useEffect, useRef, useState } from "react";
import { getEffectiveToday } from "@/lib/session/day-reset";
import { splitPeriodsAtDayReset } from "@/lib/activity/split-period-at-reset";
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

  const checkedRef = useRef(false);

  const check = useCallback(async () => {
    // Split any periods that crossed a reset boundary while the app was closed.
    await splitPeriodsAtDayReset();

    const today = getEffectiveToday();
    const lastDate = loadLastOpenedDate();

    const streak = computeAndSaveLoginStreak(lastDate, today);
    setLoginStreak(streak);

    if (lastDate && lastDate < today) {
      setRecapDate(lastDate);
      setOpen(true);
    }

    saveLastOpenedDate(today);
  }, []);

  useEffect(() => {
    if (!checkedRef.current) {
      checkedRef.current = true;
      void check();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void check();
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
