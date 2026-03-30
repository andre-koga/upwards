import { useEffect, useState } from "react";
import { toDateString } from "@/lib/time-utils";
import type { LocationData } from "@/lib/db/types";
import {
  fetchDayWeatherOpenMeteo,
  geocodePlaceName,
  type DayWeatherSnapshot,
} from "@/lib/journal";

export type JournalDayWeatherState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "ok"; data: DayWeatherSnapshot };

function coordsFromLocation(loc: LocationData | null): {
  lat: number;
  lon: number;
} | null {
  if (!loc) return null;
  const { lat, lon } = loc;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  return { lat, lon };
}

function geocodeQueryFromLocation(loc: LocationData | null): string | null {
  if (!loc) return null;
  const q = (loc.city?.trim() || loc.displayName?.trim()) ?? "";
  return q || null;
}

function canResolveWeatherLocation(loc: LocationData | null): boolean {
  if (!loc) return false;
  if (coordsFromLocation(loc)) return true;
  return Boolean(geocodeQueryFromLocation(loc));
}

export function useJournalDayWeather(
  currentDate: Date,
  location: LocationData | null
): JournalDayWeatherState {
  const [state, setState] = useState<JournalDayWeatherState>(() =>
    canResolveWeatherLocation(location)
      ? { status: "loading" }
      : { status: "unavailable" }
  );

  useEffect(() => {
    const dateStr = toDateString(currentDate);
    const todayStr = toDateString(new Date());
    const ac = new AbortController();

    async function run() {
      let latLon = coordsFromLocation(location);
      if (!latLon) {
        const q = geocodeQueryFromLocation(location);
        if (!q) {
          setState({ status: "unavailable" });
          return;
        }
        setState({ status: "loading" });
        try {
          latLon = await geocodePlaceName(q, ac.signal);
        } catch {
          return;
        }
        if (!latLon) {
          setState({ status: "unavailable" });
          return;
        }
      } else {
        setState({ status: "loading" });
      }

      try {
        const data = await fetchDayWeatherOpenMeteo(
          { lat: latLon.lat, lon: latLon.lon, dateStr, todayStr },
          ac.signal
        );
        if (data == null) {
          setState({ status: "unavailable" });
          return;
        }
        setState({ status: "ok", data });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setState({ status: "error" });
      }
    }

    void run();
    return () => ac.abort();
  }, [currentDate, location]);

  return state;
}
