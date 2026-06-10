import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Flame, Clock, Timer, Hourglass, Award, CheckCheck, Ban, X } from "lucide-react";
import { db } from "@/lib/db";
import type { Activity, ActivityGroup, ActivityPeriod } from "@/lib/db/types";
import { getActivityDisplayName, isRoutineDueOnDate } from "@/lib/activity";
import { getEffectiveToday } from "@/lib/session/day-reset";
import { effectiveDateForMs } from "@/lib/activity/period-day-utils";
import { isNeverRoutine, isNeverTaskSlipRecorded, neverTaskTarget } from "@/lib/activity/never-task";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { toDateString, shiftDate, startOfDay } from "@/lib/time-utils";
import { cn } from "@/lib/utils";

import { FormDialog } from "@/components/forms/form-dialog";

type TimeSpan = "7d" | "30d" | "90d" | "1yr" | "all";
type DayStatus = "done" | "missed" | "slip" | "not_scheduled" | "break";

/** Raw per-activity data loaded once; period filtering done in render. */
interface ActivityStats {
  isNever: boolean;
  hasTimer: boolean;
  hasRoutine: boolean;
  currentStreak: number;
  bestStreak: number;
  createdAtStr: string;
  /** dateStr → total ms (timer) */
  timerByDate: Record<string, number>;
  /** individual sessions for avg/longest per period */
  sessions: { dateStr: string; durationMs: number }[];
  /** dateStr → status (completion), only for days from createdAt onward */
  completionByDate: Record<string, DayStatus>;
}

/** Stats derived for a specific time window (computed in render). */
interface PeriodStats {
  fromDateStr: string;
  // Timer
  periodMs: number;
  sessionCount: number;
  avgSessionMs: number;
  longestSessionMs: number;
  weekdayTimerMs: number[];
  timerHeatmap: { dateStr: string; ms: number }[];
  // Completion
  scheduledInPeriod: number;
  completedInPeriod: number;
  slipsInPeriod: number;
  weekdayCompletion: [number, number][];
  completionHeatmap: { dateStr: string; status: DayStatus }[];
}

function computePeriodStats(
  raw: ActivityStats,
  span: TimeSpan,
): PeriodStats {
  const todayStr = getEffectiveToday();
  const today = startOfDay(new Date(todayStr + "T00:00:00"));
  let fromDate: Date;
  if (span === "all") {
    fromDate = startOfDay(new Date(raw.createdAtStr + "T00:00:00"));
  } else {
    const d = ({ "7d": 7, "30d": 30, "90d": 90, "1yr": 365 } as Record<string, number>)[span];
    fromDate = shiftDate(today, -(d - 1));
  }
  const fromDateStr = toDateString(fromDate);

  // ── timer ──
  let periodMs = 0;
  let sessionCount = 0;
  let longestSessionMs = 0;
  const weekdayTimerMs = [0, 0, 0, 0, 0, 0, 0];
  for (const s of raw.sessions) {
    if (s.dateStr >= fromDateStr) {
      periodMs += s.durationMs;
      sessionCount++;
      if (s.durationMs > longestSessionMs) longestSessionMs = s.durationMs;
      weekdayTimerMs[new Date(s.dateStr + "T00:00:00").getDay()] += s.durationMs;
    }
  }

  const timerHeatmap: { dateStr: string; ms: number }[] = [];
  let cur = fromDate;
  while (cur <= today) {
    const d = toDateString(cur);
    timerHeatmap.push({ dateStr: d, ms: raw.timerByDate[d] ?? 0 });
    cur = shiftDate(cur, 1);
  }

  // ── completion ──
  let scheduledInPeriod = 0;
  let completedInPeriod = 0;
  let slipsInPeriod = 0;
  const weekdayCompletion: [number, number][] = Array.from({ length: 7 }, () => [0, 0]);
  const completionHeatmap: { dateStr: string; status: DayStatus }[] = [];

  cur = fromDate;
  while (cur <= today) {
    const d = toDateString(cur);
    const status: DayStatus =
      d >= raw.createdAtStr
        ? (raw.completionByDate[d] ?? "not_scheduled")
        : "not_scheduled";
    completionHeatmap.push({ dateStr: d, status });
    if (status !== "not_scheduled" && status !== "break") {
      const dow = cur.getDay();
      weekdayCompletion[dow][1]++;
      scheduledInPeriod++;
      if (status === "done") {
        completedInPeriod++;
        weekdayCompletion[dow][0]++;
      } else if (status === "slip") {
        slipsInPeriod++;
      }
    }
    cur = shiftDate(cur, 1);
  }

  return {
    fromDateStr,
    periodMs,
    sessionCount,
    avgSessionMs: sessionCount > 0 ? Math.round(periodMs / sessionCount) : 0,
    longestSessionMs,
    weekdayTimerMs,
    timerHeatmap,
    scheduledInPeriod,
    completedInPeriod,
    slipsInPeriod,
    weekdayCompletion,
    completionHeatmap,
  };
}

