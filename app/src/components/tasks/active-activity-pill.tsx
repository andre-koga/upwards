import { useEffect, useState, memo, useMemo } from "react";
import { db } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { Square } from "lucide-react";
import {
  formatTimerDisplay,
  getActivityDisplayName,
  getGroup,
} from "@/lib/activity";
import { getContrastColor } from "@/lib/color-utils";
import { Button } from "@/components/ui/button";

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
  elapsedMs: number;
  onStop: () => void;
  /** When set, clicking the pill opens the session edit dialog. */
  onEdit?: () => void;
}

function ActiveActivityPill({
  currentActivityId,
  activities,
  groups,
  elapsedMs,
  onStop,
  onEdit,
}: ActiveActivityPillProps) {
  const [resolvedActivity, setResolvedActivity] = useState<Activity | null>(
    null
  );
  const [resolvedGroup, setResolvedGroup] = useState<ActivityGroup | null>(
    null
  );

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
  const color = group?.color || "#3b82f6";
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
      className="rounded-2xl p-3 shadow-sm"
      style={{
        backgroundColor: color,
        color: textColor,
        boxShadow,
      }}
      onClick={onEdit}
      onKeyDown={
        onEdit
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEdit();
              }
            }
          : undefined
      }
      role={onEdit ? "button" : undefined}
      tabIndex={onEdit ? 0 : undefined}
      aria-label={onEdit ? "Edit running activity" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {group?.name && (
            <p className="mb-0.5 truncate text-xs font-medium leading-normal text-current">
              {group.name}
            </p>
          )}
          <p className="truncate text-base font-semibold leading-snug tracking-tight text-current">
            {getActivityDisplayName(activity, group)}
          </p>
        </div>
        <div className="shrink-0 tabular-nums">
          <p className="font-mono text-sm leading-snug">
            {formatTimerDisplay(elapsedMs)}
          </p>
        </div>
      </div>

      <div className="mt-1.5 flex justify-end">
        <Button
          type="button"
          variant="bare"
          onClick={(event) => {
            event.stopPropagation();
            onStop();
          }}
          className="inline-flex h-auto cursor-pointer items-center gap-1 px-1 py-0 text-xs font-semibold"
          style={{ color: textColor }}
          title="Stop this activity"
        >
          <Square className="h-3 w-3" style={{ fill: textColor }} />
          <span className="shrink-0 text-base uppercase">Stop</span>
        </Button>
      </div>
    </div>
  );
}

export default memo(ActiveActivityPill);
