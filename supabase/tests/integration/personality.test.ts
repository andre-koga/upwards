import { beforeAll, describe, expect, it } from "vitest";
import {
  createIsolatedUser,
  newId,
  pullOps,
  pullSnapshot,
  submitOps,
  type IsolatedUser,
  type SyncOpInput,
} from "./helpers";

const T0 = "2026-11-12T10:00:00.000Z";
const T1 = "2026-11-12T10:05:00.000Z";
const T2 = "2026-11-12T10:10:00.000Z";
const T3 = "2026-11-12T10:15:00.000Z";

const SCORES = {
  openness: 60,
  conscientiousness: 40,
  extraversion: 50,
  agreeableness: 70,
  neuroticism: 30,
};

function sittingOp(
  deviceId: string,
  id: string,
  row: Record<string, unknown>,
  base: string | null,
  operationId: string = newId()
): SyncOpInput {
  return {
    operation_id: operationId,
    device_id: deviceId,
    entity_type: "personality_sitting",
    entity_id: id,
    operation_type: "projection.upsert",
    payload: {
      row: {
        id,
        started_at: T0,
        completed_at: null,
        answers: {},
        scores: null,
        created_at: T0,
        updated_at: T0,
        deleted_at: null,
        ...row,
      },
    },
    base_revision: base,
  };
}

function readingOp(
  deviceId: string,
  id: string,
  row: Record<string, unknown>,
  base: string | null
): SyncOpInput {
  return {
    operation_id: newId(),
    device_id: deviceId,
    entity_type: "journal_reading",
    entity_id: id,
    operation_type: "projection.upsert",
    payload: {
      row: {
        id,
        scores: SCORES,
        notes: { openness: "Curious about people." },
        quotes: { openness: ["I asked a lot of questions"] },
        span_start: "2026-10-01",
        span_end: "2026-11-10",
        days_read: 12,
        created_at: T0,
        updated_at: T0,
        deleted_at: null,
        ...row,
      },
    },
    base_revision: base,
  };
}

describe("personality sittings", () => {
  let user: IsolatedUser;
  beforeAll(async () => {
    user = await createIsolatedUser();
  });

  it("accepts a sitting and its progress, and returns it in the snapshot", async () => {
    const id = newId();
    const [start] = await submitOps(user.deviceA, [
      sittingOp("a", id, {}, null),
    ]);
    const [answered] = await submitOps(user.deviceA, [
      sittingOp("a", id, { answers: { E1: 4 }, updated_at: T1 }, T0),
    ]);
    expect(start.status).toBe("accepted");
    expect(answered.status).toBe("accepted");

    const snapshot = await pullSnapshot(user.deviceB);
    const stored = (
      snapshot.personality_sittings as Array<Record<string, unknown>>
    ).find((row) => row.id === id);
    expect(stored?.answers).toEqual({ E1: 4 });
    expect(stored?.completed_at).toBeNull();
  });

  it("treats a replayed operation as a duplicate and stores one row", async () => {
    const id = newId();
    const operationId = newId();
    const first = sittingOp("a", id, {}, null, operationId);
    const [a] = await submitOps(user.deviceA, [first]);
    const [b] = await submitOps(user.deviceA, [first]);
    expect(a.status).toBe("accepted");
    expect(b.status).toBe("duplicate");
    expect(b.server_sequence).toBe(a.server_sequence);

    const snapshot = await pullSnapshot(user.deviceA);
    const matches = (
      snapshot.personality_sittings as Array<Record<string, unknown>>
    ).filter((row) => row.id === id);
    expect(matches).toHaveLength(1);
  });

  it("stores a finished sitting with its scores", async () => {
    const id = newId();
    await submitOps(user.deviceA, [sittingOp("a", id, {}, null)]);
    const [done] = await submitOps(user.deviceA, [
      sittingOp(
        "a",
        id,
        { completed_at: T2, scores: SCORES, updated_at: T2 },
        T0
      ),
    ]);
    expect(done.status).toBe("accepted");
    const snapshot = await pullSnapshot(user.deviceA);
    const stored = (
      snapshot.personality_sittings as Array<Record<string, unknown>>
    ).find((row) => row.id === id);
    expect(stored?.scores).toEqual(SCORES);
  });

  it("refuses a finished sitting with no scores", async () => {
    const id = newId();
    const [bad] = await submitOps(user.deviceA, [
      sittingOp("a", id, { completed_at: T1, scores: null }, null),
    ]);
    expect(bad.status).toBe("error");
  });

  it("flags a stale edit from another device and keeps the first", async () => {
    const id = newId();
    await submitOps(user.deviceA, [sittingOp("a", id, {}, null)]);
    await submitOps(user.deviceA, [
      sittingOp("a", id, { answers: { E1: 5 }, updated_at: T1 }, T0),
    ]);
    const [stale] = await submitOps(user.deviceB, [
      sittingOp("b", id, { answers: { E1: 1 }, updated_at: T2 }, T0),
    ]);
    expect(stale.status).toBe("conflict");
    const { data } = await user.deviceA
      .from("personality_sittings")
      .select("answers")
      .eq("id", id)
      .single();
    expect(data?.answers).toEqual({ E1: 5 });
  });

  it("accepts collapsed offline edits", async () => {
    const id = newId();
    await submitOps(user.deviceA, [sittingOp("a", id, {}, null)]);
    const [collapsed] = await submitOps(user.deviceA, [
      sittingOp("a", id, { answers: { E1: 3 }, updated_at: T3 }, T2),
    ]);
    expect(collapsed.status).toBe("accepted");
  });

  it("flags two devices that both start the same row from nothing", async () => {
    const id = newId();
    const [first] = await submitOps(user.deviceA, [
      sittingOp("a", id, {}, null),
    ]);
    const [second] = await submitOps(user.deviceB, [
      sittingOp("b", id, { answers: { E1: 2 } }, null),
    ]);
    expect(first.status).toBe("accepted");
    expect(second.status).toBe("conflict");
  });

  it("is readable by its owner and by nobody else", async () => {
    const id = newId();
    await submitOps(user.deviceA, [
      sittingOp("a", id, { answers: { E1: 4 } }, null),
    ]);
    const own = await user.deviceA
      .from("personality_sittings")
      .select("answers")
      .eq("id", id);
    expect(own.error).toBeNull();
    expect(own.data?.[0]?.answers).toEqual({ E1: 4 });

    const other = await createIsolatedUser();
    const theirs = await other.deviceA
      .from("personality_sittings")
      .select("*")
      .eq("id", id);
    expect(theirs.error).toBeNull();
    expect(theirs.data ?? []).toHaveLength(0);
  });

  it("refuses another account's row id instead of reporting it saved", async () => {
    const other = await createIsolatedUser();
    const id = newId();
    await submitOps(other.deviceA, [sittingOp("x", id, {}, null)]);
    const [attempt] = await submitOps(user.deviceA, [
      sittingOp("a", id, { answers: { E1: 1 }, updated_at: T1 }, T0),
    ]);
    expect(attempt.status).toBe("error");
  });

  it("is read-only through the API: the RPC is the only way to write", async () => {
    const id = newId();
    await submitOps(user.deviceA, [
      sittingOp("a", id, { answers: { E1: 4 } }, null),
    ]);
    const write = await user.deviceA
      .from("personality_sittings")
      .update({ answers: { E1: 1 } })
      .eq("id", id)
      .select();
    expect(write.error).not.toBeNull();
  });

  it("shows the operation to the other device", async () => {
    const id = newId();
    await submitOps(user.deviceA, [sittingOp("a", id, {}, null)]);
    const ops = await pullOps(user.deviceB, 0);
    expect(
      ops.some(
        (op) => op.entity_type === "personality_sitting" && op.entity_id === id
      )
    ).toBe(true);
  });
});

