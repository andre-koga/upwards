import { useEffect } from "react";
import { getNextResetTime } from "@/lib/session/day-reset";

/**
 * Schedules a one-shot timer that fires at the next configured day-reset time.
 * When it fires: calls onReset so the parent can re-render with the new
 * effective date.  Re-schedules itself each time so resets keep working even
 * if the app stays open overnight.
 *
 * No DB-level period splitting is performed here; the frontend clips periods
 * to the effective day at render time.
 */
export function useDayResetTimer(onReset: () => void): void {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const next = getNextResetTime();
      const msUntilReset = next.getTime() - Date.now();

      timeoutId = setTimeout(() => {
        onReset();
        schedule();
      }, msUntilReset);
    };

    schedule();
    return () => clearTimeout(timeoutId);
  }, [onReset]);
}
