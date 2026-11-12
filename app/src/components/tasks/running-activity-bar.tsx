import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Square } from "lucide-react";
import { db } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  formatTimerDisplay,
  getActivityDisplayName,
  getGroup,
} from "@/lib/activity";
import { DEFAULT_GROUP_COLOR, getContrastColor } from "@/lib/color-utils";
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
  if ([r, g, b].some(Number.isNaN)) return `rgba(59, 130, 246, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface RunningActivityBarProps {
  currentActivityId: string | null;
  activities: Activity[];
  groups: ActivityGroup[];
  elapsedMs: number;
  onStop: () => void;
  /** Opens the running session's details (rename note, adjust start). */
  onEdit?: () => void;
}

/**
 * The live session, pinned under the day header so it is on screen whatever the
 * list is doing: name, a running clock, and Stop. It is the one place a group's
 * color fills a whole surface, with a soft glow, so a running timer is
 * unmistakable. The text color is picked for contrast against that fill.
 */
export default function RunningActivityBar({
  currentActivityId,
  activities,
  groups,
  elapsedMs,
  onStop,
  onEdit,
}: RunningActivityBarProps) {
  const { t } = useTranslation("today", { keyPrefix: "running" });
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

    // Archived or deleted since it started: fall back to the database.
    let cancelled = false;
    const loadFromDb = async () => {
      try {
        const activity = await db.activities.get(currentActivityId);
        if (!activity || cancelled) return;
        const group =
          getGroup(groups, activity.group_id) ||
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
    void loadFromDb();
    return () => {
      cancelled = true;
    };
  }, [currentActivityId, activities, groups]);

  const color = resolvedGroup?.color || DEFAULT_GROUP_COLOR;
  const textColor = useMemo(() => getContrastColor(color), [color]);
  const boxShadow = useMemo(
    () =>
      `0 0 16px ${hexToRgba(color, 0.4)}, 0 0 34px ${hexToRgba(color, 0.28)}`,
    [color]
  );

  if (!currentActivityId || !resolvedActivity) return null;

  const name = getActivityDisplayName(resolvedActivity, resolvedGroup);
  const eyebrow = resolvedGroup?.name
    ? `${resolvedGroup.name} · ${t("label")}`
    : t("label");

  return (
    <section aria-label={t("label")} className="min-w-0 flex-1">
      <div
        className="flex h-16 items-center gap-3 rounded-[1.25rem] pl-2 pr-2.5"
        style={{ backgroundColor: color, color: textColor, boxShadow }}
      >
        <Button
          type="button"
          variant="bare"
          onClick={onEdit}
          disabled={!onEdit}
          title={t("edit", { name })}
          aria-label={t("edit", { name })}
          className="h-12 min-w-0 flex-1 flex-col items-start justify-center gap-1 rounded-2xl px-3 text-left hover:bg-black/5 disabled:opacity-100"
          style={{ color: textColor }}
        >
          <span className="w-full truncate text-[0.6875rem] font-medium uppercase leading-none tracking-[0.12em] opacity-75">
            {eyebrow}
          </span>
          <span className="w-full truncate text-base font-semibold leading-tight">
            {name}
          </span>
        </Button>

        <span className="shrink-0 text-[1.375rem] font-semibold tabular-nums tracking-tight">
          {formatTimerDisplay(elapsedMs)}
        </span>

        <Button
          type="button"
          variant="bare"
          onClick={onStop}
          title={t("stopNamed", { name })}
          aria-label={t("stopNamed", { name })}
          className="h-11 w-11 shrink-0 rounded-full border p-0 hover:bg-black/5"
          style={{ color: textColor, borderColor: hexToRgba(textColor, 0.4) }}
        >
          <Square
            className="h-3.5 w-3.5"
            style={{ fill: textColor }}
            aria-hidden
          />
        </Button>
      </div>
    </section>
  );
}
