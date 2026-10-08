/** Row shapes older builds wrote; shared by Dexie upgrades and backup migrators. */
import type {
  Activity,
  ActivityGroup,
  ActivityPeriod,
  DailyEntry,
  JournalEntry,
  OneTimeTask,
} from "./types";

/**
 * Columns the A8b window dropped from the server (product-scope.md §2.10).
 * Local rows and backup files written before it can still carry them; nothing
 * reads them, and they are stripped on the way to the server.
 */
export const DROPPED_COLUMNS = {
  activities: ["completed_at", "is_archived"],
  activity_groups: ["emoji", "is_archived"],
  activity_periods: ["daily_entry_id"],
  daily_entries: ["current_activity_id"],
  journal_entries: [
    "is_journal_complete",
    "journal_completed_at",
    "journal_entry_number",
    "journal_completion_streak",
  ],
  one_time_tasks: ["group_id", "recurring_memo_id"],
} as const satisfies Record<string, readonly string[]>;

export function withoutDroppedColumns<T extends object>(
  table: string,
  row: T
): T {
  const dropped: readonly string[] | undefined =
    DROPPED_COLUMNS[table as keyof typeof DROPPED_COLUMNS];
  if (!dropped || !dropped.some((column) => column in row)) return row;
  const copy = { ...row } as Record<string, unknown>;
  for (const column of dropped) delete copy[column];
  return copy as T;
}

/** Rows as backup formats 4–5 stored them, with the columns A8b dropped. */
export type LegacyActivity = Activity & {
  is_archived?: boolean | null;
  completed_at?: string | null;
};
export type LegacyActivityGroup = ActivityGroup & {
  emoji?: string | null;
  is_archived?: boolean | null;
};
export type LegacyActivityPeriod = ActivityPeriod & {
  daily_entry_id?: string | null;
};
export type LegacyDailyEntry = DailyEntry & {
  current_activity_id?: string | null;
};
export type LegacyJournalEntry = JournalEntry & {
  is_journal_complete?: boolean | null;
  journal_completed_at?: string | null;
  journal_entry_number?: number | null;
  journal_completion_streak?: number | null;
};
export type LegacyOneTimeTask = OneTimeTask & {
  group_id?: string | null;
  recurring_memo_id?: string | null;
};

const JOURNAL_VIDEO_PREFIX = "/storage/v1/object/public/journal-videos/";

export function normalizeLegacyVideoPath(pathOrUrl: unknown): string | null {
  if (typeof pathOrUrl !== "string") return null;
  const value = pathOrUrl.trim();
  if (!value) return null;
  if (!value.includes("://")) return value;

  try {
    const parsed = new URL(value);
    if (!parsed.pathname.startsWith(JOURNAL_VIDEO_PREFIX)) {
      return null;
    }
    return decodeURIComponent(
      parsed.pathname.slice(JOURNAL_VIDEO_PREFIX.length)
    );
  } catch {
    return null;
  }
}

function toLegacyLocationObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    const displayName = raw.trim();
    return displayName ? { displayName } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const displayName =
    (typeof obj.displayName === "string" && obj.displayName.trim()) ||
    (typeof obj.name === "string" && obj.name.trim()) ||
    (typeof obj.label === "string" && obj.label.trim()) ||
    (typeof obj.city === "string" && obj.city.trim()) ||
    (typeof obj.state === "string" && obj.state.trim()) ||
    (typeof obj.country === "string" && obj.country.trim()) ||
    "";
  if (!displayName) return null;
  return {
    displayName,
    city: typeof obj.city === "string" ? obj.city : null,
    state: typeof obj.state === "string" ? obj.state : null,
    country: typeof obj.country === "string" ? obj.country : null,
    countryCode: typeof obj.countryCode === "string" ? obj.countryCode : null,
    lat: typeof obj.lat === "number" ? obj.lat : null,
    lon: typeof obj.lon === "number" ? obj.lon : null,
  };
}

export function normalizeLegacyLocationRoute(
  raw: unknown
): { locations: unknown[] } | null {
  if (!raw) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const route = raw as Record<string, unknown>;
    if (Array.isArray(route.locations)) {
      const normalized = route.locations
        .map(toLegacyLocationObject)
        .filter((loc): loc is Record<string, unknown> => Boolean(loc));
      return normalized.length > 0 ? { locations: normalized } : null;
    }
  }

  if (Array.isArray(raw)) {
    const normalized = raw
      .map(toLegacyLocationObject)
      .filter((loc): loc is Record<string, unknown> => Boolean(loc));
    return normalized.length > 0 ? { locations: normalized } : null;
  }

  const single = toLegacyLocationObject(raw);
  return single ? { locations: [single] } : null;
}
