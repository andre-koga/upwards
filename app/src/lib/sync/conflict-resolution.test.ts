import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncIssue } from "@/lib/db/types";

const activities = new Map<
  string,
  {
    id: string;
    name: string | null;
    routine: string | null;
    completion_target: number | null;
    group_id: string;
    order_index: number | null;
    updated_at: string;
  }
>();
const activityGroups = new Map<
  string,
  {
    id: string;
    name: string;
    color: string | null;
    order_index: number | null;
    updated_at: string;
  }
>();
const activityVersions: Array<{
  id: string;
  activity_id: string;
  parent_version_id: string | null;
  effective_from: string;
  recorded_at: string;
  device_id: string;
  name: string | null;
  routine: string | null;
  completion_target: number | null;
  group_id: string;
  order_index: number | null;
  deleted_at: string | null;
}> = [];
const syncIssues: SyncIssue[] = [];

const { appendActivityMock, appendGroupMock } = vi.hoisted(() => ({
  appendActivityMock: vi.fn(async () => ({ id: "resolved-v1" })),
  appendGroupMock: vi.fn(async () => ({ id: "resolved-g1" })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    activities: {
      get: async (id: string) => activities.get(id),
      update: async (id: string, patch: Record<string, unknown>) => {
        const row = activities.get(id);
        if (row) Object.assign(row, patch);
      },
    },
    activityGroups: {
      get: async (id: string) => activityGroups.get(id),
      update: async (id: string, patch: Record<string, unknown>) => {
        const row = activityGroups.get(id);
        if (row) Object.assign(row, patch);
      },
    },
    activityDefinitionVersions: {
      get: async (id: string) =>
        activityVersions.find((row) => row.id === id) ?? undefined,
      where: (index: string) => ({
        equals: (value: string) => ({
          filter: (
            predicate: (row: (typeof activityVersions)[number]) => boolean
          ) => ({
            toArray: async () =>
              activityVersions.filter((row) => {
                if (index === "activity_id" && row.activity_id !== value) {
                  return false;
                }
                return predicate(row);
              }),
          }),
          toArray: async () =>
            activityVersions.filter((row) => {
              if (index === "activity_id") return row.activity_id === value;
              return true;
            }),
        }),
      }),
    },
    groupDefinitionVersions: {
      get: async () => undefined,
      where: () => ({
        equals: () => ({
          filter: () => ({ toArray: async () => [] }),
          toArray: async () => [],
        }),
      }),
    },
    syncIssues: {
      update: async (id: string, patch: Partial<SyncIssue>) => {
        const row = syncIssues.find((issue) => issue.id === id);
        if (row) Object.assign(row, patch);
      },
    },
  },
  now: () => "2026-08-01T12:00:00.000Z",
}));

vi.mock("@/lib/activity/definition-versions", () => ({
  appendActivityDefinitionVersion: appendActivityMock,
  appendGroupDefinitionVersion: appendGroupMock,
  getLatestActivityDefinitionVersion: async (activityId: string) => {
    const rows = activityVersions
      .filter((row) => row.activity_id === activityId && !row.deleted_at)
      .sort((a, b) => {
        const byEffective = b.effective_from.localeCompare(a.effective_from);
        if (byEffective !== 0) return byEffective;
        return b.recorded_at.localeCompare(a.recorded_at);
      });
    return rows[0] ?? null;
  },
  getLatestGroupDefinitionVersion: async () => null,
}));

vi.mock("@/lib/session/day-reset", () => ({
  getEffectiveToday: () => "2026-08-01",
}));

vi.mock("@/lib/sync/device-id", () => ({
  getOrCreateDeviceId: () => "device-local",
}));

vi.mock("@/lib/sync/sync-issues-store", () => ({
  deferSyncIssue: async (id: string) => {
    const row = syncIssues.find((issue) => issue.id === id);
    if (row) {
      row.status = "deferred";
      row.updated_at = "2026-08-01T12:00:00.000Z";
    }
  },
}));

import {
  analyzeDefinitionFieldDiffs,
  buildDefinitionConflictPayload,
  combineDefinitionFields,
  deferDefinitionConflict,
  isDefinitionConflictPayload,
  resolveDefinitionConflict,
  type DefinitionConflictPayload,
} from "./conflict-resolution";