// ─── data loader ───────────────────────────────────────────────────────────

async function loadActivityStats(activityId: string): Promise<ActivityStats> {
  const nowMs = Date.now();
  const todayStr = getEffectiveToday();
  const today = startOfDay(new Date(todayStr + "T00:00:00"));

  const [activity, periods, openPeriods, streakRows, allDailyEntries] =
    await Promise.all([
      db.activities.get(activityId),
      db.activityPeriods
        .where("activity_id").equals(activityId)
        .filter((p) => !p.deleted_at && !!p.end_time)
        .toArray() as Promise<ActivityPeriod[]>,
      db.activityPeriods
        .where("activity_id").equals(activityId)
        .filter((p) => !p.deleted_at && !p.end_time)
        .toArray() as Promise<ActivityPeriod[]>,
      db.activityStreaks
        .where("activity_id").equals(activityId)
        .filter((r) => !r.deleted_at)
        .toArray(),
      db.dailyEntries.filter((e) => !e.deleted_at).toArray(),
    ]);

  const allPeriods = [...periods, ...openPeriods];
  const isNever = isNeverRoutine(activity);
  const hasRoutine = !!activity && activity.routine !== "anytime";
  const createdAt = activity?.created_at
    ? startOfDay(new Date(getEffectiveToday(new Date(activity.created_at)) + "T00:00:00"))
    : today;
  const createdAtStr = toDateString(createdAt);

  // ── streak ──────────────────────────────────────────────────────────────
  const sortedStreakRows = [...streakRows].sort((a, b) => b.date.localeCompare(a.date));
  const currentStreak = sortedStreakRows[0]?.streak ?? 0;
  const bestStreak = streakRows.reduce((best, r) => Math.max(best, r.streak), 0);

  // ── timer (raw per-session and per-day maps) ─────────────────────────────
  const timerByDate: Record<string, number> = {};
  const sessions: { dateStr: string; durationMs: number }[] = [];
  for (const p of allPeriods) {
    const startMs = new Date(p.start_time).getTime();
    const endMs = p.end_time ? new Date(p.end_time).getTime() : nowMs;
    const durationMs = Math.max(0, endMs - startMs);
    const dateStr = effectiveDateForMs(startMs);
    timerByDate[dateStr] = (timerByDate[dateStr] ?? 0) + durationMs;
    sessions.push({ dateStr, durationMs });
  }

  // ── completion (indexed by date) ─────────────────────────────────────────
  const completionByDate: Record<string, DayStatus> = {};
  if (activity && hasRoutine) {
    const entriesByDate: Record<string, number> = {};
    const breakDays = new Set<string>();
    for (const e of allDailyEntries) {
      if (e.is_break_day) breakDays.add(e.date);
      const counts = e.task_counts as Record<string, number> | null;
      if (counts && activityId in counts) entriesByDate[e.date] = counts[activityId] ?? 0;
    }

    let cursor = createdAt;
    while (cursor <= today) {
      const dateStr = toDateString(cursor);
      if (breakDays.has(dateStr)) {
        completionByDate[dateStr] = "break";
      } else {
        const due = isRoutineDueOnDate(activity, cursor);
        if (due) {
          const count = entriesByDate[dateStr] ?? 0;
          if (isNever) {
            completionByDate[dateStr] = isNeverTaskSlipRecorded(activity, count) ? "slip" : "done";
          } else {
            completionByDate[dateStr] = count >= (activity.completion_target ?? 1) ? "done" : "missed";
          }
        } else {
          completionByDate[dateStr] = "not_scheduled";
        }
      }
      cursor = shiftDate(cursor, 1);
    }
  }

  return {
    isNever,
    hasTimer: allPeriods.length > 0,
    hasRoutine,
    currentStreak,
    bestStreak,
    createdAtStr,
    timerByDate,
    sessions,
    completionByDate,
  };
}

