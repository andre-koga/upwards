import { beforeEach, describe, expect, it } from "vitest";
import type { ActivityDefinitionVersion } from "@/lib/db/types";
import {
  activityLikeFromDefinition,
  pickDefinitionVersionAsOf,
} from "./definition-versions";
import { isRoutineDueOnDate } from "./utils";

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

function version(
  overrides: Partial<ActivityDefinitionVersion> &
    Pick<ActivityDefinitionVersion, "id" | "effective_from" | "routine">
): ActivityDefinitionVersion {
  return {
    id: overrides.id,
    activity_id: overrides.activity_id ?? "act-1",
    parent_version_id: overrides.parent_version_id ?? null,
    effective_from: overrides.effective_from,
    recorded_at:
      overrides.recorded_at ?? `${overrides.effective_from}T12:00:00.000Z`,
    server_sequence: null,
    operation_id: overrides.operation_id ?? `op-${overrides.id}`,
    device_id: "device-1",
    name: overrides.name ?? "Read",
    routine: overrides.routine,
    completion_target: overrides.completion_target ?? 1,
    group_id: overrides.group_id ?? "group-1",
    order_index: overrides.order_index ?? 0,
    schema_version: 1,
    created_at:
      overrides.created_at ?? `${overrides.effective_from}T12:00:00.000Z`,
    deleted_at: overrides.deleted_at ?? null,
  };
}

describe("pickDefinitionVersionAsOf", () => {
  it("returns null when no version is effective yet", () => {
    const versions = [
      version({ id: "v1", effective_from: "2026-06-10", routine: "daily" }),
    ];
    expect(pickDefinitionVersionAsOf(versions, "2026-06-09")).toBeNull();
  });

  it("picks the latest effective_from on or before the date", () => {
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
    expect(pickDefinitionVersionAsOf(versions, "2026-06-14")?.id).toBe("v1");
    expect(pickDefinitionVersionAsOf(versions, "2026-06-15")?.id).toBe("v2");
    expect(pickDefinitionVersionAsOf(versions, "2026-07-01")?.id).toBe("v2");
  });

  it("ignores soft-deleted versions", () => {
    const versions = [
      version({
        id: "v1",
        effective_from: "2026-06-01",
        routine: "daily",
      }),
      version({
        id: "v2",
        effective_from: "2026-06-10",
        routine: "never",
        deleted_at: "2026-06-11T00:00:00.000Z",
      }),
    ];
    expect(pickDefinitionVersionAsOf(versions, "2026-06-12")?.id).toBe("v1");
  });

  it("breaks ties with recorded_at", () => {
    const versions = [
      version({
        id: "older",
        effective_from: "2026-06-15",
        routine: "daily",
        recorded_at: "2026-06-15T10:00:00.000Z",
      }),
      version({
        id: "newer",
        effective_from: "2026-06-15",
        routine: "never",
        recorded_at: "2026-06-15T11:00:00.000Z",
      }),
    ];
    expect(pickDefinitionVersionAsOf(versions, "2026-06-15")?.id).toBe("newer");
  });
});

describe("historical scheduling via definition versions", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    localStorage.setItem("okhabit:day_reset_minutes", "0");
  });

  it("keeps weekend schedule on earlier days after a weekday change", () => {
    const weekend = version({
      id: "v1",
      effective_from: "2026-06-01",
      routine: "weekly:0,6",
    });
    const weekdays = version({
      id: "v2",
      effective_from: "2026-06-15",
      routine: "weekly:1,2,3,4,5",
      parent_version_id: "v1",
    });
    const versions = [weekend, weekdays];

    // Saturday June 13, 2026
    const saturday = new Date(2026, 5, 13);
    const saturdayDef = pickDefinitionVersionAsOf(versions, "2026-06-13");
    expect(saturdayDef?.id).toBe("v1");
    expect(
      isRoutineDueOnDate(activityLikeFromDefinition(saturdayDef!), saturday)
    ).toBe(true);

    // Monday June 15, 2026
    const monday = new Date(2026, 5, 15);
    const mondayDef = pickDefinitionVersionAsOf(versions, "2026-06-15");
    expect(mondayDef?.id).toBe("v2");
    expect(
      isRoutineDueOnDate(activityLikeFromDefinition(mondayDef!), monday)
    ).toBe(true);
    // Saturday after the change should not use the old weekend routine
    const laterSaturday = new Date(2026, 5, 20);
    const laterDef = pickDefinitionVersionAsOf(versions, "2026-06-20");
    expect(
      isRoutineDueOnDate(activityLikeFromDefinition(laterDef!), laterSaturday)
    ).toBe(false);
  });
});
