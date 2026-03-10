import { useEffect, useState, memo, useMemo } from "react";
import { db } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { Square } from "lucide-react";
import { formatTimerDisplay, getGroup } from "@/lib/activity-utils";
import { getContrastColor } from "@/lib/color-utils";

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const safeHex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const r = parseInt(safeHex.slice(0, 2), 16);
  const g = parseInt(safeHex.slice(2, 4), 16);
  const b = parseInt(safeHex.slice(4, 6), 16);

  if ([r, g, b].some(Number.isNaN)) {
    return `rgba(59, 130, 246, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface ActiveActivityPillProps {
  currentActivityId: string | null;
  activities: Activity[];
  groups: ActivityGroup[];
  calculateActivityTime: (activityId: string) => number;
  onStop: () => void;
}

function ActiveActivityPill({
  currentActivityId,
  activities,
  groups,
  calculateActivityTime,
  onStop,
}: ActiveActivityPillProps) {
  const [tick, setTick] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [resolvedActivity, setResolvedActivity] = useState<Activity | null>(
    null
  );
  const [resolvedGroup, setResolvedGroup] = useState<ActivityGroup | null>(
    null
  );

  // Drive per-second re-renders
  useEffect(() => {
    if (!currentActivityId) return;
    const interval = setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [currentActivityId]);

  // Recalculate elapsed time on every tick
  useEffect(() => {
    if (!currentActivityId) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- syncing elapsed time with timer tick */
    setElapsedMs(calculateActivityTime(currentActivityId));
  }, [currentActivityId, calculateActivityTime, tick]);

  useEffect(() => {
    if (!currentActivityId) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- clearing when activity stops */
      setResolvedActivity(null);
      setResolvedGroup(null);
      return;
    }

    const fromProps = activities.find((a) => a.id === currentActivityId);
    if (fromProps) {
      setResolvedActivity(fromProps);
      setResolvedGroup(getGroup(groups, fromProps.group_id) ?? null);
      return;
    }

    let cancelled = false;

    const loadFromDb = async () => {
      try {
        const activity = await db.activities.get(currentActivityId);
        if (!activity || cancelled) return;

        const groupFromProps = getGroup(groups, activity.group_id);
        const group =
          groupFromProps ||
          (await db.activityGroups.get(activity.group_id)) ||
          null;

        if (!cancelled) {
          setResolvedActivity(activity);
          setResolvedGroup(group);
        }
      } catch (error) {
        console.error("Error loading active activity:", error);
      }
    };

    loadFromDb();

    return () => {
      cancelled = true;
    };
  }, [currentActivityId, activities, groups]);

  // Calculate color values before early returns (Rules of Hooks)
  const activity = resolvedActivity;
  const group = resolvedGroup;
  const color = activity?.color || group?.color || "#3b82f6";
  const textColor = useMemo(() => getContrastColor(color), [color]);
  const boxShadow = useMemo(
    () =>
      `0 0 16px ${hexToRgba(color, 0.4)}, 0 0 34px ${hexToRgba(color, 0.28)}`,
    [color]
  );

  if (!currentActivityId) {
    return null;
  }

  if (!activity) {
    return null;
  }

  return (
    <div
      className="rounded-2xl px-4 py-3 shadow-sm"
      style={{
        backgroundColor: color,
        color: textColor,
        boxShadow,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {group?.name && (
            <p className="mb-0.5 truncate text-xs uppercase tracking-wide opacity-80">
              {group.name}
            </p>
          )}
          <p className="truncate text-lg font-semibold leading-tight">
            {activity.name}
          </p>
        </div>
        <span
          className="shrink-0 text-sm"
          style={{ fontFamily: "JetBrains Mono, monospace" }}
        >
          {formatTimerDisplay(elapsedMs)}
        </span>
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onStop}
          className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide"
          style={{ color: textColor }}
          title="Stop this activity"
        >
          <Square className="h-3.5 w-3.5" style={{ fill: textColor }} />
          <span>Stop</span>
        </button>
      </div>
    </div>
  );
}

export default memo(ActiveActivityPill);
