import { useEffect } from "react";
import { getNextResetTime } from "@/lib/session/day-reset";
import { splitPeriodsAtDayReset } from "@/lib/activity/split-period-at-reset";

/**
 * Schedules a one-shot timer that fires at the next configured day-reset time.
 * When it fires: splits any open activity periods and calls onReset so the
 * parent can re-render with the new effective date.
 *
 * Re-schedules itself each time so resets keep working even if the app stays
 * open overnight.
 */
export function useDayResetTimer(onReset: () => void): void {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const next = getNextResetTime();
      const msUntilReset = next.getTime() - Date.now();

      timeoutId = setTimeout(async () => {
        await splitPeriodsAtDayReset();
        onReset();
        schedule(); // reschedule for the following day
      }, msUntilReset);
    };

    schedule();
    return () => clearTimeout(timeoutId);
  }, [onReset]);
}
