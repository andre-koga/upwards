import { beforeAll, describe, expect, it } from "vitest";
import {
  CLIENT_PROTOCOL,
  createIsolatedUser,
  newId,
  pullOps,
  pullSnapshot,
  submitOps,
  type IsolatedUser,
  type SyncOpInput,
} from "./helpers";

type Row = Record<string, unknown>;

const T0 = "2026-10-19T10:00:00.000Z";
const T1 = "2026-10-19T10:05:00.000Z";
const T2 = "2026-10-19T10:06:00.000Z";

function itemRow(id: string, patch: Row = {}): Row {
  return {
    id,
    kind: "goal",
    text: "Walk every day",
    question: null,
    activity_id: null,
    group_id: null,
    created_at: T0,
    updated_at: T0,
    archived_at: null,
    deleted_at: null,
    ...patch,
  };
}

function itemOp(
  device: string,
  id: string,
  patch: Row = {},
  base: string | null = null,
): SyncOpInput {
  return {
    operation_id: newId(),
    device_id: device,
    entity_type: "compass_item",
    entity_id: id,
    operation_type: "projection.upsert",
    payload: { row: itemRow(id, patch) },
    base_revision: base,
  };
}

async function stored(
  user: IsolatedUser,
  id: string,
): Promise<Row | undefined> {
  const snapshot = await pullSnapshot(user.deviceA);
  return (snapshot.compass_items as Row[]).find((row) => row.id === id);
}