describe("journal readings", () => {
  let user: IsolatedUser;
  beforeAll(async () => {
    user = await createIsolatedUser();
  });

  it("accepts a reading and returns scores, notes, quotes and span", async () => {
    const id = newId();
    const [result] = await submitOps(user.deviceA, [
      readingOp("a", id, {}, null),
    ]);
    expect(result.status).toBe("accepted");

    const snapshot = await pullSnapshot(user.deviceB);
    const stored = (
      snapshot.journal_readings as Array<Record<string, unknown>>
    ).find((row) => row.id === id);
    expect(stored?.scores).toEqual(SCORES);
    expect(stored?.quotes).toEqual({
      openness: ["I asked a lot of questions"],
    });
    expect(stored?.span_start).toBe("2026-10-01");
    expect(stored?.days_read).toBe(12);
  });

  it("refuses a reading that claims more than 60 days", async () => {
    const [bad] = await submitOps(user.deviceA, [
      readingOp("a", newId(), { days_read: 61 }, null),
    ]);
    expect(bad.status).toBe("error");
  });

  it("flags a stale edit", async () => {
    const id = newId();
    await submitOps(user.deviceA, [readingOp("a", id, {}, null)]);
    await submitOps(user.deviceA, [
      readingOp("a", id, { deleted_at: T1, updated_at: T1 }, T0),
    ]);
    const [stale] = await submitOps(user.deviceB, [
      readingOp("b", id, { days_read: 3, updated_at: T2 }, T0),
    ]);
    expect(stale.status).toBe("conflict");
  });

  it("is readable by its owner and by nobody else", async () => {
    const id = newId();
    await submitOps(user.deviceA, [readingOp("a", id, {}, null)]);
    const other = await createIsolatedUser();
    const theirs = await other.deviceA
      .from("journal_readings")
      .select("*")
      .eq("id", id);
    expect(theirs.data ?? []).toHaveLength(0);
    const own = await user.deviceA
      .from("journal_readings")
      .select("id")
      .eq("id", id);
    expect(own.data).toHaveLength(1);
  });
});
