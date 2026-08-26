import { beforeAll, describe, expect, it } from "vitest";
import {
  countDeltaOp,
  createIsolatedUser,
  loadSupabaseEnv,
  newId,
  projectionUpsertOp,
  pullOps,
  pullSnapshot,
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

  it("applies complete then uncomplete through count ops only", async () => {
    const activityId = newId();
    const date = "2026-08-26";

    const increment = countDeltaOp({
      deviceId: DEVICE_A,
      activityId,
      date,
      delta: 1,
      previousCount: 0,
      nextCount: 1,
    });
    const decrement = countDeltaOp({
      deviceId: DEVICE_A,
      activityId,
      date,
      delta: -1,
      previousCount: 1,
      nextCount: 0,
    });

    expect((await submitOps(user.deviceA, [increment]))[0]?.status).toBe(
      "accepted"
    );
    expect((await submitOps(user.deviceA, [decrement]))[0]?.status).toBe(
      "accepted"
    );

    const { data: after, error } = await user.deviceB
      .from("daily_entries")
      .select("task_counts")
      .eq("date", date)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    expect(after?.task_counts?.[activityId] ?? 0).toBe(0);

    const pulled = await pullOps(user.deviceB, 0);
    const countOps = pulled.filter(
      (op) =>
        op.operation_type === "count.delta" &&
        (op.payload as { activity_id?: string }).activity_id === activityId
    );
    expect(countOps).toHaveLength(2);
    expect(
      pulled.some(
        (op) =>
          op.entity_type === "activity_period" &&
          (op.payload as { row?: { activity_id?: string } }).row
            ?.activity_id === activityId
      )
    ).toBe(false);
  });

  it("collapses two journal ids for the same date onto one row", async () => {
    const date = "2026-08-27";
    const idA = newId();
    const idB = newId();

    const createdA = await submitOps(user.deviceA, [
      projectionUpsertOp({
        deviceId: DEVICE_A,
        entityType: "journal_entry",
        entityId: idA,
        row: {
          entry_date: date,
          title: "A",
          text_content: "First device",
          created_at: "2026-08-27T12:00:00.000Z",
          updated_at: "2026-08-27T12:00:00.000Z",
        },
      }),
    ]);
    expect(createdA[0]?.status).toBe("accepted");

    const createdB = await submitOps(user.deviceB, [
      projectionUpsertOp({
        deviceId: DEVICE_B,
        entityType: "journal_entry",
        entityId: idB,
        row: {
          entry_date: date,
          title: "A",
          text_content: "First device",
          created_at: "2026-08-27T12:00:00.000Z",
          updated_at: "2026-08-27T12:00:00.000Z",
        },
      }),
    ]);
    expect(createdB[0]?.status).toBe("accepted");

    const { data: rows, error } = await user.deviceA
      .from("journal_entries")
      .select("id, text_content")
      .eq("entry_date", date);
    if (error) throw error;
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.text_content).toBe("First device");
  });

  it("ignores untimed period upserts so they cannot re-enter as facts", async () => {
    const periodId = newId();
    const activityId = newId();
    const dailyId = newId();

    const result = await submitOps(user.deviceA, [
      projectionUpsertOp({
        deviceId: DEVICE_A,
        entityType: "activity_period",
        entityId: periodId,
        row: {
          daily_entry_id: dailyId,
          activity_id: activityId,
          start_time: "2026-08-25T15:00:00.000Z",
          end_time: "2026-08-25T15:00:00.000Z",
          created_at: "2026-08-25T15:00:00.000Z",
          updated_at: "2026-08-25T15:00:00.000Z",
        },
      }),
    ]);
    expect(result[0]?.status).toBe("accepted");

    const { data: period, error } = await user.deviceA
      .from("activity_periods")
      .select("id")
      .eq("id", periodId)
      .maybeSingle();
    if (error) throw error;
    expect(period).toBeNull();
  });

  it("applies a timed period by creating missing daily_entry and activity shells", async () => {
    const periodId = newId();
    const activityId = newId();
    const dailyId = newId();

    const result = await submitOps(user.deviceA, [
      projectionUpsertOp({
        deviceId: DEVICE_A,
        entityType: "activity_period",
        entityId: periodId,
        row: {
          daily_entry_id: dailyId,
          activity_id: activityId,
          start_time: "2026-08-25T15:00:00.000Z",
          end_time: "2026-08-25T15:30:00.000Z",
          created_at: "2026-08-25T15:00:00.000Z",
          updated_at: "2026-08-25T15:30:00.000Z",
        },
      }),
    ]);
    expect(result[0]?.status).toBe("accepted");

    const { data: period, error: periodError } = await user.deviceA
      .from("activity_periods")
      .select("id, daily_entry_id, activity_id")
      .eq("id", periodId)
      .maybeSingle();
    if (periodError) throw periodError;
    expect(period?.activity_id).toBe(activityId);

    const { data: daily, error: dailyError } = await user.deviceA
      .from("daily_entries")
      .select("id, date")
      .eq("id", period?.daily_entry_id)
      .maybeSingle();
    if (dailyError) throw dailyError;
    expect(daily).not.toBeNull();
  });

  it("returns error for a bad op without aborting the rest of the batch", async () => {
    const goodId = newId();
    const badPeriodId = newId();
    const results = await submitOps(user.deviceA, [
      projectionUpsertOp({
        deviceId: DEVICE_A,
        entityType: "activity",
        entityId: goodId,
        row: {
          name: "Keep me",
          routine: "daily",
          created_at: "2026-08-25T10:00:00.000Z",
          updated_at: "2026-08-25T10:00:00.000Z",
        },
      }),
      {
        operation_id: newId(),
        device_id: DEVICE_A,
        entity_type: "activity_period",
        entity_id: badPeriodId,
        operation_type: "projection.upsert",
        payload: {
          row: {
            daily_entry_id: "not-a-uuid",
            activity_id: goodId,
            start_time: "2026-08-25T15:00:00.000Z",
            end_time: "2026-08-25T15:30:00.000Z",
          },
        },
      },
    ]);
    expect(results.map((row) => row.status).sort()).toEqual([
      "accepted",
      "error",
    ]);
    const { data: activity, error } = await user.deviceA
      .from("activities")
      .select("id")
      .eq("id", goodId)
      .maybeSingle();
    if (error) throw error;
    expect(activity?.id).toBe(goodId);
  });

  it("returns a snapshot of current projections for bootstrap", async () => {
    const activityId = newId();
    const accepted = await submitOps(user.deviceA, [
      projectionUpsertOp({
        deviceId: DEVICE_A,
        entityType: "activity",
        entityId: activityId,
        row: {
          name: "Snapshot habit",
          routine: "daily",
          completion_target: 1,
          created_at: "2026-08-25T10:00:00.000Z",
          updated_at: "2026-08-25T10:00:00.000Z",
        },
      }),
    ]);
    expect(accepted[0]?.status).toBe("accepted");

    const snapshot = await pullSnapshot(user.deviceB);
    expect(typeof snapshot.server_sequence).toBe("number");
    expect(snapshot.server_sequence).toBeGreaterThan(0);
    const activities = snapshot.activities as Array<{ id: string; name: string }>;
    expect(activities.some((row) => row.id === activityId)).toBe(true);
    expect(Array.isArray(snapshot.daily_entries)).toBe(true);
    expect(Array.isArray(snapshot.activity_periods)).toBe(true);
  });
});
