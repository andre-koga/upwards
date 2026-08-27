import { describe, expect, it } from "vitest";
import type {
  Activity,
  ActivityStatusEvent,
  GroupStatusEvent,
} from "@/lib/db/types";
import {
  buildActivityEventsByEntityId,
  effectiveAtForStatusOn,
  isActivityStatusAsOf,
  isGroupStatusAsOf,
} from "./status-events";

function localDay(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function activityEvent(
  overrides: Partial<ActivityStatusEvent> &
    Pick<
      ActivityStatusEvent,
      "status_type" | "next_value" | "effective_at" | "created_at"
    >
): ActivityStatusEvent {
  return {
    id: overrides.id ?? "evt-1",
    entity_id: overrides.entity_id ?? "act-1",
    status_type: overrides.status_type,
    next_value: overrides.next_value,
    effective_at: overrides.effective_at,
    created_at: overrides.created_at,
    updated_at: overrides.updated_at ?? overrides.created_at,
    synced_at: null,
    deleted_at: overrides.deleted_at ?? null,
  };
}

describe("effectiveAtForStatusOn", () => {
  it("hides completed/archived from the next day, deleted from the action day", () => {
    const day = localDay(2026, 6, 15);
    const completedAt = effectiveAtForStatusOn(day, true, "completed");
    const deletedAt = effectiveAtForStatusOn(day, true, "deleted");
    const uncompleteAt = effectiveAtForStatusOn(day, false, "completed");

    expect(new Date(completedAt).getDate()).toBe(16);
    expect(new Date(deletedAt).getDate()).toBe(15);
    expect(new Date(uncompleteAt).getDate()).toBe(15);
  });
});

describe("isActivityStatusAsOf", () => {
  it("lets a same-day undo win via created_at ordering", () => {
    const day = localDay(2026, 6, 15);
    const complete = activityEvent({
      id: "complete",
      status_type: "completed",
      next_value: true,
      // completed becomes effective tomorrow
      effective_at: effectiveAtForStatusOn(day, true, "completed"),
      created_at: "2026-06-15T10:00:00.000Z",
    });
    const undo = activityEvent({
      id: "undo",
      status_type: "completed",
      next_value: false,
      effective_at: effectiveAtForStatusOn(day, false, "completed"),
      created_at: "2026-06-15T11:00:00.000Z",
    });

    // On the action day, completed has not taken effect yet.
    expect(isActivityStatusAsOf([complete], "completed", day)).toBe(false);
    // On the next day, without undo, completed applies.
    expect(
      isActivityStatusAsOf([complete], "completed", localDay(2026, 6, 16))
    ).toBe(true);
    // With undo written later the same day, completed should not stick.
    expect(
      isActivityStatusAsOf([complete, undo], "completed", localDay(2026, 6, 16))
    ).toBe(false);
  });

  it("treats archived events like completed for visibility", () => {
    const day = localDay(2026, 6, 15);
    const archived = activityEvent({
      id: "archived",
      status_type: "archived",
      next_value: true,
      effective_at: effectiveAtForStatusOn(day, true, "archived"),
      created_at: "2026-06-15T10:00:00.000Z",
    });
    expect(isActivityStatusAsOf([archived], "archived", day)).toBe(false);
    expect(
      isActivityStatusAsOf([archived], "archived", localDay(2026, 6, 16))
    ).toBe(true);
    expect(
      isActivityStatusAsOf([archived], "completed", localDay(2026, 6, 16))
    ).toBe(true);
  });
  it("falls back to legacy completed_at / deleted_at columns", () => {
    const legacy: Activity = {
      id: "act-1",
      group_id: "g",
      name: "Read",
      routine: "daily",
      completion_target: 1,
      is_archived: false,
      completed_at: "2026-06-15T18:00:00.000Z",
      order_index: 0,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-06-15T18:00:00.000Z",
      synced_at: null,
      deleted_at: null,
    };
    expect(
      isActivityStatusAsOf([], "completed", localDay(2026, 6, 15), legacy)
    ).toBe(false);
    expect(
      isActivityStatusAsOf([], "completed", localDay(2026, 6, 16), legacy)
    ).toBe(true);
  });

  it("ignores soft-deleted events", () => {
    const day = localDay(2026, 6, 16);
    const deletedEvent = activityEvent({
      status_type: "completed",
      next_value: true,
      effective_at: effectiveAtForStatusOn(
        localDay(2026, 6, 15),
        true,
        "completed"
      ),
      created_at: "2026-06-15T10:00:00.000Z",
      deleted_at: "2026-06-15T12:00:00.000Z",
    });
    expect(isActivityStatusAsOf([deletedEvent], "completed", day)).toBe(false);
  });
});

describe("isGroupStatusAsOf / buildActivityEventsByEntityId", () => {
  it("uses legacy archived flag from the day after the reference", () => {
    const group = {
      id: "g1",
      name: "Health",
      emoji: null,
      color: "#000",
      order_index: 0,
      is_archived: true,
      created_at: "2026-06-10T00:00:00.000Z",
      // Use local noon (not UTC midnight) so this fixture means "June 15
      // local" regardless of the machine's UTC offset.
      updated_at: localDay(2026, 6, 15).toISOString(),
      synced_at: null,
      deleted_at: null,
    };
    expect(
      isGroupStatusAsOf([], "archived", localDay(2026, 6, 15), group)
    ).toBe(false);
    expect(
      isGroupStatusAsOf([], "archived", localDay(2026, 6, 16), group)
    ).toBe(true);
  });

  it("groups events by entity id", () => {
    const events: ActivityStatusEvent[] = [
      activityEvent({
        id: "1",
        entity_id: "a",
        status_type: "completed",
        next_value: true,
        effective_at: "2026-06-16T00:00:00.000Z",
        created_at: "2026-06-15T10:00:00.000Z",
      }),
      activityEvent({
        id: "2",
        entity_id: "b",
        status_type: "deleted",
        next_value: true,
        effective_at: "2026-06-15T00:00:00.000Z",
        created_at: "2026-06-15T11:00:00.000Z",
      }),
      activityEvent({
        id: "3",
        entity_id: "a",
        status_type: "completed",
        next_value: false,
        effective_at: "2026-06-15T00:00:00.000Z",
        created_at: "2026-06-15T12:00:00.000Z",
      }),
    ];
    const map = buildActivityEventsByEntityId(events);
    expect(map.get("a")).toHaveLength(2);
    expect(map.get("b")).toHaveLength(1);
  });

  it("applies group status events", () => {
    const archived: GroupStatusEvent = {
      id: "ge-1",
      entity_id: "g1",
      status_type: "archived",
      next_value: true,
      effective_at: effectiveAtForStatusOn(
        localDay(2026, 6, 15),
        true,
        "archived"
      ),
      created_at: "2026-06-15T10:00:00.000Z",
      updated_at: "2026-06-15T10:00:00.000Z",
      synced_at: null,
      deleted_at: null,
    };
    expect(
      isGroupStatusAsOf([archived], "archived", localDay(2026, 6, 15))
    ).toBe(false);
    expect(
      isGroupStatusAsOf([archived], "archived", localDay(2026, 6, 16))
    ).toBe(true);
  });
});
