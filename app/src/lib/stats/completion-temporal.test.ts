import { beforeEach, describe, expect, it } from "vitest";
import type { Activity, DailyEntry } from "@/lib/db/types";
import { buildActivityCompletionByDate } from "./completion";
import type { ActivityDefinitionVersion } from "@/lib/db/types";

const storage = new Map<string, string>();

function mockLocalStorage() {
  globalThis.localStorage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    key(index: number) {
      return [...storage.keys()][index] ?? null;
    },
  } as Storage;
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    group_id: "group-1",
    name: "Read",
    routine: "weekly:1,2,3,4,5",
    completion_target: 1,
    completed_at: null,
    order_index: 0,
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-06-01T12:00:00.000Z",
    synced_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function version(
  overrides: Partial<ActivityDefinitionVersion> &
    Pick<ActivityDefinitionVersion, "id" | "effective_from" | "routine">
): ActivityDefinitionVersion {
  return {
    id: overrides.id,
    activity_id: "act-1",
    parent_version_id: overrides.parent_version_id ?? null,
    effective_from: overrides.effective_from,
    recorded_at: `${overrides.effective_from}T12:00:00.000Z`,
    server_sequence: null,
    operation_id: `op-${overrides.id}`,
    device_id: "device-1",
    name: "Read",
    routine: overrides.routine,
    completion_target: overrides.completion_target ?? 1,
    group_id: "group-1",
    order_index: 0,
    schema_version: 1,
    created_at: `${overrides.effective_from}T12:00:00.000Z`,
    deleted_at: null,
  };
}

describe("buildActivityCompletionByDate with definition versions", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    localStorage.setItem("okhabit:day_reset_minutes", "0");
  });

  it("does not rewrite earlier weekend outcomes after a weekday change", () => {
    // Current projection says weekdays, but history had weekends until June 15.
    const activity = makeActivity({ routine: "weekly:1,2,3,4,5" });
    const versions = [
      version({
        id: "v1",
        effective_from: "2026-06-01",
        routine: "weekly:0,6",
      }),
      version({
        id: "v2",
        effective_from: "2026-06-15",
        routine: "weekly:1,2,3,4,5",
        parent_version_id: "v1",
      }),
    ];

    // Saturday June 13: done under weekend schedule
    const entries = new Map<string, DailyEntry>([
      [
        "2026-06-13",
        {
          id: "e1",
          date: "2026-06-13",
          task_counts: { "act-1": 1 },
          paused_task_ids: null,
          is_break_day: null,
          current_activity_id: null,
          created_at: "2026-06-13T12:00:00.000Z",
          updated_at: "2026-06-13T12:00:00.000Z",
          synced_at: null,
          deleted_at: null,
        },
      ],
    ]);

    const map = buildActivityCompletionByDate(
      activity,
      entries,
      new Set(),
      new Date(2026, 5, 13),
      new Date(2026, 5, 15),
      { definitionVersions: versions }
    );

    expect(map["2026-06-13"]).toBe("done");
    // Monday June 15 under weekday schedule with no entry → missed
    expect(map["2026-06-15"]).toBe("missed");
    // Without versions, Saturday would be not_scheduled under current weekday routine
    const withoutVersions = buildActivityCompletionByDate(
      activity,
      entries,
      new Set(),
      new Date(2026, 5, 13),
      new Date(2026, 5, 13)
    );
    expect(withoutVersions["2026-06-13"]).toBe("not_scheduled");
  });
});
