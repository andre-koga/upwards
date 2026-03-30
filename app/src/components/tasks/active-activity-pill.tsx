import { useEffect, useState, memo, useMemo } from "react";
import { useRef } from "react";
import { db } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HOLD_ACTION_DELAY_MS } from "@/lib/constants";
import {
  formatTimerDisplay,
  getActivityDisplayName,
  getGroup,
} from "@/lib/activity";
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
  elapsedMs: number;
  onStop: () => void;
  /** When set, holding the pill opens the session edit dialog. */
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
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextStopClickRef = useRef(false);

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

  useEffect(() => {
    return () => {
      if (holdTimerRef.current != null) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const clearHoldTimer = () => {
    if (holdTimerRef.current != null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleHoldStart = () => {
    if (!onEdit) return;
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      suppressNextStopClickRef.current = true;
      onEdit();
    }, HOLD_ACTION_DELAY_MS);
  };

  const handleHoldEnd = () => {
    clearHoldTimer();
  };

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
      className="rounded-2xl p-3.5 shadow-sm"
      style={{
        backgroundColor: color,
        color: textColor,
        boxShadow,
      }}
      onPointerDown={onEdit ? handleHoldStart : undefined}
      onPointerUp={onEdit ? handleHoldEnd : undefined}
      onPointerCancel={onEdit ? handleHoldEnd : undefined}
      onContextMenu={onEdit ? (e) => e.preventDefault() : undefined}
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
      aria-label={onEdit ? "Hold to edit running activity" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {group?.name && (
            <p className="mb-0.5 truncate text-xs uppercase tracking-wide opacity-80">
              {group.name}
            </p>
          )}
          <p className="truncate text-lg font-semibold leading-tight">
            {getActivityDisplayName(activity, group)}
          </p>
        </div>
        <div>
          <p className="font-mono">{formatTimerDisplay(elapsedMs)}</p>
        </div>
      </div>

      <div className="mt-2 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (suppressNextStopClickRef.current) {
              suppressNextStopClickRef.current = false;
              return;
            }
            onStop();
          }}
          className="h-auto gap-2 p-0 text-sm font-semibold uppercase tracking-wide shadow-none hover:bg-transparent"
          style={{ color: textColor }}
          title="Stop this activity"
        >
          <Square className="h-3.5 w-3.5" style={{ fill: textColor }} />
          <span className="shrink-0 text-base">STOP</span>
        </Button>
      </div>
    </div>
  );
}

export default memo(ActiveActivityPill);
