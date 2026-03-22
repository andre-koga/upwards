/**
 * SRP: Open-Meteo forecast/archive requests and WMO weather-code helpers for day-scoped weather.
 */

import { logError } from "@/lib/error-utils";

const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1/archive";
const GEOCODE_BASE = "https://geocoding-api.open-meteo.com/v1/search";

export interface DayWeatherSnapshot {
  /** Primary temperature (°F) — current for today, else daily high. */
  temperatureF: number;
  /** Daily low when from daily aggregates (not always set for “today” current). */
  temperatureMinF?: number;
  wmoCode: number;
}

/** Rough WMO → icon bucket for UI (Open-Meteo uses WMO Weather interpretation codes). */
export type WeatherVisualKind =
  | "clear"
  | "partlyCloudy"
  | "cloud"
  | "fog"
  | "rain"
  | "snow"
  | "storm";

export function wmoCodeToVisual(code: number): WeatherVisualKind {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partlyCloudy";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 86) return "rain";
  return "storm";
}

type ForecastJson = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    weathercode?: (number | null)[];
  };
};

type GeocodeJson = {
  results?: { latitude: number; longitude: number }[];
};

/**
 * Resolve a place name to coordinates (Open-Meteo geocoding).
 */
export async function geocodePlaceName(
  name: string,
  signal?: AbortSignal
): Promise<{ lat: number; lon: number } | null> {
  const q = name.trim();
  if (!q) return null;
  try {
    const url = `${GEOCODE_BASE}?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as GeocodeJson;
    const r = data.results?.[0];
    if (r == null) return null;
    return { lat: r.latitude, lon: r.longitude };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    logError("Open-Meteo geocoding failed", e);
    return null;
  }
}

function pickDailyIndex(times: string[] | undefined, dateStr: string): number {
  if (!times?.length) return -1;
  return times.indexOf(dateStr);
}

/**
 * Fetch weather for a calendar day (local `dateStr`) at coordinates.
 * Uses archive for past days, forecast for today and near future (≤16 days).
 */
export async function fetchDayWeatherOpenMeteo(
  args: {
    lat: number;
    lon: number;
    dateStr: string;
    todayStr: string;
  },
  signal?: AbortSignal
): Promise<DayWeatherSnapshot | null> {
  const { lat, lon, dateStr, todayStr } = args;
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    temperature_unit: "fahrenheit",
    timezone: "auto",
  });

  if (dateStr < todayStr) {
    params.set("start_date", dateStr);
    params.set("end_date", dateStr);
    params.set("daily", "temperature_2m_max,temperature_2m_min,weathercode");
    const url = `${ARCHIVE_BASE}?${params}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as ForecastJson;
    const max = data.daily?.temperature_2m_max?.[0];
    const min = data.daily?.temperature_2m_min?.[0];
    const code = data.daily?.weathercode?.[0];
    if (typeof max !== "number" || typeof code !== "number") return null;
    return {
      temperatureF: max,
      temperatureMinF: typeof min === "number" ? min : undefined,
      wmoCode: code,
    };
  }

  params.set("daily", "temperature_2m_max,temperature_2m_min,weathercode");
  params.set("current", "temperature_2m,weather_code");
  params.set("forecast_days", "16");
  const url = `${FORECAST_BASE}?${params}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as ForecastJson;

  if (dateStr === todayStr) {
    const t = data.current?.temperature_2m;
    const code = data.current?.weather_code;
    if (typeof t === "number" && typeof code === "number") {
      return { temperatureF: t, wmoCode: code };
    }
    const idx = pickDailyIndex(data.daily?.time, dateStr);
    if (idx >= 0) {
      const max = data.daily?.temperature_2m_max?.[idx];
      const min = data.daily?.temperature_2m_min?.[idx];
      const wc = data.daily?.weathercode?.[idx];
      if (typeof max === "number" && typeof wc === "number") {
        return {
          temperatureF: max,
          temperatureMinF: typeof min === "number" ? min : undefined,
          wmoCode: wc,
        };
      }
    }
    return null;
  }

  const idx = pickDailyIndex(data.daily?.time, dateStr);
  if (idx < 0) return null;
  const max = data.daily?.temperature_2m_max?.[idx];
  const min = data.daily?.temperature_2m_min?.[idx];
  const wc = data.daily?.weathercode?.[idx];
  if (typeof max !== "number" || typeof wc !== "number") return null;
  return {
    temperatureF: max,
    temperatureMinF: typeof min === "number" ? min : undefined,
    wmoCode: wc,
  };
}