function makeIssue(
  payload: DefinitionConflictPayload,
  overrides?: Partial<SyncIssue>
): SyncIssue {
  const issue: SyncIssue = {
    id: "issue-1",
    kind: "conflict",
    status: "open",
    account_id: null,
    title: "Conflict",
    detail: "Details",
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    operation_id: "op-1",
    payload,
    created_at: "2026-08-01T10:00:00.000Z",
    updated_at: "2026-08-01T10:00:00.000Z",
    resolved_at: null,
    ...overrides,
  };
  syncIssues.push(issue);
  return issue;
}

describe("analyzeDefinitionFieldDiffs", () => {
  it("marks one-side changes as auto-combinable when base is known", () => {
    const analysis = analyzeDefinitionFieldDiffs(
      { name: "Mine", routine: "daily", completion_target: 1 },
      { name: "Base", routine: "weekly:1", completion_target: 1 },
      { name: "Base", routine: "daily", completion_target: 1 }
    );

    expect(analysis.differing_fields).toEqual(["name", "routine"]);
    expect(analysis.auto_combinable_fields).toEqual(["name", "routine"]);
    expect(analysis.both_changed_fields).toEqual([]);
  });

  it("detects both-changed fields", () => {
    const analysis = analyzeDefinitionFieldDiffs(
      { name: "Mine", routine: "daily" },
      { name: "Theirs", routine: "never" },
      { name: "Base", routine: "daily" }
    );

    expect(analysis.both_changed_fields).toEqual(["name"]);
    expect(analysis.auto_combinable_fields).toEqual(["routine"]);
  });
});

describe("combineDefinitionFields", () => {
  it("takes each one-side change and prefers local on overlap", () => {
    const combined = combineDefinitionFields(
      { name: "Mine", routine: "daily", completion_target: 3 },
      { name: "Theirs", routine: "weekly:1", completion_target: 1 },
      { name: "Base", routine: "daily", completion_target: 1 },
      { preferLocalOnConflict: true }
    );

    expect(combined).toEqual({
      name: "Mine",
      routine: "weekly:1",
      completion_target: 3,
    });
  });
});

describe("isDefinitionConflictPayload", () => {
  it("accepts only definition_conflict payloads", () => {
    expect(isDefinitionConflictPayload({ kind: "definition_conflict" })).toBe(
      true
    );
    expect(isDefinitionConflictPayload({ kind: "other" })).toBe(false);
    expect(isDefinitionConflictPayload(null)).toBe(false);
  });
});

describe("buildDefinitionConflictPayload", () => {
  beforeEach(() => {
    activities.clear();
    activityVersions.length = 0;
    syncIssues.length = 0;
    activities.set("act-1", {
      id: "act-1",
      name: "Read",
      routine: "daily",
      completion_target: 1,
      group_id: "group-1",
      order_index: 0,
      updated_at: "2026-08-01T10:00:00.000Z",
    });
    activityVersions.push(
      {
        id: "v-base",
        activity_id: "act-1",
        parent_version_id: null,
        effective_from: "2026-07-01",
        recorded_at: "2026-07-01T10:00:00.000Z",
        device_id: "device-local",
        name: "Read",
        routine: "daily",
        completion_target: 1,
        group_id: "group-1",
        order_index: 0,
        deleted_at: null,
      },
      {
        id: "v-remote",
        activity_id: "act-1",
        parent_version_id: "v-base",
        effective_from: "2026-08-01",
        recorded_at: "2026-08-01T09:00:00.000Z",
        device_id: "device-other",
        name: "Read aloud",
        routine: "weekly:1",
        completion_target: 1,
        group_id: "group-1",
        order_index: 0,
        deleted_at: null,
      }
    );
  });

  it("uses remotePayload as theirs and local tip as yours", async () => {
    const payload = await buildDefinitionConflictPayload({
      entity_type: "activity_definition",
      entity_id: "act-1",
      remotePayload: {
        version_id: "v-conflict",
        parent_version_id: "v-base",
        effective_from: "2026-08-01",
        fields: {
          name: "Their name",
          routine: "never",
          completion_target: 2,
          group_id: "group-1",
          order_index: 0,
        },
      },
      remoteDeviceId: "device-other",
    });

    expect(payload.kind).toBe("definition_conflict");
    expect(payload.local.version_id).toBe("v-remote");
    expect(payload.remote?.fields.name).toBe("Their name");
    expect(payload.differing_fields).toContain("name");
    expect(payload.base?.version_id).toBe("v-base");
  });

  it("finds an alternate local version when push conflict omits remote", async () => {
    const payload = await buildDefinitionConflictPayload({
      entity_type: "activity_definition",
      entity_id: "act-1",
      localPayload: {
        version_id: "v-local",
        parent_version_id: "v-base",
        effective_from: "2026-08-01",
        fields: {
          name: "My edit",
          routine: "daily",
          completion_target: 1,
          group_id: "group-1",
          order_index: 0,
        },
      },
      localDeviceId: "device-local",
    });

    expect(payload.local.fields.name).toBe("My edit");
    expect(payload.remote?.version_id).toBe("v-remote");
    expect(payload.remote?.fields.name).toBe("Read aloud");
  });
});

