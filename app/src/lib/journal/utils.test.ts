import { describe, expect, it } from "vitest";
import type { LocationData } from "@/lib/db/types";
import {
  isSameJournalPlace,
  mergeJournalLocationRoute,
  parseJournalLocationRoute,
  serializeJournalLocationRoute,
} from "./utils";

function place(
  overrides: Partial<LocationData> & Pick<LocationData, "displayName">
): LocationData {
  return {
    displayName: overrides.displayName,
    city: overrides.city ?? null,
    state: overrides.state ?? null,
    country: overrides.country ?? null,
    countryCode: overrides.countryCode ?? null,
    lat: overrides.lat ?? null,
    lon: overrides.lon ?? null,
  };
}

describe("parseJournalLocationRoute", () => {
  it("supports legacy string, object, and array shapes", () => {
    expect(parseJournalLocationRoute("Paris")).toEqual({
      locations: [place({ displayName: "Paris" })],
    });

    expect(
      parseJournalLocationRoute({
        displayName: "São Paulo",
        city: "São Paulo",
        countryCode: "BR",
      })
    ).toEqual({
      locations: [
        place({
          displayName: "São Paulo",
          city: "São Paulo",
          countryCode: "BR",
        }),
      ],
    });

    expect(
      parseJournalLocationRoute([
        { name: "A" },
        { label: "B", city: "B", countryCode: "US" },
        { displayName: "   " },
      ])
    ).toEqual({
      locations: [
        place({ displayName: "A" }),
        place({ displayName: "B", city: "B", countryCode: "US" }),
      ],
    });

    expect(
      parseJournalLocationRoute({
        locations: [
          { displayName: "Route stop", city: "Austin", countryCode: "US" },
        ],
      })
    ).toEqual({
      locations: [
        place({
          displayName: "Route stop",
          city: "Austin",
          countryCode: "US",
        }),
      ],
    });
  });

  it("serializes empty routes as null", () => {
    expect(serializeJournalLocationRoute({ locations: [] })).toBeNull();
    expect(
      serializeJournalLocationRoute({
        locations: [place({ displayName: "Home" })],
      })
    ).toEqual({ locations: [place({ displayName: "Home" })] });
  });
});

describe("isSameJournalPlace / mergeJournalLocationRoute", () => {
  it("matches by city + country code", () => {
    expect(
      isSameJournalPlace(
        place({
          displayName: "Austin, US",
          city: "Austin",
          countryCode: "US",
        }),
        place({
          displayName: "Austin TX",
          city: "Austin",
          countryCode: "US",
        })
      )
    ).toBe(true);
    expect(
      isSameJournalPlace(
        place({
          displayName: "Austin, US",
          city: "Austin",
          countryCode: "US",
        }),
        place({
          displayName: "Dallas, US",
          city: "Dallas",
          countryCode: "US",
        })
      )
    ).toBe(false);
  });

  it("falls back to distance when city is missing", () => {
    expect(
      isSameJournalPlace(
        place({ displayName: "A", lat: 30.0, lon: -97.0 }),
        place({ displayName: "B", lat: 30.1, lon: -97.1 })
      )
    ).toBe(true);
    expect(
      isSameJournalPlace(
        place({ displayName: "A", lat: 30.0, lon: -97.0 }),
        place({ displayName: "B", lat: 40.0, lon: -74.0 })
      )
    ).toBe(false);
  });

  it("appends only when the next stop differs", () => {
    const austin = place({
      displayName: "Austin",
      city: "Austin",
      countryCode: "US",
    });
    const dallas = place({
      displayName: "Dallas",
      city: "Dallas",
      countryCode: "US",
    });
    const once = mergeJournalLocationRoute({ locations: [] }, austin);
    expect(once.locations).toHaveLength(1);
    expect(mergeJournalLocationRoute(once, austin).locations).toHaveLength(1);
    expect(mergeJournalLocationRoute(once, dallas).locations).toHaveLength(2);
  });
});
