import type { Activity, ActivityGroup } from "@/lib/db/types";

export type DayStatus = "done" | "missed" | "slip" | "not_scheduled" | "break";

export type MonthlyCompletionPoint = {
  monthKey: string;
  label: string;
  rate: number | null;
  completed: number;
  scheduled: number;
};

export type MonthlyCompletionSeries = {
  id: string;
  label: string;
  color: string;
  points: MonthlyCompletionPoint[];
};

export interface ActivityStats {
  activityId: string;
  isNever: boolean;
  hasTimer: boolean;
  hasRoutine: boolean;
  currentStreak: number;
  bestStreak: number;
  createdAtStr: string;
  timerByDate: Record<string, number>;
  completionByDate: Record<string, DayStatus>;
  breakDateStrs: Set<string>;
  compoundScore: number | null;
}

export type HeatmapDay = {
  dateStr: string;
  ms?: number;
  status?: DayStatus;
  isBeforeCreation: boolean;
  isBreakDay?: boolean;
  /** 0–100 portfolio/group completion rate for aggregate heatmaps */
  completionRate?: number;
  habitsCompleted?: number;
  habitsScheduled?: number;
};

export interface GroupNavSummary {
  group: ActivityGroup;
  habitCount: number;
  completionRate30d: number | null;
  sparklineRates: number[];
}

export interface OverallStats {
  weekCompletionRate: number | null;
  weekWins: number;
  weekScheduled: number;
  weekTrackedMs: number;
  loginStreak: number;
  journalStreak: number | null;
  bestCurrentHabitStreak: number;
  consistencyHeatmap90: HeatmapDay[];
  monthlyCompletion: MonthlyCompletionPoint[];
  monthlyCompletionByGroup: MonthlyCompletionSeries[];
  timeByGroup30d: { groupId: string; groupName: string; color: string; ms: number }[];
  timeOfDayBuckets: number[];
  groups: GroupNavSummary[];
}

export type ActivitySparklineDay = {
  rate: number;
  ms: number;
};

export interface HabitComparisonRow {
  activity: Activity;
  completionRate90d: number | null;
  completed: number;
  scheduled: number;
  completionRate30d: number | null;
  completed30d: number;
  scheduled30d: number;
  sparklineDays: ActivitySparklineDay[];
  sparklineWeeks: HeatmapDay[];
}

export interface GroupStats {
  group: ActivityGroup;
  completionRate30d: number | null;
  completionRateAllTime: number | null;
  totalTrackedMs: number;
  activeHabitCount: number;
  groupCompoundScore: number | null;
  consistencyHeatmap90: HeatmapDay[];
  habitComparison: HabitComparisonRow[];
  monthlyCompletion: MonthlyCompletionPoint[];
  timerByHabit30d: { activityId: string; name: string; ms: number }[];
  timeOfDayBuckets: number[];
  completedHabits: HabitComparisonRow[];
}

export interface ActivityRecords {
  longestStreak: number;
  bestMonthRate: number | null;
  bestMonthLabel: string | null;
  busiestDayMs: number;
  busiestDayStr: string | null;
  totalTrackedMs: number;
}

export interface SessionLogEntry {
  id: string;
  dateStr: string;
  startTime: string;
  durationMs: number;
}

export interface ActivityExtendedStats extends ActivityStats {
  records: ActivityRecords;
  sessions: SessionLogEntry[];
  timeOfDayBuckets: number[];
  groupCompletionRate90d: number | null;
  activityCompletionRate90d: number | null;
}
