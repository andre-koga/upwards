import type {
  JournalEntry,
  JournalLocationRoute,
  LocationData,
} from "@/lib/db/types";
import { isJournalEntryComplete } from "./streak";

/** Max great-circle distance (km) to treat two readings as the same place when city data is missing. */
const SAME_PLACE_DISTANCE_KM = 10;

/** Cap on distinct places stored for a single journal day. */
export const MAX_DAILY_LOCATIONS = 5;

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
 * Whether two readings refer to the same place.
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

/**
 * Drop empty names and duplicate places. Order is not meaningful — kept only
 * for stable display of existing entries.
 */
export function normalizeJournalLocationRoute(
  route: JournalLocationRoute
): JournalLocationRoute {
  const locations: LocationData[] = [];
  for (const loc of route.locations) {
    const displayName = loc.displayName.trim();
    if (!displayName) continue;
    const cleaned = { ...loc, displayName };
    if (locations.some((existing) => isSameJournalPlace(existing, cleaned))) {
      continue;
    }
    locations.push(cleaned);
  }
  return { locations };
}

/**
 * Add a place if it is not already in the day's set and the cap allows it.
 */
export function mergeJournalLocationRoute(
  existing: JournalLocationRoute,
  next: LocationData,
  options?: { maxLocations?: number }
): JournalLocationRoute {
  const max = options?.maxLocations ?? MAX_DAILY_LOCATIONS;
  const normalized = normalizeJournalLocationRoute(existing);
  const cleanedNext = {
    ...next,
    displayName: next.displayName.trim(),
  };
  if (!cleanedNext.displayName) return normalized;
  if (
    normalized.locations.some((loc) => isSameJournalPlace(loc, cleanedNext))
  ) {
    return normalized;
  }
  if (normalized.locations.length >= max) return normalized;
  return {
    locations: [...normalized.locations, cleanedNext],
  };
}

function rawToLocationData(raw: unknown): LocationData | null {
  if (typeof raw === "string") {
    const displayName = raw.trim();
    if (!displayName) return null;
    return {
      displayName,
      city: null,
      state: null,
      country: null,
      countryCode: null,
      lat: null,
      lon: null,
    };
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const fromDisplay =
    typeof o.displayName === "string" ? o.displayName.trim() : "";
  const fromName = typeof o.name === "string" ? o.name.trim() : "";
  const fromLabel = typeof o.label === "string" ? o.label.trim() : "";
  const fromCity = typeof o.city === "string" ? o.city.trim() : "";
  const fromState = typeof o.state === "string" ? o.state.trim() : "";
  const fromCountry = typeof o.country === "string" ? o.country.trim() : "";
  const displayName =
    fromDisplay ||
    fromName ||
    fromLabel ||
    fromCity ||
    fromState ||
    fromCountry ||
    null;
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

/**
 * Parse stored `journal_entries.location`.
 * Supports current `{ locations }` plus legacy single-object/string/array formats.
 */
export function parseJournalLocationRoute(raw: unknown): JournalLocationRoute {
  if (!raw) return { locations: [] };

  if (typeof raw === "string") {
    const parsed = rawToLocationData(raw);
    return { locations: parsed ? [parsed] : [] };
  }

  if (Array.isArray(raw)) {
    return normalizeJournalLocationRoute({
      locations: raw
        .map(rawToLocationData)
        .filter((loc): loc is LocationData => Boolean(loc)),
    });
  }

  if (typeof raw !== "object") return { locations: [] };

  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.locations)) {
    const locations = o.locations
      .map(rawToLocationData)
      .filter((loc): loc is LocationData => Boolean(loc));
    return normalizeJournalLocationRoute({
      locations,
    });
  }

  // Legacy object shape: treat the object itself as a single location payload.
  const legacySingle = rawToLocationData(o);
  return { locations: legacySingle ? [legacySingle] : [] };
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
  photo_paths: string[] | null;
}

export interface JournalCompletionMetadata {
  is_journal_complete: boolean;
  journal_completed_at: string | null;
}

/**
 * Completion flag for a saved entry. Only the flag and its first-completion
 * time are stored; the streak and entry number are no longer written (the
 * streak is derived on read, see `./streak`).
 */
export function getCompletionMetadata(
  fields: JournalFields,
  existing: JournalEntry | undefined,
  timestamp: string
): JournalCompletionMetadata {
  const complete = isJournalEntryComplete(fields);
  return {
    is_journal_complete: complete,
    journal_completed_at: complete
      ? (existing?.journal_completed_at ?? timestamp)
      : (existing?.journal_completed_at ?? null),
  };
}
