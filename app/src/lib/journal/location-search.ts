import type { LocationData } from "@/lib/db/types";

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
}

interface NominatimPlace {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  address?: NominatimAddress;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function toLocationData(place: NominatimPlace): LocationData | null {
  const address = place.address ?? {};
  const city = firstNonEmpty(
    address.city,
    address.town,
    address.village,
    address.county
  );
  const displayName = firstNonEmpty(
    city,
    place.name,
    address.state,
    address.country,
    place.display_name?.split(",")[0]
  );
  const lat = Number(place.lat);
  const lon = Number(place.lon);

  if (!displayName || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return {
    displayName,
    city,
    state: address.state ?? null,
    country: address.country ?? null,
    countryCode: address.country_code ?? null,
    lat,
    lon,
  };
}

export async function searchLocations(query: string): Promise<LocationData[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    addressdetails: "1",
    limit: "6",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`
  );
  if (!response.ok) {
    throw new Error("Could not search locations.");
  }

  const places = (await response.json()) as NominatimPlace[];
  return places
    .map(toLocationData)
    .filter((place): place is LocationData => Boolean(place));
}

export async function reverseGeocodeLocation(
  lat: number,
  lon: number
): Promise<LocationData | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
    addressdetails: "1",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`
  );
  if (!response.ok) {
    throw new Error("Could not resolve map location.");
  }

  const place = (await response.json()) as NominatimPlace;
  return toLocationData({ ...place, lat: String(lat), lon: String(lon) });
}
