import { useCallback, useEffect, useRef, useState } from "react";
import { logError } from "@/lib/error-utils";
import type { LocationData } from "@/lib/db/types";

interface UseLocationDetectionParams {
  isToday: boolean;
  isJournalLoaded: boolean;
  /** In-memory draft; may lag one effect after load. */
  currentLocation: LocationData | null;
  /** Location already saved for this day; use so we do not start GPS before draft sync runs. */
  persistedLocation: LocationData | null;
  onLocationDetected: (location: LocationData) => void;
}

export function useLocationDetection({
  isToday,
  isJournalLoaded,
  currentLocation,
  persistedLocation,
  onLocationDetected,
}: UseLocationDetectionParams) {
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const hasTriedGeoRef = useRef(false);

  useEffect(() => {
    if (!isToday) {
      setIsDetectingLocation(false);
    }
  }, [isToday]);

  const detectLocation = useCallback(
    (force = false) => {
      if (!isToday) return;
      if (!navigator.geolocation) return;
      if (isDetectingLocation) return;
      if (!force) {
        if (!isJournalLoaded) return;
        if (currentLocation || persistedLocation) return;
        if (hasTriedGeoRef.current) return;
      }

      hasTriedGeoRef.current = true;
      setIsDetectingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );
            const data = (await res.json()) as {
              address: {
                city?: string;
                town?: string;
                village?: string;
                county?: string;
                state?: string;
                country?: string;
                country_code?: string;
              };
            };
            const city =
              data.address.city ||
              data.address.town ||
              data.address.village ||
              data.address.county ||
              null;
            if (city) {
              const locationData: LocationData = {
                displayName: city,
                city,
                state: data.address.state ?? null,
                country: data.address.country ?? null,
                countryCode: data.address.country_code ?? null,
                lat: latitude,
                lon: longitude,
              };
              onLocationDetected(locationData);
            }
          } catch (e) {
            logError("Reverse geocoding failed", e);
          } finally {
            setIsDetectingLocation(false);
          }
        },
        () => {
          setIsDetectingLocation(false);
        },
        { timeout: 10000, maximumAge: 5 * 60 * 1000 }
      );
    },
    [
      isToday,
      isJournalLoaded,
      currentLocation,
      persistedLocation,
      isDetectingLocation,
      onLocationDetected,
    ]
  );

  const resetGeoAttempt = useCallback(() => {
    hasTriedGeoRef.current = false;
  }, []);

  return { detectLocation, isDetectingLocation, resetGeoAttempt };
}
