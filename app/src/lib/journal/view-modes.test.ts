import { describe, expect, it } from "vitest";
import type { JournalEntry, Memory } from "@/lib/db/types";
import {
  buildGalleryMemoryGroups,
  buildGalleryMonths,
  parseJournalView,
} from "./view-modes";

function entry(date: string, over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: date,
    entry_date: date,
    title: null,
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
    ...over,
  };
}

describe("parseJournalView", () => {
  it("accepts the four views and falls back to the feed", () => {
    expect(parseJournalView("calendar")).toBe("calendar");
    expect(parseJournalView("map")).toBe("map");
    expect(parseJournalView("gallery")).toBe("gallery");
    expect(parseJournalView("feed")).toBe("feed");
    expect(parseJournalView(null)).toBe("feed");
    expect(parseJournalView("timeline")).toBe("feed");
    expect(parseJournalView("")).toBe("feed");
  });
});

describe("buildGalleryMonths", () => {
  it("groups photos by month, newest first, keeping each day's order", () => {
    const months = buildGalleryMonths(
      [
        entry("2026-09-30", { photo_paths: ["a.jpg"] }),
        entry("2026-10-12", { photo_paths: ["b1.jpg", "b2.jpg"] }),
        entry("2026-10-03", { photo_paths: ["c.jpg"] }),
      ],
      { includeVideo: false }
    );

    expect(months.map((m) => m.key)).toEqual(["2026-10", "2026-09"]);
    expect(months[0]).toMatchObject({ year: 2026, month: 10 });
    expect(months[0].items.map((i) => i.path)).toEqual([
      "b1.jpg",
      "b2.jpg",
      "c.jpg",
    ]);
    expect(months[1].items.map((i) => i.path)).toEqual(["a.jpg"]);
  });

  it("skips days with no media and trashed days", () => {
    const months = buildGalleryMonths(
      [
        entry("2026-10-12", { title: "Words only" }),
        entry("2026-10-11", {
          photo_paths: ["gone.jpg"],
          deleted_at: "2026-10-12T00:00:00.000Z",
        }),
        entry("2026-10-10", { photo_paths: ["  ", "kept.jpg"] }),
      ],
      { includeVideo: false }
    );
    expect(months).toHaveLength(1);
    expect(months[0].items.map((i) => i.path)).toEqual(["kept.jpg"]);
  });

  it("includes clips only when the daily clip is on, ahead of the day's photos", () => {
    const entries = [
      entry("2026-10-12", {
        photo_paths: ["p.jpg"],
        video_path: "u/clip.mp4",
        video_thumbnail: "data:image/jpeg;base64,xx",
      }),
    ];

    const withClips = buildGalleryMonths(entries, { includeVideo: true });
    expect(withClips[0].items.map((i) => i.kind)).toEqual(["video", "photo"]);
    expect(withClips[0].items[0]).toMatchObject({
      path: "u/clip.mp4",
      poster: "data:image/jpeg;base64,xx",
    });

    const without = buildGalleryMonths(entries, { includeVideo: false });
    expect(without[0].items.map((i) => i.kind)).toEqual(["photo"]);
  });

  it("gives every item a distinct key, even for a repeated photo on two days", () => {
    const months = buildGalleryMonths(
      [
        entry("2026-10-12", { photo_paths: ["same.jpg"] }),
        entry("2026-10-11", { photo_paths: ["same.jpg"] }),
      ],
      { includeVideo: false }
    );
    const keys = months.flatMap((m) => m.items.map((i) => i.key));
    expect(new Set(keys).size).toBe(2);
  });

  it("returns nothing for an empty record", () => {
    expect(buildGalleryMonths([], { includeVideo: true })).toEqual([]);
  });
});

describe("buildGalleryMemoryGroups", () => {
  function memory(id: string, over: Partial<Memory> = {}): Memory {
    return {
      id,
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

  it("groups memory photos by the year in their own words, undated last", () => {
    const groups = buildGalleryMemoryGroups(
      [
        memory("a", { time_label: "Summer 2019", photo_paths: ["a1.jpg"] }),
        memory("b", { time_label: "when I was six", photo_paths: ["b1.jpg"] }),
        memory("c", {
          time_label: "Winter 2024",
          photo_paths: ["c1.jpg", "c2.jpg"],
        }),
      ],
      2026
    );

    expect(groups.map((g) => g.year)).toEqual([2024, 2019, null]);
    expect(groups[0].items.map((i) => i.path)).toEqual(["c1.jpg", "c2.jpg"]);
    expect(groups[0].items[0]).toMatchObject({
      memoryId: "c",
      entryDate: null,
      caption: "Winter 2024",
    });
  });

  it("skips memories without photos and trashed ones", () => {
    const groups = buildGalleryMemoryGroups(
      [
        memory("none", { time_label: "2020" }),
        memory("gone", {
          time_label: "2020",
          photo_paths: ["x.jpg"],
          deleted_at: "2026-02-01T00:00:00.000Z",
        }),
      ],
      2026
    );
    expect(groups).toEqual([]);
  });
});
