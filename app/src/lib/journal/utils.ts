import { db, now } from "@/lib/db";
import type {
  JournalEntry,
  JournalLocationRoute,
  LocationData,
} from "@/lib/db/types";
import { shiftDate, toDateString } from "@/lib/time-utils";

/** Max great-circle distance (km) to treat two readings as the same place when city data is missing. */
const SAME_PLACE_DISTANCE_KM = 50;

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Whether two readings are the same place (consecutive duplicates are dropped).
 */
export function isSameJournalPlace(a: LocationData, b: LocationData): boolean {
  const cityA = norm(a.city);
  const cityB = norm(b.city);
  const ccA = norm(a.countryCode);
  const ccB = norm(b.countryCode);
  const countryA = norm(a.country);
  const countryB = norm(b.country);

  if (cityA && cityB) {
    if (cityA !== cityB) return false;
    if (ccA && ccB) return ccA === ccB;
    if (countryA && countryB) return countryA === countryB;
    return true;
  }

  if (a.lat != null && a.lon != null && b.lat != null && b.lon != null) {
    return haversineKm(a.lat, a.lon, b.lat, b.lon) <= SAME_PLACE_DISTANCE_KM;
  }

  return (
    norm(a.displayName) === norm(b.displayName) && norm(a.displayName) !== ""
  );
}

export function normalizeJournalLocationRoute(
  route: JournalLocationRoute
): JournalLocationRoute {
  return {
    locations: route.locations.filter((loc) => loc.displayName.trim().length > 0),
  };
}

/**
 * Append a new reading only if it differs from the last stop (A -> B -> C).
 */
export function mergeJournalLocationRoute(
  existing: JournalLocationRoute,
  next: LocationData
): JournalLocationRoute {
  const normalized = normalizeJournalLocationRoute(existing);
  const last = normalized.locations[normalized.locations.length - 1];
  if (last && isSameJournalPlace(last, next)) return normalized;
  return normalizeJournalLocationRoute({
    locations: [...normalized.locations, next],
  });
}

function rawToLocationData(raw: unknown): LocationData | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const fromDisplay =
    typeof o.displayName === "string" ? o.displayName.trim() : "";
  const fromCity = typeof o.city === "string" ? o.city.trim() : "";
  const fromState = typeof o.state === "string" ? o.state.trim() : "";
  const fromCountry = typeof o.country === "string" ? o.country.trim() : "";
  const displayName =
    fromDisplay || fromCity || fromState || fromCountry || null;
  if (!displayName) return null;
  return {
    displayName,
    city: typeof o.city === "string" ? o.city : null,
    state: typeof o.state === "string" ? o.state : null,
    country: typeof o.country === "string" ? o.country : null,
    countryCode: typeof o.countryCode === "string" ? o.countryCode : null,
    lat: typeof o.lat === "number" ? o.lat : null,
    lon: typeof o.lon === "number" ? o.lon : null,
  };
}

/** Parse stored `journal_entries.location`; expected shape is `{ locations }`. */
export function parseJournalLocationRoute(raw: unknown): JournalLocationRoute {
  if (!raw || typeof raw !== "object") {
    return { locations: [] };
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.locations)) {
    return { locations: [] };
  }
  const locations = o.locations
    .map(rawToLocationData)
    .filter((loc): loc is LocationData => Boolean(loc));
  return normalizeJournalLocationRoute({
    locations,
  });
}

/** Serialize for IndexedDB / sync (omit empty). */
export function serializeJournalLocationRoute(
  route: JournalLocationRoute | null
): JournalLocationRoute | null {
  if (!route?.locations.length) return null;
  return normalizeJournalLocationRoute(route);
}

export interface JournalFields {
  title: string | null;
  text_content: string | null;
  day_emoji: string | null;
  is_bookmarked: boolean;
  video_path: string | null;
  location: JournalLocationRoute | null;
  video_thumbnail: string | null;
}

