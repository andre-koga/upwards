import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
});
vi.mock("@/lib/supabase", () => ({
  getCachedUserId: () => null,
  supabase: null,
}));
vi.mock("@/lib/db", () => ({ now: () => "2026-10-06T12:00:00.000Z" }));

import {
  clearAccountSettings,
  updateAccountSettings,
} from "@/lib/account-settings";
import { detectCurrentLocation, locationFromAddress } from "./detect-location";

const getCurrentPosition = vi.fn();
const fetchSpy = vi.fn();

beforeEach(() => {
  storage.clear();
  clearAccountSettings();
  getCurrentPosition.mockReset();
  fetchSpy.mockReset();
  vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  });
});

describe("automatic location is opt-in", () => {
  it("makes no geolocation or geocoding call when never chosen", async () => {
    expect(await detectCurrentLocation()).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("makes no geolocation or geocoding call when turned off", async () => {
    updateAccountSettings({ autoLocation: false });
    expect(await detectCurrentLocation()).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("locates and reverse-geocodes once it is on", async () => {
    updateAccountSettings({ autoLocation: true });
    getCurrentPosition.mockImplementation((ok) =>
      ok({ coords: { latitude: -23.55, longitude: -46.63 } })
    );
    fetchSpy.mockResolvedValue({
      json: async () => ({
        address: {
          city: "São Paulo",
          state: "São Paulo",
          country: "Brasil",
          country_code: "br",
        },
      }),
    });

    expect(await detectCurrentLocation()).toMatchObject({
      displayName: "São Paulo",
      countryCode: "br",
      lat: -23.55,
      lon: -46.63,
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("stops before the network when the position is refused", async () => {
    updateAccountSettings({ autoLocation: true });
    getCurrentPosition.mockImplementation((_ok, fail) => fail({ code: 1 }));
    expect(await detectCurrentLocation()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stops without throwing when the browser has no geolocation", async () => {
    updateAccountSettings({ autoLocation: true });
    vi.stubGlobal("navigator", {});
    expect(await detectCurrentLocation()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("locationFromAddress", () => {
  it("prefers the city, then falls back to state and country", () => {
    expect(locationFromAddress({ town: "Ouro Preto" }, 1, 2)?.displayName).toBe(
      "Ouro Preto"
    );
    expect(
      locationFromAddress({ state: "Minas Gerais" }, 1, 2)?.displayName
    ).toBe("Minas Gerais");
    expect(locationFromAddress({ country: "Brasil" }, 1, 2)?.displayName).toBe(
      "Brasil"
    );
  });

  it("returns nothing for an empty address", () => {
    expect(locationFromAddress({}, 1, 2)).toBeNull();
  });
});