describe("compass items", () => {
  let user: IsolatedUser;

  beforeAll(async () => {
    user = await createIsolatedUser();
  });

  it("stores an item and returns it in the snapshot on another device", async () => {
    const id = newId();
    const [result] = await submitOps(user.deviceA, [itemOp("a", id)]);
    expect(result.status).toBe("accepted");
    const snapshot = await pullSnapshot(user.deviceB);
    const row = (snapshot.compass_items as Row[]).find((r) => r.id === id);
    expect(row).toMatchObject({ kind: "goal", text: "Walk every day" });
  });

  it("applies an edit made against the current version", async () => {
    const id = newId();
    await submitOps(user.deviceA, [itemOp("a", id)]);
    const [edit] = await submitOps(user.deviceA, [
      itemOp("a", id, { text: "Walk every morning", updated_at: T1 }, T0),
    ]);
    expect(edit.status).toBe("accepted");
    expect((await stored(user, id))?.text).toBe("Walk every morning");
  });

  it("flags a stale edit on the same day as a conflict and keeps the first", async () => {
    // The check compares real timestamps. Compared as text, a same-day edit
    // slipped through (or every edit conflicted), depending on the branch.
    const id = newId();
    await submitOps(user.deviceA, [itemOp("a", id)]);
    await submitOps(user.deviceA, [
      itemOp("a", id, { text: "From A", updated_at: T1 }, T0),
    ]);
    const [stale] = await submitOps(user.deviceB, [
      itemOp("b", id, { text: "From B", updated_at: T2 }, T0),
    ]);
    expect(stale.status).toBe("conflict");
    expect((await stored(user, id))?.text).toBe("From A");
  });

  it("accepts offline edits collapsed into one, whose base is the device's own earlier edit", async () => {
    // The client keeps only the newest of several pending edits, and that edit's
    // base is the previous local edit (T1), which the server has never seen.
    // The server holds T0, older than the base, so the edit is not stale.
    const id = newId();
    await submitOps(user.deviceA, [itemOp("a", id)]);
    const [collapsed] = await submitOps(user.deviceA, [
      itemOp("a", id, { text: "After two offline edits", updated_at: T2 }, T1),
    ]);
    expect(collapsed.status).toBe("accepted");
    expect((await stored(user, id))?.text).toBe("After two offline edits");
  });

  it("never lets a second create of the same row overwrite the first", async () => {
    // The north star has one id on every device, so two devices that write it
    // offline both arrive with no base revision.
    const id = newId();
    const [first] = await submitOps(user.deviceA, [
      itemOp("a", id, { kind: "north_star", text: "Finish what I start" }),
    ]);
    const [second] = await submitOps(user.deviceB, [
      itemOp("b", id, { kind: "north_star", text: "Rest without guilt" }),
    ]);
    expect(first.status).toBe("accepted");
    expect(second.status).toBe("conflict");
    expect((await stored(user, id))?.text).toBe("Finish what I start");
  });

  it("keeps a conflicting operation in the log so the other device can see it", async () => {
    const id = newId();
    await submitOps(user.deviceA, [itemOp("a", id)]);
    const [conflict] = await submitOps(user.deviceB, [
      itemOp("b", id, { text: "Elsewhere" }),
    ]);
    const ops = await pullOps(user.deviceA, 0);
    const logged = ops.find((op) => op.operation_id === conflict.operation_id);
    expect(logged).toMatchObject({
      entity_type: "compass_item",
      status: "conflict",
    });
  });

  it("treats a replayed operation as a duplicate and stores one row", async () => {
    const id = newId();
    const op = itemOp("a", id);
    const [first] = await submitOps(user.deviceA, [op]);
    const [second] = await submitOps(user.deviceA, [op]);
    expect(first.status).toBe("accepted");
    expect(second.status).toBe("duplicate");
    expect(second.server_sequence).toBe(first.server_sequence);
    const snapshot = await pullSnapshot(user.deviceA);
    expect(
      (snapshot.compass_items as Row[]).filter((r) => r.id === id),
    ).toHaveLength(1);
  });

  it("merges two devices' new goals by union", async () => {
    const fromA = newId();
    const fromB = newId();
    await Promise.all([
      submitOps(user.deviceA, [itemOp("a", fromA, { text: "From A" })]),
      submitOps(user.deviceB, [itemOp("b", fromB, { text: "From B" })]),
    ]);
    for (const device of [user.deviceA, user.deviceB]) {
      const snapshot = await pullSnapshot(device);
      const ids = (snapshot.compass_items as Row[]).map((r) => r.id);
      expect(ids).toEqual(expect.arrayContaining([fromA, fromB]));
    }
  });

  it("carries set-aside and deleted rows, words included, so they can be restored", async () => {
    const aside = newId();
    const gone = newId();
    await submitOps(user.deviceA, [
      itemOp("a", aside, { archived_at: T1, updated_at: T1 }),
      itemOp("a", gone, { deleted_at: T1, updated_at: T1 }),
    ]);
    expect(await stored(user, aside)).toMatchObject({ text: "Walk every day" });
    expect((await stored(user, aside))?.archived_at).not.toBeNull();
    expect(await stored(user, gone)).toMatchObject({ text: "Walk every day" });
    expect((await stored(user, gone))?.deleted_at).not.toBeNull();
    const [restore] = await submitOps(user.deviceA, [
      itemOp("a", gone, { deleted_at: null, updated_at: T2 }, T1),
    ]);
    expect(restore.status).toBe("accepted");
    expect((await stored(user, gone))?.deleted_at).toBeNull();
  });

  it("allows one north star per person even under a different id", async () => {
    const solo = await createIsolatedUser();
    const [a] = await submitOps(solo.deviceA, [
      itemOp("a", newId(), { kind: "north_star", text: "One" }),
    ]);
    const [b] = await submitOps(solo.deviceA, [
      itemOp("a", newId(), { kind: "north_star", text: "Two" }),
    ]);
    expect(a.status).toBe("accepted");
    expect(b.status).toBe("error");
    const snapshot = await pullSnapshot(solo.deviceA);
    expect(
      (snapshot.compass_items as Row[]).filter((r) => r.kind === "north_star"),
    ).toHaveLength(1);
  });

  describe("limits", () => {
    const cases: Array<[string, Row]> = [
      ["an empty text", { text: "   " }],
      ["a goal over 120 characters", { text: "x".repeat(121) }],
      ["an identity word over 40", { kind: "identity", text: "x".repeat(41) }],
      ["a north star over 200", { kind: "north_star", text: "x".repeat(201) }],
      [
        "a knowledge answer over 1000",
        { kind: "knowledge", text: "x".repeat(1001) },
      ],
      ["a question on something that is not knowledge", { question: "Why?" }],
      [
        "a knowledge question over 200",
        { kind: "knowledge", question: "x".repeat(201) },
      ],
      [
        "a link on something that is not a goal",
        { kind: "identity", text: "Patient", activity_id: newId() },
      ],
      [
        "both an activity and a group link",
        { activity_id: newId(), group_id: newId() },
      ],
      ["a kind that does not exist", { kind: "mood" }],
    ];
    for (const [name, patch] of cases) {
      it(`rejects ${name}`, async () => {
        const id = newId();
        const [result] = await submitOps(user.deviceA, [
          itemOp("a", id, patch),
        ]);
        expect(result.status).toBe("error");
        expect(await stored(user, id)).toBeUndefined();
      });
    }

    it("accepts text exactly at each limit", async () => {
      const rows: Row[] = [
        { kind: "north_star", text: "x".repeat(200) },
        { kind: "identity", text: "x".repeat(40) },
        { kind: "goal", text: "x".repeat(120) },
        {
          kind: "knowledge",
          text: "x".repeat(1000),
          question: "q".repeat(200),
        },
      ];
      // The north star is unique per person, so use a fresh account for it.
      const fresh = await createIsolatedUser();
      for (const patch of rows) {
        const [result] = await submitOps(fresh.deviceA, [
          itemOp("a", newId(), patch),
        ]);
        expect(result.status).toBe("accepted");
      }
    });
  });

  it("keeps one person's compass from another, by read and by write", async () => {
    const other = await createIsolatedUser();
    const id = newId();
    await submitOps(other.deviceA, [itemOp("x", id, { text: "Private" })]);

    expect(await stored(user, id)).toBeUndefined();
    const read = await user.deviceA
      .from("compass_items")
      .select("*")
      .eq("id", id);
    expect(read.data ?? []).toHaveLength(0);

    const write = await user.deviceA
      .from("compass_items")
      .update({ text: "Tampered" })
      .eq("id", id)
      .select();
    expect(write.data ?? []).toHaveLength(0);

    const hijack = await submitOps(user.deviceA, [
      itemOp("a", id, { text: "Hijack" }),
    ]);
    // Refused outright. It must not come back "accepted", or this device would
    // believe it had saved something that was never stored.
    expect(hijack[0].status).toBe("error");
    const theirs = await other.deviceA
      .from("compass_items")
      .select("text")
      .eq("id", id);
    expect(theirs.data?.[0]?.text).toBe("Private");
  });

  it("gives no way to hard-delete through the API", async () => {
    const id = newId();
    await submitOps(user.deviceA, [itemOp("a", id)]);
    await user.deviceA.from("compass_items").delete().eq("id", id);
    expect(await stored(user, id)).toBeDefined();
  });

  it("turns away a build below protocol 4, and the helpers send at least that", async () => {
    expect(CLIENT_PROTOCOL).toBeGreaterThanOrEqual(4);
    const { error } = await user.deviceA.rpc("submit_sync_operations", {
      ops: [],
      p_client_protocol: 3,
    });
    expect(error?.message ?? "").toContain("client_outdated");
  });
});