export interface JournalCompletionMetadata {
  is_journal_complete: boolean;
  journal_entry_number: number | null;
  journal_completion_streak: number | null;
  journal_completed_at: string | null;
}

function hasRequiredJournalFields(fields: JournalFields): boolean {
  return Boolean(
    fields.day_emoji?.trim() &&
    fields.title?.trim() &&
    fields.text_content?.trim() &&
    fields.video_path?.trim()
  );
}

/**
 * Compute completion metadata for a journal entry.
 */
export async function getCompletionMetadata(
  dateStr: string,
  fields: JournalFields,
  existing: JournalEntry | undefined,
  timestamp: string
): Promise<JournalCompletionMetadata> {
  const existingIsComplete = !!existing?.is_journal_complete;

  if (!hasRequiredJournalFields(fields)) {
    return {
      is_journal_complete: false,
      journal_entry_number: existing?.journal_entry_number ?? null,
      journal_completion_streak: existing?.journal_completion_streak ?? null,
      journal_completed_at: existing?.journal_completed_at ?? null,
    };
  }

  if (existingIsComplete) {
    return {
      is_journal_complete: true,
      journal_entry_number: existing?.journal_entry_number ?? null,
      journal_completion_streak: existing?.journal_completion_streak ?? null,
      journal_completed_at: existing?.journal_completed_at ?? null,
    };
  }

  const yesterday = toDateString(
    shiftDate(new Date(`${dateStr}T00:00:00`), -1)
  );
  const yesterdayEntry = await db.journalEntries
    .where("entry_date")
    .equals(yesterday)
    .filter((entry) => !entry.deleted_at)
    .first();

  const previousStreak = yesterdayEntry?.is_journal_complete
    ? (yesterdayEntry.journal_completion_streak ?? 0)
    : 0;

  const completedEntries = await db.journalEntries
    .filter(
      (entry) =>
        !entry.deleted_at &&
        !!entry.is_journal_complete &&
        typeof entry.journal_entry_number === "number"
    )
    .toArray();

  const maxEntryNumber = completedEntries.reduce(
    (max, entry) => Math.max(max, entry.journal_entry_number ?? 0),
    0
  );

  return {
    is_journal_complete: true,
    journal_entry_number: maxEntryNumber + 1,
    journal_completion_streak: previousStreak + 1,
    journal_completed_at: timestamp,
  };
}

/**
 * Recompute `journal_completion_streak` for this date and each following calendar day
 * that has a complete journal entry. Call after saving a day so that completing or
 * editing an earlier day updates streaks that were computed when the prior day was
 * still incomplete (e.g. today completed before yesterday).
 */
export async function propagateJournalCompletionStreaksAfterSave(
  savedDateStr: string
): Promise<void> {
  const timestamp = now();
  let cursor = toDateString(shiftDate(new Date(`${savedDateStr}T00:00:00`), 1));

  while (true) {
    const entry = await db.journalEntries
      .where("entry_date")
      .equals(cursor)
      .filter((e) => !e.deleted_at)
      .first();

    if (!entry?.is_journal_complete) break;

    const yesterday = toDateString(
      shiftDate(new Date(`${cursor}T00:00:00`), -1)
    );
    const yesterdayEntry = await db.journalEntries
      .where("entry_date")
      .equals(yesterday)
      .filter((e) => !e.deleted_at)
      .first();

    const previousStreak = yesterdayEntry?.is_journal_complete
      ? (yesterdayEntry.journal_completion_streak ?? 0)
      : 0;
    const newStreak = previousStreak + 1;

    if (entry.journal_completion_streak !== newStreak) {
      await db.journalEntries.update(entry.id, {
        journal_completion_streak: newStreak,
        updated_at: timestamp,
      });
    }

    cursor = toDateString(shiftDate(new Date(`${cursor}T00:00:00`), 1));
  }
}
