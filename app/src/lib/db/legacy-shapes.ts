/** Row shapes older builds wrote; shared by Dexie upgrades and backup migrators. */
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
