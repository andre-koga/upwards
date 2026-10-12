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
  groupMemoriesByYear,
  memoryAnchorYear,
  memoryMatchesFilters,
  recordMemories,
} from "./record";

const NOW_YEAR = 2026;

function memory(over: Partial<Memory> & { id: string }): Memory {
  return {
    text_content: "A moment",
    photo_paths: null,
    time_label: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
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
    is_journal_complete: null,
    journal_entry_number: null,
    journal_completion_streak: null,
    journal_completed_at: null,
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

describe("memoryAnchorYear", () => {
  it("reads a year out of the person's own words", () => {
    expect(memoryAnchorYear("Summer 2019", NOW_YEAR)).toBe(2019);
    expect(memoryAnchorYear("2019", NOW_YEAR)).toBe(2019);
    expect(memoryAnchorYear("verão de 1998", NOW_YEAR)).toBe(1998);
  });

  it("takes the later year of a range", () => {
    expect(memoryAnchorYear("1999 to 2001", NOW_YEAR)).toBe(2001);
    expect(memoryAnchorYear("2018-2020", NOW_YEAR)).toBe(2020);
  });

  it("gives no year when the label names none", () => {
    expect(memoryAnchorYear("when I was six", NOW_YEAR)).toBeNull();
    expect(memoryAnchorYear("around COVID", NOW_YEAR)).toBeNull();
    expect(memoryAnchorYear("", NOW_YEAR)).toBeNull();
    expect(memoryAnchorYear(null, NOW_YEAR)).toBeNull();
  });

  it("ignores numbers that are not years, and years that have not happened", () => {
    expect(memoryAnchorYear("20190 people", NOW_YEAR)).toBeNull();
    expect(memoryAnchorYear("room 1234", NOW_YEAR)).toBeNull();
    expect(memoryAnchorYear("in 2050", NOW_YEAR)).toBeNull();
    expect(memoryAnchorYear("2019 or maybe 2050", NOW_YEAR)).toBe(2019);
  });
});

describe("recordMemories", () => {
  it("drops trashed and empty memories", () => {
    const kept = recordMemories([
      memory({ id: "a" }),
      memory({ id: "trashed", deleted_at: "2026-02-01T00:00:00.000Z" }),
      memory({ id: "empty", text_content: " ", photo_paths: [] }),
      memory({ id: "photo", text_content: null, photo_paths: ["p"] }),
    ]);
    expect(kept.map((m) => m.id)).toEqual(["a", "photo"]);
  });
});

describe("collectMemoryYears", () => {
  it("lists each anchored year once", () => {
    expect(
      collectMemoryYears([
        memory({ id: "1", time_label: "2019" }),
        memory({ id: "2", time_label: "summer 2019" }),
        memory({ id: "3", time_label: "2015" }),
        memory({ id: "4", time_label: "when I was six" }),
      ]).sort()
    ).toEqual([2015, 2019]);
  });
});

describe("memoryMatchesFilters", () => {
  const m = memory({
    id: "m",
    time_label: "Summer 2019",
    text_content: "Beach",
  });

  it("matches everything by default", () => {
    expect(memoryMatchesFilters(m, filters(), NOW_YEAR)).toBe(true);
  });

  it("searches its text, its label and its year", () => {
    expect(memoryMatchesFilters(m, filters({ query: "beach" }), NOW_YEAR)).toBe(
      true
    );
    expect(
      memoryMatchesFilters(m, filters({ query: "summer" }), NOW_YEAR)
    ).toBe(true);
    expect(memoryMatchesFilters(m, filters({ query: "2019" }), NOW_YEAR)).toBe(
      true
    );
    expect(
      memoryMatchesFilters(m, filters({ query: "beach 2019" }), NOW_YEAR)
    ).toBe(true);
    expect(
      memoryMatchesFilters(m, filters({ query: "mountain" }), NOW_YEAR)
    ).toBe(false);
  });

  it("has no bookmark, video or place, so requiring one leaves it out", () => {
    expect(
      memoryMatchesFilters(m, filters({ bookmarked: "yes" }), NOW_YEAR)
    ).toBe(false);
    expect(
      memoryMatchesFilters(m, filters({ hasVideo: "yes" }), NOW_YEAR)
    ).toBe(false);
    expect(
      memoryMatchesFilters(m, filters({ hasPlaces: "yes" }), NOW_YEAR)
    ).toBe(false);
  });

  it("keeps it when a filter excludes what it does not have", () => {
    expect(
      memoryMatchesFilters(m, filters({ bookmarked: "no" }), NOW_YEAR)
    ).toBe(true);
    expect(memoryMatchesFilters(m, filters({ hasVideo: "no" }), NOW_YEAR)).toBe(
      true
    );
    expect(
      memoryMatchesFilters(m, filters({ hasPlaces: "no" }), NOW_YEAR)
    ).toBe(true);
  });

  it("filters by photos", () => {
    const withPhoto = memory({ id: "p", photo_paths: ["a"] });
    expect(
      memoryMatchesFilters(withPhoto, filters({ hasPhotos: "yes" }), NOW_YEAR)
    ).toBe(true);
    expect(
      memoryMatchesFilters(m, filters({ hasPhotos: "yes" }), NOW_YEAR)
    ).toBe(false);
    expect(
      memoryMatchesFilters(withPhoto, filters({ hasPhotos: "no" }), NOW_YEAR)
    ).toBe(false);
  });

  it("leaves it out of a map selection", () => {
    expect(
      memoryMatchesFilters(
        m,
        filters({ mapEntryDates: ["2019-07-01"] }),
        NOW_YEAR
      )
    ).toBe(false);
  });

  it("is taken by a date window only when the window covers its year", () => {
    const year = (y: number) =>
      filters({
        dateRange: {
          start: `${y}-01-01`,
          end: `${y}-12-31`,
          preset: "year",
          year: y,
        },
      });
    expect(memoryMatchesFilters(m, year(2019), NOW_YEAR)).toBe(true);
    expect(memoryMatchesFilters(m, year(2020), NOW_YEAR)).toBe(false);
    // The current-year preset ends today, yet still takes this year's memories.
    const thisYear = memory({ id: "t", time_label: "2026" });
    expect(
      memoryMatchesFilters(
        thisYear,
        filters({
          dateRange: {
            start: "2026-01-01",
            end: "2026-10-12",
            preset: "year",
            year: 2026,
          },
        }),
        NOW_YEAR
      )
    ).toBe(true);
    const custom = filters({
      dateRange: { start: "2019-03-01", end: "2020-06-01", preset: "custom" },
    });
    expect(memoryMatchesFilters(m, custom, NOW_YEAR)).toBe(false);
    const wide = filters({
      dateRange: { start: "2018-01-01", end: "2020-12-31", preset: "custom" },
    });
    expect(memoryMatchesFilters(m, wide, NOW_YEAR)).toBe(true);
    const recent = filters({
      dateRange: {
        start: "2026-09-01",
        end: "2026-10-12",
        preset: "thisMonth",
      },
    });
    expect(memoryMatchesFilters(m, recent, NOW_YEAR)).toBe(false);
  });

  it("is left out of any date window when it names no year", () => {
    const undated = memory({ id: "u", time_label: "when I was six" });
    const window = filters({
      dateRange: {
        start: "2019-01-01",
        end: "2019-12-31",
        preset: "year",
        year: 2019,
      },
    });
    expect(memoryMatchesFilters(undated, window, NOW_YEAR)).toBe(false);
  });
});

describe("groupMemoriesByYear", () => {
  it("orders years newest first with the undated group last", () => {
    const groups = groupMemoriesByYear(
      [
        memory({ id: "u", time_label: "when I was six" }),
        memory({ id: "a", time_label: "2015" }),
        memory({ id: "b", time_label: "2019" }),
        memory({
          id: "c",
          time_label: "Summer 2019",
          created_at: "2026-03-01T00:00:00.000Z",
        }),
      ],
      NOW_YEAR
    );
    expect(groups.map((g) => g.year)).toEqual([2019, 2015, null]);
    // Within a year, the most recently written comes first.
    expect(groups[0].memories.map((m) => m.id)).toEqual(["c", "b"]);
  });
});

describe("buildJournalArchiveFeed with memories", () => {
  const kinds = (items: ReturnType<typeof buildJournalArchiveFeed>): string[] =>
    items.map((item) => {
      if (item.kind === "month") return `month:${item.key}`;
      if (item.kind === "entry") return `entry:${item.entry.entry_date}`;
      if (item.kind === "memories") return `group:${item.year ?? "undated"}`;
      if (item.kind === "memory") return `memory:${item.memory.id}`;
      return item.kind;
    });
  const feed = (entries: JournalEntry[], memories: Memory[]) =>
    buildJournalArchiveFeed(entries, "en", [], undefined, memories);

  it("is unchanged without memories", () => {
    expect(kinds(feed([entry("2026-03-02"), entry("2026-03-01")], []))).toEqual(
      ["month:2026-03", "entry:2026-03-02", "entry:2026-03-01"]
    );
  });

  it("places a year's memories after that year's days, before the year before", () => {
    const items = feed(
      [
        entry("2026-03-02"),
        entry("2025-12-30"),
        entry("2025-01-05"),
        entry("2024-06-01"),
      ],
      [memory({ id: "m25", time_label: "2025" })]
    );
    expect(kinds(items)).toEqual([
      "month:2026-03",
      "entry:2026-03-02",
      "month:2025-12",
      "entry:2025-12-30",
      "month:2025-01",
      "entry:2025-01-05",
      "group:2025",
      "memory:m25",
      "month:2024-06",
      "entry:2024-06-01",
    ]);
  });

  it("puts memories from a year with no days between the years around it", () => {
    const items = feed(
      [entry("2026-03-02"), entry("2020-06-01")],
      [memory({ id: "m23", time_label: "2023" })]
    );
    expect(kinds(items)).toEqual([
      "month:2026-03",
      "entry:2026-03-02",
      "group:2023",
      "memory:m23",
      "month:2020-06",
      "entry:2020-06-01",
    ]);
  });

  it("puts memories from newer than every day above all of them", () => {
    const items = feed(
      [entry("2020-06-01")],
      [memory({ id: "m24", time_label: "2024" })]
    );
    expect(kinds(items)).toEqual([
      "group:2024",
      "memory:m24",
      "month:2020-06",
      "entry:2020-06-01",
    ]);
  });

  it("closes the feed with the undated memories", () => {
    const items = feed(
      [entry("2026-03-02")],
      [
        memory({ id: "six", time_label: "when I was six" }),
        memory({ id: "m19", time_label: "2019" }),
      ]
    );
    expect(kinds(items)).toEqual([
      "month:2026-03",
      "entry:2026-03-02",
      "group:2019",
      "memory:m19",
      "group:undated",
      "memory:six",
    ]);
  });

  it("works with only memories", () => {
    const items = feed([], [memory({ id: "six", time_label: null })]);
    expect(kinds(items)).toEqual(["group:undated", "memory:six"]);
  });

  it("counts entries and memories as records, not the headings", () => {
    const items = feed(
      [entry("2026-03-02")],
      [memory({ id: "m19", time_label: "2019" })]
    );
    expect(items.filter(isArchiveRecord)).toHaveLength(2);
  });
});
