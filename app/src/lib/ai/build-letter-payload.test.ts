import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getCachedUserId: () => null,
  getQueueAccountId: () => null,
  getCachedSession: () => null,
}));

vi.mock("@/lib/time-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/time-utils")>();
  return {
    ...original,
    todayDateString: (date?: Date) =>
      date ? original.todayDateString(date) : "2026-10-21",
  };
});

import { db } from "@/lib/db";
import type {
  Activity,
  ActivityPeriod,
  JournalEntry,
  Memory,
} from "@/lib/db/types";
import { letterHasProse } from "../../../../supabase/functions/_shared/letter";
import { buildLetterRequest } from "./build-letter-payload";

const TODAY = "2026-10-21";
const stamp = (date: string) => `${date}T15:00:00.000Z`;

function activity(id: string): Activity {
  return {
    id,
    group_id: "g",
    name: "Run",
    routine: "daily",
    completion_target: 1,
    archived_at: null,
    tracks_time: true,
    is_pinned: false,
    order_index: null,
    created_at: stamp("2026-09-01"),
    updated_at: stamp("2026-09-01"),
    synced_at: null,
    deleted_at: null,
  };
}

beforeEach(async () => {
  await Promise.all([
    db.activities.clear(),
    db.dailyEntries.clear(),
    db.journalEntries.clear(),
    db.activityPeriods.clear(),
    db.memories.clear(),
  ]);
});

describe("buildLetterRequest", () => {
  it("sends the day's words and place names, and not coordinates or photos", async () => {
    const entry: JournalEntry = {
      id: "j1",
      entry_date: TODAY,
      title: "River",
      text_content: "I slept badly the night before.",
      day_emoji: null,
      is_bookmarked: null,
      video_path: "clip.mp4",
      video_thumbnail: "poster.jpg",
      photo_paths: ["secret.jpg"],
      location: {
        locations: [
          {
            displayName: "The river",
            city: "São Paulo",
            state: null,
            country: null,
            countryCode: "BR",
            lat: -23.55,
            lon: -46.63,
          },
        ],
      },
      created_at: stamp(TODAY),
      updated_at: stamp(TODAY),
      synced_at: null,
      deleted_at: null,
    };
    const memory: Memory = {
      id: "m1",
      text_content: "The house on the hill",
      photo_paths: ["old.jpg"],
      time_label: "when I was six",
      created_at: stamp(TODAY),
      updated_at: stamp(TODAY),
      synced_at: null,
      deleted_at: null,
    };
    const period: ActivityPeriod = {
      id: "p1",
      activity_id: "run",
      start_time: `${TODAY}T11:00:00.000Z`,
      end_time: `${TODAY}T12:00:00.000Z`,
      note: "easy pace",
      created_at: stamp(TODAY),
      updated_at: stamp(TODAY),
      synced_at: null,
      deleted_at: null,
    };
    await db.activities.add(activity("run"));
    await db.journalEntries.add(entry);
    await db.memories.add(memory);
    await db.activityPeriods.add(period);

    const { request } = await buildLetterRequest("pt");
    const sent = JSON.stringify(request);
    const today = request.days.find((item) => item.date === TODAY);

    expect(request.language).toBe("pt");
    expect(today?.text).toContain("slept badly");
    expect(today?.places).toEqual(["The river"]);
    expect(today?.memories.join(" ")).toContain("when I was six");
    expect(today?.notes).toContain("easy pace");
    expect(sent).not.toContain("-23.55");
    expect(sent).not.toContain("secret.jpg");
    expect(sent).not.toContain("clip.mp4");
    expect(letterHasProse(request)).toBe(true);
  });

  it("has no prose in a week with habits and an empty journal", async () => {
    await db.activities.add(activity("run"));
    const { request } = await buildLetterRequest("en");
    expect(letterHasProse(request)).toBe(false);
    expect(JSON.stringify(request)).not.toMatch(/text_content|photo_paths|lat/);
  });
});
