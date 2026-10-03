import type { DailyEntry, JournalEntry } from "@/lib/db/types";

interface Revisioned {
  updated_at: string;
  synced_at?: string | null;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Same stored content, ignoring this device's sync bookkeeping. */
export function rowsEquivalent(
  a: object,
  b: object,
  ignore: readonly string[] = []
): boolean {
  const skip = new Set(["synced_at", ...ignore]);
  const strip = (row: object) =>
    Object.fromEntries(Object.entries(row).filter(([key]) => !skip.has(key)));
  return stableStringify(strip(a)) === stableStringify(strip(b));
}

export type CurrentStateDecision =
  | "insert"
  | "update"
  | "unchanged"
  | "keep_local";

/**
 * Current-state rows (definitions, memos, memories, sessions): insert what is
 * missing, apply a backup row only when it is a newer revision, otherwise keep
 * what the account already has.
 */
export function decideCurrentStateRow<T extends Revisioned>(
  local: T | undefined,
  backup: T
): CurrentStateDecision {
  if (!local) return "insert";
  if (rowsEquivalent(local, backup)) return "unchanged";
  return backup.updated_at > local.updated_at ? "update" : "keep_local";
}

/** Append-only events union by id; an existing event is never rewritten. */
export function decideAppendOnlyRow<T>(
  local: T | undefined
): "insert" | "unchanged" {
  return local ? "unchanged" : "insert";
}

interface CountChange {
  activityId: string;
  previousCount: number;
  nextCount: number;
  completionAt?: string;
}

export interface DailyEntryMergePlan {
  counts: CountChange[];
  pauseActivityIds: string[];
  enableBreakDay: boolean;
  notes: Array<{ activityId: string; note: string }>;
}

/**
 * Counts merge to max(current, backup): the import adds only the missing
 * difference and never lowers a count the account has since raised. Pauses,
 * break days, completion times, and notes are only filled in where missing.
 */
export function planDailyEntryMerge(
  local: DailyEntry | undefined,
  backup: DailyEntry
): DailyEntryMergePlan {
  const plan: DailyEntryMergePlan = {
    counts: [],
    pauseActivityIds: [],
    enableBreakDay: false,
    notes: [],
  };
  if (backup.deleted_at) return plan;

  const localCounts = local?.task_counts ?? {};
  const localTimes = local?.completion_times ?? {};
  const backupTimes = backup.completion_times ?? {};
  for (const [activityId, backupCount] of Object.entries(
    backup.task_counts ?? {}
  )) {
    if (!(backupCount > 0)) continue;
    const localCount = localCounts[activityId] ?? 0;
    const missingTime =
      !localTimes[activityId] && backupTimes[activityId]
        ? backupTimes[activityId]
        : undefined;
    if (backupCount > localCount || missingTime) {
      plan.counts.push({
        activityId,
        previousCount: localCount,
        nextCount: Math.max(localCount, backupCount),
        ...(missingTime ? { completionAt: missingTime } : {}),
      });
    }
  }

  const localPaused = new Set(local?.paused_task_ids ?? []);
  plan.pauseActivityIds = (backup.paused_task_ids ?? []).filter(
    (id) => !localPaused.has(id)
  );
  plan.enableBreakDay = backup.is_break_day === true && !local?.is_break_day;

  const localNotes = local?.completion_notes ?? {};
  for (const [activityId, note] of Object.entries(
    backup.completion_notes ?? {}
  )) {
    if (note?.trim() && !localNotes[activityId]?.trim()) {
      plan.notes.push({ activityId, note });
    }
  }
  return plan;
}

export function isEmptyDailyPlan(plan: DailyEntryMergePlan): boolean {
  return (
    plan.counts.length === 0 &&
    plan.pauseActivityIds.length === 0 &&
    !plan.enableBreakDay &&
    plan.notes.length === 0
  );
}

export type JournalMergeDecision =
  | { kind: "insert" }
  | { kind: "unchanged" }
  | { kind: "keep_local" }
  | { kind: "update"; row: JournalEntry }
  | { kind: "conflict" };

function journalText(row: JournalEntry): string {
  return row.text_content?.trim() ?? "";
}

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === "string" && !value.trim());
}

/**
 * A date that already has different text is a conflict for the user to
 * review. Otherwise the newer revision wins, gaps are filled from the other
 * side, and photos union.
 */
export function planJournalMerge(
  local: JournalEntry | undefined,
  backup: JournalEntry,
  timestamp: string
): JournalMergeDecision {
  if (!local) return { kind: "insert" };
  if (rowsEquivalent(local, backup, ["id"])) return { kind: "unchanged" };

  if (local.deleted_at || backup.deleted_at) {
    const decision = decideCurrentStateRow(local, backup);
    if (decision === "update") {
      return { kind: "update", row: { ...backup, id: local.id } };
    }
    return { kind: decision === "unchanged" ? "unchanged" : "keep_local" };
  }

  const localText = journalText(local);
  const backupText = journalText(backup);
  if (localText && backupText && localText !== backupText) {
    return { kind: "conflict" };
  }

  const backupNewer = backup.updated_at > local.updated_at;
  const base = backupNewer ? backup : local;
  const other = backupNewer ? local : backup;
  const merged: JournalEntry = { ...base, id: local.id };
  for (const field of ["title", "text_content", "day_emoji"] as const) {
    if (isBlank(merged[field]) && !isBlank(other[field])) {
      merged[field] = other[field];
    }
  }
  if (isBlank(merged.video_path) && !isBlank(other.video_path)) {
    merged.video_path = other.video_path;
    merged.video_thumbnail = other.video_thumbnail;
  }
  if (
    !merged.location?.locations?.length &&
    other.location?.locations?.length
  ) {
    merged.location = other.location;
  }
  const photos = [...(base.photo_paths ?? [])];
  for (const path of other.photo_paths ?? []) {
    if (!photos.includes(path)) photos.push(path);
  }
  merged.photo_paths = photos.length > 0 ? photos : base.photo_paths;

  if (rowsEquivalent(local, merged, ["updated_at"])) {
    return { kind: "unchanged" };
  }
  return { kind: "update", row: { ...merged, updated_at: timestamp } };
}
