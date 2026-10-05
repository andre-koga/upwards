import { useEffect } from "react";
import { todayDateString } from "@/lib/time-utils";

/**
 * UI-only midnight timer. Calls `onReset` when the local date rolls over so
 * Today can move to the new date (and carry memos forward). Nothing is written
 * to the database at midnight; sessions are stored whole and each day's view
 * computes its share at read time.
 *
 * A long `setTimeout` is throttled or frozen while a phone sleeps, so the date
 * is also re-checked whenever the app becomes visible again.
 */
export function useDayResetTimer(onReset: () => void): void {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let lastDate = todayDateString();

    const rollOver = () => {
      const current = todayDateString();
      if (current === lastDate) return;
      lastDate = current;
      onReset();
    };

    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      );
      timeoutId = setTimeout(() => {
        rollOver();
        schedule();
      }, nextMidnight.getTime() - now.getTime());
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      rollOver();
      clearTimeout(timeoutId);
      schedule();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [onReset]);
}