describe("resolveDefinitionConflict", () => {
  beforeEach(() => {
    activities.clear();
    activityVersions.length = 0;
    syncIssues.length = 0;
    appendActivityMock.mockClear();
    appendGroupMock.mockClear();
    activities.set("act-1", {
      id: "act-1",
      name: "Read",
      routine: "daily",
      completion_target: 1,
      group_id: "group-1",
      order_index: 0,
      updated_at: "2026-08-01T10:00:00.000Z",
    });
  });

  it("keep_local appends a resolution version and marks resolved", async () => {
    const issue = makeIssue({
      kind: "definition_conflict",
      entity_type: "activity_definition",
      entity_id: "act-1",
      entity_label: "Read",
      local: {
        version_id: "v-local",
        parent_version_id: "v-base",
        device_id: "device-local",
        effective_from: "2026-08-01",
        fields: {
          name: "Mine",
          routine: "daily",
          completion_target: 1,
          group_id: "group-1",
          order_index: 0,
        },
      },
      remote: {
        version_id: "v-remote",
        parent_version_id: "v-base",
        device_id: "device-other",
        effective_from: "2026-08-01",
        fields: {
          name: "Theirs",
          routine: "never",
          completion_target: 1,
          group_id: "group-1",
          order_index: 0,
        },
      },
      base: null,
      differing_fields: ["name", "routine"],
      auto_combinable_fields: ["name", "routine"],
      both_changed_fields: [],
    });

    await resolveDefinitionConflict(issue, "keep_local");

    expect(appendActivityMock).toHaveBeenCalled();
    expect(syncIssues[0]?.status).toBe("resolved");
    expect(
      (syncIssues[0]?.payload as DefinitionConflictPayload).resolution?.choice
    ).toBe("keep_local");
    expect(activities.get("act-1")?.name).toBe("Mine");
  });

  it("combine merges non-overlapping field edits", async () => {
    const issue = makeIssue({
      kind: "definition_conflict",
      entity_type: "activity_definition",
      entity_id: "act-1",
      entity_label: "Read",
      local: {
        version_id: "v-local",
        parent_version_id: "v-base",
        device_id: "device-local",
        effective_from: "2026-08-01",
        fields: {
          name: "Mine",
          routine: "daily",
          completion_target: 1,
          group_id: "group-1",
          order_index: 0,
        },
      },
      remote: {
        version_id: "v-remote",
        parent_version_id: "v-base",
        device_id: "device-other",
        effective_from: "2026-08-01",
        fields: {
          name: "Base",
          routine: "weekly:1",
          completion_target: 1,
          group_id: "group-1",
          order_index: 0,
        },
      },
      base: {
        version_id: "v-base",
        parent_version_id: null,
        device_id: "device-local",
        effective_from: "2026-07-01",
        fields: {
          name: "Base",
          routine: "daily",
          completion_target: 1,
          group_id: "group-1",
          order_index: 0,
        },
      },
      differing_fields: ["name", "routine"],
      auto_combinable_fields: ["name", "routine"],
      both_changed_fields: [],
    });

    await resolveDefinitionConflict(issue, "combine");

    expect(activities.get("act-1")?.name).toBe("Mine");
    expect(activities.get("act-1")?.routine).toBe("weekly:1");
    expect(syncIssues[0]?.status).toBe("resolved");
  });

  it("defer marks the issue deferred without appending", async () => {
    const issue = makeIssue({
      kind: "definition_conflict",
      entity_type: "activity_definition",
      entity_id: "act-1",
      entity_label: "Read",
      local: {
        version_id: "v-local",
        parent_version_id: null,
        device_id: "device-local",
        effective_from: "2026-08-01",
        fields: { name: "Mine" },
      },
      remote: null,
      base: null,
      differing_fields: ["name"],
      auto_combinable_fields: [],
      both_changed_fields: [],
    });

    await deferDefinitionConflict(issue);

    expect(appendActivityMock).not.toHaveBeenCalled();
    expect(syncIssues[0]?.status).toBe("deferred");
  });
});
