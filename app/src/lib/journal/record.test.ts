import { describe, expect, it } from "vitest";
import type { JournalEntry, Memory } from "@/lib/db/types";
import {
  DEFAULT_JOURNAL_ARCHIVE_FILTERS,
  buildJournalArchiveFeed,
  isArchiveRecord,
  type JournalArchiveFilters,
} from "./archive";
import {
  collectMemoryYears,
  memoriesByDate,
  memoryMatchesFilters,
  memoryRememberedDate,
  recordMemories,
} from "./record";

/** A memory remembered at midday UTC on `day`, which is that same local day in every timezone but the extremes. */
const remembered = (day: string) => `${day}T12:00:00.000Z`;

function memory(over: Partial<Memory> & { id: string }): Memory {
  return {
    text_content: "A moment",
    photo_paths: null,
    time_label: null,
    created_at: remembered("2026-01-01"),
    updated_at: remembered("2026-01-01"),
    synced_at: null,
    deleted_at: null,
    ...over,
  };
}

function entry(date: string): JournalEntry {
  return {
    id: date,
    entry_date: date,
    title: `Day ${date}`,
    text_content: null,
    day_emoji: null,
    is_bookmarked: null,
    video_path: null,
    video_thumbnail: null,
    photo_paths: null,
    location: null,
    created_at: `${date}T00:00:00.000Z`,
    updated_at: `${date}T00:00:00.000Z`,
    synced_at: null,
    deleted_at: null,
  };
}

const filters = (
  over: Partial<JournalArchiveFilters> = {}
): JournalArchiveFilters => ({ ...DEFAULT_JOURNAL_ARCHIVE_FILTERS, ...over });

describe("memoryRememberedDate", () => {
  it("is the local day the memory was written down", () => {
    expect(memoryRememberedDate({ created_at: remembered("2026-10-14") })).toBe(
      "2026-10-14"
    );
  });

  it("uses the local calendar, not UTC", () => {
    const at = new Date(2026, 9, 14, 23, 30); // 23:30 local on 14 Oct
    expect(memoryRememberedDate({ created_at: at.toISOString() })).toBe(
      "2026-10-14"
    );
    const early = new Date(2026, 9, 14, 0, 15); // 00:15 local
    expect(memoryRememberedDate({ created_at: early.toISOString() })).toBe(
      "2026-10-14"
    );
  });

  it("does not depend on the label", () => {
    expect(memoryRememberedDate({ created_at: remembered("2026-10-14") })).toBe(
      memoryRememberedDate({
        ...memory({ id: "x", time_label: "Summer 2019" }),
        created_at: remembered("2026-10-14"),
      })
    );
  });

  it("falls back to the stored text when the time cannot be read", () => {
    expect(memoryRememberedDate({ created_at: "2026-10-14 garbage" })).toBe(
      "2026-10-14"
    );
  });
});

describe("recordMemories", () => {
  it("drops trashed and empty memories", () => {
    const kept = recordMemories([
      memory({ id: "a" }),
      memory({ id: "trashed", deleted_at: remembered("2026-02-01") }),
      memory({ id: "empty", text_content: " ", photo_paths: [] }),
      memory({ id: "photo", text_content: null, photo_paths: ["p"] }),
    ]);
    expect(kept.map((m) => m.id)).toEqual(["a", "photo"]);
  });
});

describe("memoriesByDate", () => {
  it("groups by the day remembered, the latest of a day first", () => {
    const byDate = memoriesByDate([
      memory({ id: "morning", created_at: "2026-10-14T09:00:00.000Z" }),
      memory({ id: "evening", created_at: "2026-10-14T20:00:00.000Z" }),
      memory({ id: "other", created_at: remembered("2026-10-13") }),
    ]);
    expect([...byDate.keys()].sort()).toEqual(["2026-10-13", "2026-10-14"]);
    expect(byDate.get("2026-10-14")?.map((m) => m.id)).toEqual([
      "evening",
      "morning",
    ]);
  });
});

