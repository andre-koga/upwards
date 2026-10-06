import { useCallback, useEffect, useRef, useState } from "react";
import { logError } from "@/lib/error-utils";
import type { LocationData } from "@/lib/db/types";
import { detectCurrentLocation } from "@/lib/journal/detect-location";
import { useAccountSettings } from "@/lib/use-account-settings";

const VISIBILITY_DETECT_MIN_INTERVAL_MS = 5 * 60 * 1000;

interface UseLocationDetectionParams {
  /** True only for the effective current day — never backfill GPS onto past days. */
  isToday: boolean;
  isJournalLoaded: boolean;
  /** Places already on this day (draft if present, else persisted). */
  knownLocations: LocationData[];
  onLocationDetected: (location: LocationData) => void;
}

export function useLocationDetection({
  isToday,
  isJournalLoaded,
  knownLocations,
  onLocationDetected,
}: UseLocationDetectionParams) {
  const autoLocation = useAccountSettings().autoLocation === true;
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const hasTriedInitialGeoRef = useRef(false);
  const lastVisibilityDetectRef = useRef(0);

  const runGeolocation = useCallback(
    (onComplete: () => void) => {
      detectCurrentLocation()
        .then((location) => {
          if (location) onLocationDetected(location);
        })
        .catch((e) => logError("Reverse geocoding failed", e))
        .finally(onComplete);
    },
    [onLocationDetected]
  );

  const detectLocation = useCallback(
    (opts?: { fromVisibility?: boolean }) => {
      if (!autoLocation) return;
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
      autoLocation,
      isToday,
      isJournalLoaded,
      knownLocations.length,
      isDetectingLocation,
      runGeolocation,
    ]
  );

  useEffect(() => {
    if (!isToday || !autoLocation) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      detectLocation({ fromVisibility: true });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isToday, autoLocation, detectLocation]);

  return { detectLocation, isDetectingLocation };
}