function formatDuration(ms: number): string {
  if (ms === 0) return "0m";
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatDateRange(fromStr: string, toStr: string): string {
  const fmt = (dateStr: string, includeYear: boolean) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(includeYear ? { year: "numeric" } : {}),
    });
  };
  const fromYear = fromStr.slice(0, 4);
  const toYear = toStr.slice(0, 4);
  const sameYear = fromYear === toYear;
  return `${fmt(fromStr, !sameYear)} – ${fmt(toStr, true)}`;
}

function useFloatingTooltip() {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRefs = useRef<number[]>([]);

  const clearTimers = () => {
    timerRefs.current.forEach(window.clearTimeout);
    timerRefs.current = [];
  };

  const show = useCallback((x: number, y: number, text: string) => {
    clearTimers();
    setTooltip({ x, y, text });
    setVisible(false);
    // Fade in on next frame
    timerRefs.current.push(window.setTimeout(() => setVisible(true), 10));
    // Start fade out after 1.5s
    timerRefs.current.push(window.setTimeout(() => setVisible(false), 1500));
    // Remove after fade out completes
    timerRefs.current.push(window.setTimeout(() => setTooltip(null), 1700));
  }, []);

  useEffect(() => () => clearTimers(), []);

  return { tooltip, visible, show };
}