describe("collectMemoryYears", () => {
  it("lists each year a memory was remembered in, once", () => {
    expect(
      collectMemoryYears([
        memory({ id: "1", created_at: remembered("2019-06-01") }),
        memory({ id: "2", created_at: remembered("2019-08-01") }),
        memory({ id: "3", created_at: remembered("2024-02-01") }),
      ]).sort()
    ).toEqual([2019, 2024]);
  });

  it("ignores what the label says", () => {
    expect(
      collectMemoryYears([
        memory({
          id: "1",
          created_at: remembered("2026-02-01"),
          time_label: "Summer 2019",
        }),
      ])
    ).toEqual([2026]);
  });
});

describe("memoryMatchesFilters", () => {
  const m = memory({
    id: "m",
    time_label: "Summer 2019",
    text_content: "Beach",
    created_at: remembered("2026-10-14"),
  });

  it("matches everything by default", () => {
    expect(memoryMatchesFilters(m, filters())).toBe(true);
  });

  it("searches its text, its label and the day it was remembered", () => {
    expect(memoryMatchesFilters(m, filters({ query: "beach" }))).toBe(true);
    expect(memoryMatchesFilters(m, filters({ query: "summer" }))).toBe(true);
    // The label's own year is text the person wrote, so it is searchable.
    expect(memoryMatchesFilters(m, filters({ query: "2019" }))).toBe(true);
    expect(memoryMatchesFilters(m, filters({ query: "2026-10-14" }))).toBe(
      true
    );
    expect(memoryMatchesFilters(m, filters({ query: "october 2026" }))).toBe(
      true
    );
    expect(memoryMatchesFilters(m, filters({ query: "beach 2019" }))).toBe(
      true
    );
    expect(memoryMatchesFilters(m, filters({ query: "mountain" }))).toBe(false);
  });

  it("has no bookmark, video or place, so requiring one leaves it out", () => {
    expect(memoryMatchesFilters(m, filters({ bookmarked: "yes" }))).toBe(false);
    expect(memoryMatchesFilters(m, filters({ hasVideo: "yes" }))).toBe(false);
    expect(memoryMatchesFilters(m, filters({ hasPlaces: "yes" }))).toBe(false);
  });

  it("keeps it when a filter excludes what it does not have", () => {
    expect(memoryMatchesFilters(m, filters({ bookmarked: "no" }))).toBe(true);
    expect(memoryMatchesFilters(m, filters({ hasVideo: "no" }))).toBe(true);
    expect(memoryMatchesFilters(m, filters({ hasPlaces: "no" }))).toBe(true);
  });

  it("filters by photos", () => {
    const withPhoto = memory({ id: "p", photo_paths: ["a"] });
    expect(memoryMatchesFilters(withPhoto, filters({ hasPhotos: "yes" }))).toBe(
      true
    );
    expect(memoryMatchesFilters(m, filters({ hasPhotos: "yes" }))).toBe(false);
    expect(memoryMatchesFilters(withPhoto, filters({ hasPhotos: "no" }))).toBe(
      false
    );
  });

  it("leaves it out of a map selection", () => {
    expect(
      memoryMatchesFilters(m, filters({ mapEntryDates: ["2026-10-14"] }))
    ).toBe(false);
  });

  it("is taken by a date window like any day, by the day it was remembered", () => {
    const window = (start: string, end: string) =>
      filters({ dateRange: { start, end, preset: "custom" } });

    expect(memoryMatchesFilters(m, window("2026-10-14", "2026-10-14"))).toBe(
      true
    );
    expect(memoryMatchesFilters(m, window("2026-10-01", "2026-10-31"))).toBe(
      true
    );
    expect(memoryMatchesFilters(m, window("2026-10-15", "2026-10-31"))).toBe(
      false
    );
    // Its label names 2019, but it was remembered in 2026.
    expect(memoryMatchesFilters(m, window("2019-01-01", "2019-12-31"))).toBe(
      false
    );
    const thisYear = filters({
      dateRange: {
        start: "2026-01-01",
        end: "2026-12-31",
        preset: "year",
        year: 2026,
      },
    });
    expect(memoryMatchesFilters(m, thisYear)).toBe(true);
  });
});

