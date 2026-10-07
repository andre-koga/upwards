import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: null,
  isSupabaseConfigured: false,
  getCachedUserId: () => null,
  getCachedSession: () => null,
}));

import type { Activity, ActivityGroup } from "@/lib/db/types";
import { getDailyTaskInteractionState } from "./daily-task-interaction";
import { shouldShowActivity } from "./utils";

/**
 * Past days must show an item that existed then and drop it once it is
 * archived or deleted: the product rule behind `archived_at` / `deleted_at`.
 */

const at = (m: number, d: number, h = 12) =>
  new Date(2026, m - 1, d, h).toISOString();
const day = (m: number, d: number) => new Date(2026, m - 1, d, 12);

function activity(patch: Partial<Activity> = {}): Activity {
  return {
    id: "a1",
    group_id: "g1",
    name: "Run",
    routine: "daily",
    completion_target: 1,
    is_archived: false,
    completed_at: null,
    archived_at: null,
    tracks_time: true,
    is_pinned: false,
    order_index: null,
    created_at: at(1, 1),
    updated_at: at(1, 1),
    synced_at: null,
    deleted_at: null,
    ...patch,
  };
}

function group(patch: Partial<ActivityGroup> = {}): ActivityGroup {
  return {
    id: "g1",
    name: "Health",
    emoji: null,
    color: null,
    order_index: null,
    is_archived: false,
    archived_at: null,
    created_at: at(1, 1),
    updated_at: at(1, 1),
    synced_at: null,
    deleted_at: null,
    ...patch,
  };
}

const show = (a: Activity, g: ActivityGroup | null, m: number, d: number) =>
  shouldShowActivity(a, day(m, d), g, { viewDate: day(m, d) });

describe("past days with an archived activity", () => {
  const archived = activity({ archived_at: at(6, 10, 14) });

  it("still shows it on days before it was archived", () => {
    expect(show(archived, group(), 6, 1)).toBe(true);
    expect(show(archived, group(), 6, 9)).toBe(true);
  });

  it("still shows it on the day it was archived", () => {
    expect(show(archived, group(), 6, 10)).toBe(true);
  });

  it("drops it from the next day on", () => {
    expect(show(archived, group(), 6, 11)).toBe(false);
    expect(show(archived, group(), 12, 1)).toBe(false);
  });

  it("shows it everywhere again once restored", () => {
    const restored = activity({ archived_at: null });
    expect(show(restored, group(), 6, 11)).toBe(true);
  });
});

describe("past days with a deleted activity", () => {
  const deleted = activity({ deleted_at: at(6, 10, 14) });

  it("keeps the days it was used", () => {
    expect(show(deleted, group(), 6, 5)).toBe(true);
  });

  it("drops it on the day it was deleted", () => {
    expect(show(deleted, group(), 6, 10)).toBe(false);
    expect(show(deleted, group(), 6, 11)).toBe(false);
  });
});

describe("a group's lifecycle carries to its activities", () => {
  it("hides activities of an archived group from the next day", () => {
    const g = group({ archived_at: at(6, 10, 14) });
    expect(show(activity(), g, 6, 9)).toBe(true);
    expect(show(activity(), g, 6, 10)).toBe(true);
    expect(show(activity(), g, 6, 11)).toBe(false);
  });

  it("hides activities of a deleted group from that day", () => {
    const g = group({ deleted_at: at(6, 10, 14) });
    expect(show(activity(), g, 6, 9)).toBe(true);
    expect(show(activity(), g, 6, 10)).toBe(false);
  });
});

describe("days before an activity existed", () => {
  it("do not show it", () => {
    expect(show(activity({ created_at: at(3, 1) }), group(), 2, 20)).toBe(
      false
    );
  });
});

describe("the timer", () => {
  const temporal = { viewDate: day(6, 11) };

  it("is available on an ordinary activity", () => {
    expect(getDailyTaskInteractionState(activity(), temporal).canUseTimer).toBe(
      true
    );
  });

  it("is not available on a check-only activity, active or archived", () => {
    const checkOnly = activity({ tracks_time: false });
    expect(getDailyTaskInteractionState(checkOnly, temporal).canUseTimer).toBe(
      false
    );
    expect(
      getDailyTaskInteractionState(
        activity({ tracks_time: false, archived_at: at(6, 1) }),
        temporal
      ).canUseTimer
    ).toBe(false);
  });

  it("still lets a check-only activity be ticked off", () => {
    expect(
      getDailyTaskInteractionState(activity({ tracks_time: false }), temporal)
        .canEditCounts
    ).toBe(true);
  });

  it("is not available on a deleted activity", () => {
    expect(
      getDailyTaskInteractionState(activity({ deleted_at: at(6, 1) }), temporal)
        .canUseTimer
    ).toBe(false);
  });
});