function FloatingTooltip({ tooltip, visible }: {
  tooltip: { x: number; y: number; text: string };
  visible: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-50 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs font-medium text-background transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: "translate(-50%, calc(-100% - 6px))",
      }}
    >
      {tooltip.text}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold leading-none">
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Compact activity heatmap. Renders as a column-per-week grid (or flat row for ≤7 days). */
function PeriodHeatmap({
  days,
  color,
  isNever,
}: {
  days: { dateStr: string; ms?: number; status?: DayStatus }[];
  color: string;
  isNever: boolean;
}) {
  const { tooltip, visible, show } = useFloatingTooltip();
  const containerRef = useRef<HTMLDivElement>(null);
  if (days.length === 0) return null;

  const maxMs = Math.max(...days.map((d) => d.ms ?? 0), 1);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>, day: typeof days[0]) => {
    const cRect = containerRef.current?.getBoundingClientRect();
    const eRect = e.currentTarget.getBoundingClientRect();
    const ms = day.ms ?? 0;
    const text = ms > 0 ? formatDuration(ms)
      : day.status === "break" ? "Break day"
      : day.status === "done" ? (isNever ? "✓ Clean" : "✓ Done")
      : day.status === "slip" ? "✗ Slip"
      : day.status === "missed" ? "✗ Missed"
      : "—";
    show(eRect.left - (cRect?.left ?? 0) + eRect.width / 2, eRect.top - (cRect?.top ?? 0), text);
  };

  function cellStyle(day: typeof days[0]): { bg: string; opacity: number; customColor?: string; showX?: boolean; hollow?: boolean } {
    const ms = day.ms ?? 0;
    const status = day.status;
    const hasFailed = status === "missed" || status === "slip";
    const isNotScheduled = status === "not_scheduled";

    if (status === "break") return { bg: "bg-transparent", opacity: 1, hollow: true };
    if (isNotScheduled && ms === 0) return { bg: "bg-muted", opacity: 0.25 };

    if (ms > 0) {
      // Has timer sessions — use color + opacity, overlay X if failed
      return {
        bg: "bg-foreground",
        opacity: Math.max(0.35, ms / maxMs),
        customColor: color,
        showX: hasFailed,
      };
    }

    // No timer session
    if (status === "done") return { bg: "bg-foreground", opacity: 1, customColor: color };
    if (hasFailed) return { bg: "bg-muted", opacity: 0.5, showX: true };
    // No session, no status (pure timer activity with no data that day)
    return { bg: "bg-muted", opacity: 0.4 };
  }

  // Flat row for short spans
  if (days.length <= 7) {
    return (
      <div ref={containerRef} className="relative flex w-full gap-[3px]">
        {days.map((day) => {
          const { bg, opacity, customColor, showX, hollow } = cellStyle(day);
          return (
            <div
              key={day.dateStr}
              className={`aspect-square flex-1 cursor-pointer rounded-[2px] ${bg} flex items-center justify-center ${hollow ? "border border-border" : ""}`}
              style={{ backgroundColor: customColor, opacity }}
              onClick={(e) => handleClick(e, day)}
            >
              {showX && <X className="h-4 w-4 text-foreground" strokeWidth={3} />}
            </div>
          );
        })}
        {tooltip && <FloatingTooltip tooltip={tooltip} visible={visible} />}
      </div>
    );
  }

  const firstDow = new Date(days[0].dateStr + "T00:00:00").getDay();
  const padded = [...Array<null>(firstDow).fill(null), ...days];
  const weeks: (typeof days[0] | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  return (
    <div ref={containerRef} className="relative">
      <div className="flex w-full gap-[3px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-1 flex-col gap-[3px]">
            {week.map((day, di) => {
              if (!day) return <div key={di} className="aspect-square w-full" />;
              const { bg, opacity, customColor, showX, hollow } = cellStyle(day);
              return (
                <div
                  key={di}
                  className={`aspect-square w-full cursor-pointer rounded-[2px] ${bg} flex items-center justify-center ${hollow ? "border border-border" : ""}`}
                  style={{ backgroundColor: customColor, opacity }}
                  onClick={(e) => handleClick(e, day)}
                >
                  {showX && <X className="h-3.5 w-3.5 text-foreground" strokeWidth={3} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {tooltip && <FloatingTooltip tooltip={tooltip} visible={visible} />}
    </div>
  );
}

const MAX_BAR_HEIGHT_PX = 48;

/** Bar chart for weekday distribution — handles both timer-ms and completion-ratio modes. */
function WeekdayChart({
  weekdayTimerMs,
  weekdayCompletion,
  color,
  isNever,
}: {
  weekdayTimerMs?: number[];
  weekdayCompletion?: [number, number][];
  color: string;
  isNever: boolean;
}) {
  const { tooltip, visible, show } = useFloatingTooltip();
  const containerRef = useRef<HTMLDivElement>(null);
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  const handleClick = (e: React.MouseEvent<HTMLDivElement>, text: string) => {
    const cRect = containerRef.current?.getBoundingClientRect();
    const eRect = e.currentTarget.getBoundingClientRect();
    show(eRect.left - (cRect?.left ?? 0) + eRect.width / 2, eRect.top - (cRect?.top ?? 0), text);
  };

  const maxMs = weekdayTimerMs ? Math.max(...weekdayTimerMs, 1) : 1;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex w-full items-end gap-1.5" style={{ height: MAX_BAR_HEIGHT_PX + 20 }}>
        {Array.from({ length: 7 }).map((_, i) => {
          let barHeight: number;
          let bgClass: string;
          let customColor: string | undefined;
          let tooltipText: string;

          if (weekdayTimerMs) {
            const ms = weekdayTimerMs[i];
            barHeight = ms > 0 ? Math.max(4, Math.round((ms / maxMs) * MAX_BAR_HEIGHT_PX)) : 3;
            bgClass = ms > 0 ? "bg-foreground" : "bg-muted";
            customColor = ms > 0 ? color : undefined;
            tooltipText = formatDuration(ms);
          } else {
            const [done, scheduled] = weekdayCompletion![i];
            const ratio = scheduled > 0 ? done / scheduled : 0;
            barHeight = scheduled > 0 ? Math.max(4, Math.round(ratio * MAX_BAR_HEIGHT_PX)) : 3;
            bgClass = scheduled === 0 ? "bg-muted" : "bg-foreground";
            customColor = scheduled > 0 ? color : undefined;
            const pct = scheduled > 0 ? Math.round(ratio * 100) : 0;
            tooltipText = isNever
              ? `${done} clean day${done !== 1 ? "s" : ""} / ${scheduled}`
              : `${done}/${scheduled} (${pct}%)`;
          }

          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full cursor-pointer rounded-sm ${bgClass}`}
                style={{ height: barHeight, backgroundColor: customColor }}
                onClick={(e) => handleClick(e, tooltipText)}
              />
              <span className="text-[10px] text-muted-foreground">{dayLabels[i]}</span>
            </div>
          );
        })}
      </div>
      {tooltip && <FloatingTooltip tooltip={tooltip} visible={visible} />}
    </div>
  );
}

const SPANS: TimeSpan[] = ["7d", "30d", "90d", "1yr", "all"];
const SPAN_LABEL: Record<TimeSpan, string> = { "7d": "7d", "30d": "30d", "90d": "90d", "1yr": "1yr", "all": "All" };

interface ActivityStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity | null;
  group: ActivityGroup | null | undefined;
}

export function ActivityStatsDialog({
  open,
  onOpenChange,
  activity,
  group,
}: ActivityStatsDialogProps) {
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [span, setSpan] = useState<TimeSpan>("7d");

  const color = group?.color || DEFAULT_GROUP_COLOR;
  const displayName = getActivityDisplayName(activity, group);

  useEffect(() => {
    if (!open || !activity) { setStats(null); return; }
    setLoading(true);
    loadActivityStats(activity.id)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, activity]);

  const period = stats ? computePeriodStats(stats, span) : null;
  const isCompletion = !!stats?.hasRoutine;

  // Heatmap is always fixed at 90 days regardless of selected span
  const heatmap90 = useMemo(() => {
    if (!stats) return null;
    const todayStr = getEffectiveToday();
    const today = startOfDay(new Date(todayStr + "T00:00:00"));
    const ninetyDaysAgo = shiftDate(today, -89);
    const days: { dateStr: string; ms?: number; status?: DayStatus }[] = [];
    let cur = ninetyDaysAgo;
    while (cur <= today) {
      const d = toDateString(cur);
      const ms = stats.timerByDate[d];
      const status = d >= stats.createdAtStr
        ? (stats.completionByDate[d] ?? (stats.hasRoutine ? "not_scheduled" : undefined))
        : (stats.hasRoutine ? "not_scheduled" : undefined);
      days.push({ dateStr: d, ms, status });
      cur = shiftDate(cur, 1);
    }
    return days;
  }, [stats]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          {displayName}
        </span>
      }
      contentClassName="sm:max-w-sm"
    >
      {loading && (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading stats…</p>
      )}

      {!loading && stats && period && (
        <div className="flex flex-col gap-2">

          {/* ── heatmap ─────────────────────────────────────────────── */}
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Last 90 days
            </p>
            {heatmap90 && (
              <PeriodHeatmap
                days={heatmap90}
                color={color}
                isNever={stats.isNever}
              />
            )}
          </div>

          {/* ── by day of week ──────────────────────────────────────── */}
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              By day of week
            </p>
            <WeekdayChart
              weekdayTimerMs={isCompletion ? undefined : period.weekdayTimerMs}
              weekdayCompletion={isCompletion ? period.weekdayCompletion : undefined}
              color={color}
              isNever={stats.isNever}
            />
          </div>

          {/* ── stat cards ──────────────────────────────────────────── */}
          {/* Streak — full width, always all-time */}
          <div className="flex items-center rounded-xl border bg-muted/30 p-3">
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Flame className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] font-medium uppercase tracking-wide">
                  {stats.isNever ? "Clean streak" : "Streak"}
                </span>
              </div>
              <p className="text-xl font-bold leading-none">{stats.currentStreak}d</p>
              <p className="text-[11px] text-muted-foreground">Current</p>
            </div>
            <div className="mx-3 w-px self-stretch bg-border" />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Award className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Best</span>
              </div>
              <p className="text-xl font-bold leading-none">{stats.bestStreak}d</p>
              <p className="text-[11px] text-muted-foreground">All time</p>
            </div>
          </div>

          {/* Period-scoped cards */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <p className="text-[11px] text-muted-foreground">
              {formatDateRange(period.fromDateStr, getEffectiveToday())}
            </p>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Completion or timer session count */}
            {isCompletion ? (
              stats.isNever ? (
                <StatCard
                  icon={Ban}
                  label="Slips"
                  value={String(period.slipsInPeriod)}
                  sub={`${period.scheduledInPeriod} days tracked`}
                />
              ) : (
                <StatCard
                  icon={CheckCheck}
                  label="Success rate"
                  value={
                    period.scheduledInPeriod > 0
                      ? `${Math.round((period.completedInPeriod / period.scheduledInPeriod) * 100)}%`
                      : "—"
                  }
                  sub={
                    period.scheduledInPeriod > 0
                      ? `${period.completedInPeriod} of ${period.scheduledInPeriod} days`
                      : "No scheduled days"
                  }
                />
              )
            ) : (
              <StatCard
                icon={Clock}
                label="Total time"
                value={period.sessionCount > 0 ? formatDuration(period.periodMs) : "—"}
                sub={period.sessionCount > 0 ? `${period.sessionCount} session${period.sessionCount !== 1 ? "s" : ""}` : "No sessions"}
              />
            )}

            {/* Time for routined + timer combos */}
            {isCompletion && stats.hasTimer && (
              <StatCard
                icon={Clock}
                label="Total time"
                value={period.sessionCount > 0 ? formatDuration(period.periodMs) : "—"}
                sub={period.sessionCount > 0 ? `${period.sessionCount} session${period.sessionCount !== 1 ? "s" : ""}` : "No sessions"}
              />
            )}

            {/* Avg session */}
            <StatCard
              icon={Timer}
              label="Avg session"
              value={period.sessionCount > 0 ? formatDuration(period.avgSessionMs) : "—"}
              sub={period.sessionCount === 0 ? "No sessions" : undefined}
            />

            {/* Longest session */}
            <StatCard
              icon={Hourglass}
              label="Longest"
              value={period.sessionCount > 0 ? formatDuration(period.longestSessionMs) : "—"}
              sub={period.sessionCount === 0 ? "No sessions" : undefined}
            />
          </div>

          {/* ── time span selector ──────────────────────────────────── */}
          <div className="flex gap-1 rounded-xl border bg-muted/30 p-1">
            {SPANS.map((s) => (
              <button
                key={s}
                onClick={() => setSpan(s)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors",
                  span === s
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {SPAN_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}
    </FormDialog>
  );
}
