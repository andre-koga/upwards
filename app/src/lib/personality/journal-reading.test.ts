import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getCachedUserId: () => "44444444-4444-4444-8444-444444444444",
  getQueueAccountId: () => "44444444-4444-4444-8444-444444444444",
  getCachedSession: () => null,
}));
vi.mock("@/lib/sync/device-id", () => ({
  getOrCreateDeviceId: () => "device-a",
}));
vi.mock("@/lib/sync/sync-scheduler", () => ({
  requestDebouncedSync: () => undefined,
}));

import { db } from "@/lib/db";
import type { JournalEntry } from "@/lib/db/types";
import { buildJournalReading, collectReadingDays } from "./journal-reading";

const T0 = "2026-11-01T08:00:00.000Z";

function entry(date: string, patch: Partial<JournalEntry>): JournalEntry {
  return {
    id: `id-${date}`,
    entry_date: date,
    title: null,
    text_content: null,
    day_emoji: null,
    is_bookmarked: false,
    video_path: null,
    video_thumbnail: null,
    photo_paths: ["secret/photo.jpg"],
    location: null,
    created_at: T0,
    updated_at: T0,
    synced_at: T0,
    deleted_at: null,
    ...patch,
  };
}

beforeEach(async () => {
  await db.journalEntries.clear();
});

describe("collectReadingDays", () => {
  const TODAY = "2026-11-12";

  it("sends only written days, oldest first, with capped text", async () => {
    await db.journalEntries.bulkAdd([
      entry("2026-11-01", { title: "One", text_content: "x".repeat(500) }),
      entry("2026-11-02", { text_content: "   " }),
      entry("2026-11-03", { title: "Gone", deleted_at: T0 }),
      entry("2026-11-04", { text_content: "Four" }),
    ]);
    const days = await collectReadingDays(30, TODAY);
    expect(days.map((d) => d.date)).toEqual(["2026-11-01", "2026-11-04"]);
    expect(days[0].text).toHaveLength(300);
    expect(JSON.stringify(days)).not.toContain("secret");
  });

  it("reads only the days inside the chosen range", async () => {
    await db.journalEntries.bulkAdd([
      entry("2026-05-20", { title: "Half a year ago" }),
      entry("2026-08-20", { title: "Eighty-four days ago" }),
      entry("2026-10-14", { title: "Twenty-nine days ago" }),
      entry("2026-10-13", { title: "Thirty days ago" }),
      entry("2026-10-12", { title: "Thirty-one days ago" }),
      entry("2026-11-12", { title: "Today" }),
      entry("2026-11-13", { title: "Tomorrow" }),
    ]);
    const dates = async (range: 30 | 90 | 180) =>
      (await collectReadingDays(range, TODAY)).map((d) => d.date);
    expect(await dates(30)).toEqual(["2026-10-14", "2026-11-12"]);
    expect(await dates(90)).toEqual([
      "2026-08-20",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-11-12",
    ]);
    expect(await dates(180)).toContain("2026-05-20");
    expect(await dates(180)).not.toContain("2026-11-13");
  });

  it("can send a full 180 days", async () => {
    const rows = Array.from({ length: 180 }, (_, i) => {
      const d = new Date(2026, 10, 12 - i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return entry(date, { title: `t${i}` });
    });
    await db.journalEntries.bulkAdd(rows);
    expect(await collectReadingDays(180, TODAY)).toHaveLength(180);
    expect(await collectReadingDays(30, TODAY)).toHaveLength(30);
  });
});

describe("buildJournalReading", () => {
  const sent = [
    { date: "2026-11-01", title: "Walk", text: "I made a plan and kept it." },
    { date: "2026-11-04", title: "", text: "Called an old friend." },
  ];
  const parsed = {
    scores: {
      openness: 60,
      conscientiousness: 70,
      extraversion: 40,
      agreeableness: 55,
      neuroticism: 30,
    },
    notes: { conscientiousness: "Plans and follows through." },
    quotes: {
      conscientiousness: ["made a plan and kept it", "never wrote this"],
      extraversion: ["invented"],
    },
  };

  it("keeps only quotes found in the sent days and records the span", () => {
    const reading = buildJournalReading(parsed, sent);
    expect(reading.quotes).toEqual({
      conscientiousness: ["made a plan and kept it"],
    });
    expect(reading.notes).toEqual({
      conscientiousness: "Plans and follows through.",
    });
    expect(reading.span_start).toBe("2026-11-01");
    expect(reading.span_end).toBe("2026-11-04");
    expect(reading.days_read).toBe(2);
    expect(reading.scores.conscientiousness).toBe(70);
  });
});