describe("buildJournalArchiveFeed with memories", () => {
  const kinds = (items: ReturnType<typeof buildJournalArchiveFeed>): string[] =>
    items.map((item) => {
      if (item.kind === "month") return `month:${item.key}`;
      if (item.kind === "entry") return `entry:${item.entry.entry_date}`;
      if (item.kind === "memory") return `memory:${item.memory.id}`;
      return item.kind;
    });
  const feed = (entries: JournalEntry[], memories: Memory[]) =>
    buildJournalArchiveFeed(entries, "en", [], undefined, memories);
  const on = (id: string, day: string, over: Partial<Memory> = {}) =>
    memory({ id, created_at: remembered(day), ...over });

  it("is unchanged without memories", () => {
    expect(kinds(feed([entry("2026-03-02"), entry("2026-03-01")], []))).toEqual(
      ["month:2026-03", "entry:2026-03-02", "entry:2026-03-01"]
    );
  });

  it("puts a memory after the entry of the day it was remembered", () => {
    const items = feed(
      [entry("2026-03-02"), entry("2026-03-01")],
      [on("m", "2026-03-02")]
    );
    expect(kinds(items)).toEqual([
      "month:2026-03",
      "entry:2026-03-02",
      "memory:m",
      "entry:2026-03-01",
    ]);
  });

  it("gives a day with only a memory its own place and month banner", () => {
    const items = feed(
      [entry("2026-03-02"), entry("2026-01-10")],
      [on("m", "2026-02-14")]
    );
    expect(kinds(items)).toEqual([
      "month:2026-03",
      "entry:2026-03-02",
      "month:2026-02",
      "memory:m",
      "month:2026-01",
      "entry:2026-01-10",
    ]);
  });

  it("puts a memory remembered after the newest day above all of them", () => {
    const items = feed([entry("2026-03-02")], [on("m", "2026-04-01")]);
    expect(kinds(items)).toEqual([
      "month:2026-04",
      "memory:m",
      "month:2026-03",
      "entry:2026-03-02",
    ]);
  });

  it("puts a memory remembered before every day at the end, because that is when it came back", () => {
    const items = feed([entry("2026-03-02")], [on("m", "2025-06-01")]);
    expect(kinds(items)).toEqual([
      "month:2026-03",
      "entry:2026-03-02",
      "month:2025-06",
      "memory:m",
    ]);
  });

  it("ignores the label when placing a memory", () => {
    const items = feed(
      [entry("2026-03-02")],
      [
        on("m", "2026-03-02", { time_label: "Summer 2019" }),
        on("six", "2026-03-02", { time_label: "when I was six" }),
      ]
    );
    expect(kinds(items).filter((k) => k.startsWith("memory"))).toHaveLength(2);
    expect(kinds(items)[0]).toBe("month:2026-03");
    expect(kinds(items)).not.toContain("group:2019");
    expect(kinds(items)).not.toContain("group:undated");
  });

  it("orders several memories of one day latest first", () => {
    const items = feed(
      [],
      [
        memory({ id: "early", created_at: "2026-03-02T08:00:00.000Z" }),
        memory({ id: "late", created_at: "2026-03-02T20:00:00.000Z" }),
      ]
    );
    expect(kinds(items)).toEqual([
      "month:2026-03",
      "memory:late",
      "memory:early",
    ]);
  });

  it("works with only memories", () => {
    const items = feed([], [on("m", "2026-03-02")]);
    expect(kinds(items)).toEqual(["month:2026-03", "memory:m"]);
  });

  it("carries the day on a memory item", () => {
    const items = feed([], [on("m", "2026-03-02")]);
    const item = items.find((i) => i.kind === "memory");
    expect(item && item.kind === "memory" ? item.date : null).toBe(
      "2026-03-02"
    );
  });

  it("counts entries and memories as records, not the headings", () => {
    const items = feed([entry("2026-03-02")], [on("m", "2026-03-02")]);
    expect(items.filter(isArchiveRecord)).toHaveLength(2);
  });
});
