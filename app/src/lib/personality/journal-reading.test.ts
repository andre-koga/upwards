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
  it("sends only written days, newest 60, oldest first, with capped text", async () => {
    await db.journalEntries.bulkAdd([
      entry("2026-11-01", { title: "One", text_content: "x".repeat(500) }),
      entry("2026-11-02", { text_content: "   " }),
      entry("2026-11-03", { title: "Gone", deleted_at: T0 }),
      entry("2026-11-04", { text_content: "Four" }),
    ]);
    const days = await collectReadingDays();
    expect(days.map((d) => d.date)).toEqual(["2026-11-01", "2026-11-04"]);
    expect(days[0].text).toHaveLength(300);
    expect(JSON.stringify(days)).not.toContain("secret");
  });

  it("keeps the most recent days when there are more than the limit", async () => {
    const rows = Array.from({ length: 65 }, (_, i) =>
      entry(`2026-09-${String(i + 1).padStart(2, "0")}`, { title: `t${i}` })
    );
    // 65 distinct ids; dates beyond 30 are not real days, which is fine for sorting
    await db.journalEntries.bulkAdd(rows);
    const days = await collectReadingDays();
    expect(days).toHaveLength(60);
    expect(days[0].date).toBe("2026-09-06");
    expect(days[59].date).toBe("2026-09-65");
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
