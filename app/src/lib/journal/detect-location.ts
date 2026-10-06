import type { LocationData } from "@/lib/db/types";
import { isAutoLocationOn } from "@/lib/account-settings";

interface ReverseGeocodeAddress {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
  country_code?: string;
}

/** Turn a Nominatim reverse-geocode address into a stored place, or null. */
export function locationFromAddress(
  address: ReverseGeocodeAddress,
  latitude: number,
  longitude: number
): LocationData | null {
  const city =
    address.city || address.town || address.village || address.county || null;
  const displayName = city || address.state || address.country || null;
  if (!displayName) return null;
  return {
    displayName,
    city,
    state: address.state ?? null,
    country: address.country ?? null,
    countryCode: address.country_code ?? null,
    lat: latitude,
    lon: longitude,
  };
}

function currentPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      () => resolve(null),
      { timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

/**
 * Where the device is now, as a journal place. Returns null without touching
 * the browser's geolocation or making any network request unless the user has
 * turned automatic location on, so this is safe to call from anywhere.
 */
export async function detectCurrentLocation(): Promise<LocationData | null> {
  if (!isAutoLocationOn()) return null;
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  const position = await currentPosition();
  if (!position) return null;

  const { latitude, longitude } = position.coords;
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
  );
  const data = (await res.json()) as { address?: ReverseGeocodeAddress };
  return locationFromAddress(data.address ?? {}, latitude, longitude);
}
