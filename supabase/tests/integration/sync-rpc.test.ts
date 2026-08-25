import { beforeAll, describe, expect, it } from "vitest";
import {
  countDeltaOp,
  createIsolatedUser,
  loadSupabaseEnv,
  newId,
  projectionUpsertOp,
  pullOps,
  submitOps,
  type IsolatedUser,
} from "./helpers";

const DATE = "2026-08-25";
const DEVICE_A = "device-a";
const DEVICE_B = "device-b";

describe("sync RPC integration", () => {
  let user: IsolatedUser;

  beforeAll(async () => {
    loadSupabaseEnv();
    user = await createIsolatedUser();
  });

  it("applies two-device count increments without dropping either", async () => {
    const activityId = newId();
    const fromA = countDeltaOp({
      deviceId: DEVICE_A,
      activityId,
      date: DATE,
      delta: 1,
      previousCount: 0,
      nextCount: 1,
    });
    const fromB = countDeltaOp({
      deviceId: DEVICE_B,
      activityId,
      date: DATE,
      delta: 1,
      previousCount: 0,
      nextCount: 1,
    });

    const acceptedA = await submitOps(user.deviceA, [fromA]);
    const acceptedB = await submitOps(user.deviceB, [fromB]);
    expect(acceptedA[0]?.status).toBe("accepted");
    expect(acceptedB[0]?.status).toBe("accepted");

    const { data: entries, error } = await user.deviceB
      .from("daily_entries")
      .select("task_counts")
      .eq("date", DATE)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    expect(entries?.task_counts?.[activityId]).toBe(2);

    const pulled = await pullOps(user.deviceB, 0);
    const countOps = pulled.filter(
      (op) =>
        op.operation_type === "count.delta" &&
        op.payload.activity_id === activityId
    );
    expect(countOps).toHaveLength(2);
    expect(countOps.map((op) => op.device_id).sort()).toEqual([
      DEVICE_A,
      DEVICE_B,
    ]);
  });

  it("acks a lost-response retry without applying the count twice", async () => {
    const activityId = newId();
    const op = countDeltaOp({
      deviceId: DEVICE_A,
      activityId,
      date: DATE,
      delta: 1,
      previousCount: 0,
      nextCount: 1,
    });

    const first = await submitOps(user.deviceA, [op]);
    const retry = await submitOps(user.deviceA, [op]);
    expect(first[0]?.status).toBe("accepted");
    expect(retry[0]?.status).toBe("duplicate");
    expect(retry[0]?.server_sequence).toBe(first[0]?.server_sequence);

    const { data: entries, error } = await user.deviceA
      .from("daily_entries")
      .select("task_counts")
      .eq("date", DATE)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    expect(entries?.task_counts?.[activityId]).toBe(1);
  });

  it("keeps concurrent journal texts reviewable instead of last-write-wins", async () => {
    const journalId = newId();
    const textA = "Device A journal body";
    const textB = "Device B journal body";

    const createA = projectionUpsertOp({
      deviceId: DEVICE_A,
      entityType: "journal_entry",
      entityId: journalId,
      row: {
        entry_date: DATE,
        title: "A",
        text_content: textA,
        created_at: "2026-08-25T12:00:00.000Z",
        updated_at: "2026-08-25T12:00:00.000Z",
      },
    });
    const createResults = await submitOps(user.deviceA, [createA]);
    expect(createResults[0]?.status).toBe("accepted");

    const conflictB = projectionUpsertOp({
      deviceId: DEVICE_B,
      entityType: "journal_entry",
      entityId: journalId,
      baseRevision: "2000-01-01T00:00:00.000Z",
      row: {
        entry_date: DATE,
        title: "B",
        text_content: textB,
        created_at: "2026-08-25T12:00:00.000Z",
        updated_at: "2026-08-25T13:00:00.000Z",
      },
    });
    const conflictResults = await submitOps(user.deviceB, [conflictB]);
    expect(conflictResults[0]?.status).toBe("conflict");

    const { data: row, error } = await user.deviceA
      .from("journal_entries")
      .select("text_content, title")
      .eq("id", journalId)
      .maybeSingle();
    if (error) throw error;
    expect(row?.text_content).toBe(textA);
    expect(row?.title).toBe("A");

    const pulled = await pullOps(user.deviceB, 0);
    const journalOps = pulled.filter(
      (op) => op.entity_type === "journal_entry" && op.entity_id === journalId
    );
    const payloads = journalOps.map((op) => {
      const payload = op.payload as { row?: { text_content?: string } };
      return payload.row?.text_content;
    });
    expect(payloads).toContain(textA);
    expect(payloads).toContain(textB);
  });

  it("exposes count-down and period tombstone ops to the other device", async () => {
    const activityId = newId();
    const periodId = newId();

    const activity = projectionUpsertOp({
      deviceId: DEVICE_A,
      entityType: "activity",
      entityId: activityId,
      row: {
        name: "Integration habit",
        routine: "daily",
        completion_target: 1,
        created_at: "2026-08-25T10:00:00.000Z",
        updated_at: "2026-08-25T10:00:00.000Z",
      },
    });
    const createdActivity = await submitOps(user.deviceA, [activity]);
    expect(createdActivity[0]?.status).toBe("accepted");

    const increment = countDeltaOp({
      deviceId: DEVICE_A,
      activityId,
      date: DATE,
      delta: 1,
      previousCount: 0,
      nextCount: 1,
    });
    const incremented = await submitOps(user.deviceA, [increment]);
    expect(incremented[0]?.status).toBe("accepted");

    const { data: entry, error: entryError } = await user.deviceA
      .from("daily_entries")
      .select("id, task_counts")
      .eq("date", DATE)
      .is("deleted_at", null)
      .maybeSingle();
    if (entryError) throw entryError;
    expect(entry?.id).toBeTruthy();
    expect(entry?.task_counts?.[activityId]).toBe(1);

    const periodCreate = projectionUpsertOp({
      deviceId: DEVICE_A,
      entityType: "activity_period",
      entityId: periodId,
      row: {
        daily_entry_id: entry!.id,
        activity_id: activityId,
        start_time: "2026-08-25T15:00:00.000Z",
        end_time: "2026-08-25T15:00:00.000Z",
        created_at: "2026-08-25T15:00:00.000Z",
        updated_at: "2026-08-25T15:00:00.000Z",
      },
    });
    const createdPeriod = await submitOps(user.deviceA, [periodCreate]);
    expect(createdPeriod[0]?.status).toBe("accepted");

    const decrement = countDeltaOp({
      deviceId: DEVICE_A,
      activityId,
      date: DATE,
      delta: -1,
      previousCount: 1,
      nextCount: 0,
    });
    const tombstone = projectionUpsertOp({
      deviceId: DEVICE_A,
      entityType: "activity_period",
      entityId: periodId,
      row: {
        daily_entry_id: entry!.id,
        activity_id: activityId,
        start_time: "2026-08-25T15:00:00.000Z",
        end_time: "2026-08-25T15:00:00.000Z",
        deleted_at: "2026-08-25T15:01:00.000Z",
        updated_at: "2026-08-25T15:01:00.000Z",
      },
    });
    const afterDown = await submitOps(user.deviceA, [decrement, tombstone]);
    expect(afterDown.map((row) => row.status)).toEqual(["accepted", "accepted"]);

    const pulled = await pullOps(user.deviceB, 0);
    const relevant = pulled.filter(
      (op) =>
        op.entity_id === activityId ||
        op.entity_id === periodId ||
        (op.payload as { activity_id?: string }).activity_id === activityId
    );
    const types = relevant.map((op) => `${op.entity_type}:${op.operation_type}`);
    expect(types).toContain("daily_entry:count.delta");
    expect(types.filter((type) => type === "daily_entry:count.delta")).toHaveLength(
      2
    );
    expect(types).toContain("activity_period:projection.upsert");

    const tombstoneOp = relevant.find(
      (op) =>
        op.entity_type === "activity_period" &&
        op.entity_id === periodId &&
        Boolean(
          (op.payload as { row?: { deleted_at?: string } }).row?.deleted_at
        )
    );
    expect(tombstoneOp).toBeTruthy();

    const { data: after, error: afterError } = await user.deviceB
      .from("daily_entries")
      .select("task_counts")
      .eq("id", entry!.id)
      .maybeSingle();
    if (afterError) throw afterError;
    expect(after?.task_counts?.[activityId] ?? 0).toBe(0);

    const { data: period, error: periodError } = await user.deviceB
      .from("activity_periods")
      .select("deleted_at")
      .eq("id", periodId)
      .maybeSingle();
    if (periodError) throw periodError;
    expect(period?.deleted_at).toBeTruthy();
  });
});
