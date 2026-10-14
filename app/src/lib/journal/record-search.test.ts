import { describe, expect, it } from "vitest";
import type { JournalEntry, Memory } from "@/lib/db/types";
import { searchRecordRows, type RecordSearchContext } from "./record-search";

const ctx: RecordSearchContext = {
  locale: "en",
  calendars: [],
  untitled: "Untitled",
  untitledMemory: "Memory",
};

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

function memory(id: string, over: Partial<Memory> = {}): Memory {
  return {
    id,
    text_content: "A moment",
    photo_paths: null,
    time_label: null,
    created_at: "2026-01-01T12:00:00.000Z",
    updated_at: "2026-01-01T12:00:00.000Z",
    synced_at: null,
    deleted_at: null,
    ...over,
  };
}

describe("searchRecordRows", () => {
  it("waits for two characters before searching", () => {
    const entries = [entry("2026-10-12", { title: "Rainy walk" })];
    expect(searchRecordRows(entries, [], "", ctx)).toEqual([]);
    expect(searchRecordRows(entries, [], "r", ctx)).toEqual([]);
    expect(searchRecordRows(entries, [], " r ", ctx)).toEqual([]);
    expect(searchRecordRows(entries, [], "ra", ctx)).toHaveLength(1);
  });

  it("finds days by title, text, emoji and place, newest first", () => {
    const entries = [
      entry("2026-03-01", { text_content: "Coffee with Ana by the sea" }),
      entry("2026-10-12", { title: "Ana's birthday", day_emoji: "🎂" }),
      entry("2026-05-05", {
        title: "Trip",
        location: {
          locations: [
            {
              displayName: "Lisbon",
              city: "Lisbon",
              state: null,
              country: "Portugal",
              countryCode: "PT",
              lat: 38.7,
              lon: -9.1,
            },
          ],
        },
      }),
    ];

    expect(searchRecordRows(entries, [], "ana", ctx).map((h) => h.id)).toEqual([
      "2026-10-12",
      "2026-03-01",
    ]);
    expect(
      searchRecordRows(entries, [], "lisbon", ctx).map((h) => h.id)
    ).toEqual(["2026-05-05"]);
  });

  it("titles a day by its first line when it has no title, else says untitled", () => {
    const hits = searchRecordRows(
      [
        entry("2026-10-12", { text_content: "Long walk\nthen dinner" }),
        entry("2026-10-11", { day_emoji: "🙂" }),
      ],
      [],
      "20",
      ctx
    );
    expect(hits.map((h) => h.title)).toEqual(["Long walk", "Untitled"]);
    expect(hits[1].emoji).toBe("🙂");
  });

  it("finds memories by their words, their label and the day remembered", () => {
    const memories = [
      memory("m1", {
        text_content: "Learning to swim",
        time_label: "when I was six",
        created_at: "2026-10-14T12:00:00.000Z",
      }),
      memory("m2", {
        text_content: "Road trip",
        time_label: "Summer 2019",
        created_at: "2026-09-02T12:00:00.000Z",
      }),
    ];

    const byText = searchRecordRows([], memories, "swim", ctx);
    expect(byText).toEqual([
      expect.objectContaining({
        kind: "memory",
        id: "m1",
        // The label names it; the detail says when it was remembered.
        title: "when I was six",
        detail: "Wed, Oct 14 2026",
      }),
    ]);
    expect(
      searchRecordRows([], memories, "2019", ctx).map((h) => h.id)
    ).toEqual(["m2"]);
    expect(
      searchRecordRows([], memories, "2026-09-02", ctx).map((h) => h.id)
    ).toEqual(["m2"]);
  });

  it("names a memory by its first line when it has no label", () => {
    const hits = searchRecordRows(
      [],
      [memory("m", { text_content: "Learning to swim\nat the lake" })],
      "swim",
      ctx
    );
    expect(hits[0].title).toBe("Learning to swim");
  });

  it("lists memories latest remembered first", () => {
    const hits = searchRecordRows(
      [],
      [
        memory("old", { created_at: "2026-01-05T12:00:00.000Z" }),
        memory("new", { created_at: "2026-06-05T12:00:00.000Z" }),
      ],
      "moment",
      ctx
    );
    expect(hits.map((h) => h.id)).toEqual(["new", "old"]);
  });

  it("leaves out trashed and empty memories", () => {
    const hits = searchRecordRows(
      [],
      [
        memory("gone", {
          text_content: "Swim",
          deleted_at: "2026-02-01T00:00:00.000Z",
        }),
        memory("blank", { text_content: null, time_label: null }),
      ],
      "swim",
      ctx
    );
    expect(hits).toEqual([]);
  });

  it("keeps room for memories when days fill the list, and the other way round", () => {
    const manyDays = Array.from({ length: 20 }, (_, i) =>
      entry(`2026-09-${String(i + 1).padStart(2, "0")}`, { title: "walk" })
    );
    const manyMemories = Array.from({ length: 20 }, (_, i) =>
      memory(`m${i}`, { text_content: "walk" })
    );

    const mixed = searchRecordRows(manyDays, manyMemories, "walk", ctx, 8);
    expect(mixed).toHaveLength(8);
    expect(
      mixed.filter((h) => h.kind === "memory").length
    ).toBeGreaterThanOrEqual(2);
    expect(
      mixed.filter((h) => h.kind === "entry").length
    ).toBeGreaterThanOrEqual(2);

    expect(searchRecordRows(manyDays, [], "walk", ctx, 8)).toHaveLength(8);
    expect(searchRecordRows([], manyMemories, "walk", ctx, 8)).toHaveLength(8);
    const oneMemory = searchRecordRows(
      manyDays,
      [memory("only", { text_content: "walk" })],
      "walk",
      ctx,
      8
    );
    expect(oneMemory).toHaveLength(8);
    expect(oneMemory.filter((h) => h.kind === "memory")).toHaveLength(1);
  });

  it("ignores trashed days and days with nothing in them", () => {
    const hits = searchRecordRows(
      [
        entry("2026-10-12", {
          title: "Walk",
          deleted_at: "2026-10-13T00:00:00.000Z",
        }),
        entry("2026-10-11"),
      ],
      [],
      "2026",
      ctx
    );
    expect(hits).toEqual([]);
  });
});
