import { useCallback, useEffect, useRef, useState } from "react";
import { logError } from "@/lib/error-utils";
import type { LocationData } from "@/lib/db/types";

const VISIBILITY_DETECT_MIN_INTERVAL_MS = 5 * 60 * 1000;

interface UseLocationDetectionParams {
  isToday: boolean;
  isJournalLoaded: boolean;
  /** Effective stops for today (draft if synced, else persisted). */
  knownLocations: LocationData[];
  onLocationDetected: (location: LocationData) => void;
}

export function useLocationDetection({
  isToday,
  isJournalLoaded,
  knownLocations,
  onLocationDetected,
}: UseLocationDetectionParams) {
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const hasTriedInitialGeoRef = useRef(false);
  const lastVisibilityDetectRef = useRef(0);

  useEffect(() => {
    if (!isToday) {
      setIsDetectingLocation(false);
    }
  }, [isToday]);

  const runGeolocation = useCallback(
    (onComplete: () => void) => {
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
            const displayName =
              city ||
              data.address.state ||
              data.address.country ||
              null;
            if (displayName) {
              const locationData: LocationData = {
                displayName,
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
            onComplete();
          }
        },
        () => {
          onComplete();
        },
        { timeout: 10000, maximumAge: 5 * 60 * 1000 }
      );
    },
    [onLocationDetected]
  );

  const detectLocation = useCallback(
    (opts?: { fromVisibility?: boolean }) => {
      if (!isToday) return;
      if (!navigator.geolocation) return;
      if (isDetectingLocation) return;

      const fromVisibility = opts?.fromVisibility ?? false;

      if (!fromVisibility) {
        if (!isJournalLoaded) return;
        if (knownLocations.length > 0) return;
        if (hasTriedInitialGeoRef.current) return;
        hasTriedInitialGeoRef.current = true;
      } else {
        const now = Date.now();
        if (
          now - lastVisibilityDetectRef.current <
          VISIBILITY_DETECT_MIN_INTERVAL_MS
        ) {
          return;
        }
        lastVisibilityDetectRef.current = now;
      }

      setIsDetectingLocation(true);
      runGeolocation(() => setIsDetectingLocation(false));
    },
    [
      isToday,
      isJournalLoaded,
      knownLocations.length,
      isDetectingLocation,
      runGeolocation,
    ]
  );

  useEffect(() => {
    if (!isToday) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      detectLocation({ fromVisibility: true });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isToday, detectLocation]);

  const resetGeoAttempt = useCallback(() => {
    hasTriedInitialGeoRef.current = false;
    lastVisibilityDetectRef.current = 0;
  }, []);

  return { detectLocation, isDetectingLocation, resetGeoAttempt };
}
