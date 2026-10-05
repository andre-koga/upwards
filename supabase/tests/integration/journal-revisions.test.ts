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

const DATE = "2026-03-14";

function revisionOp(
  deviceId: string,
  id: string,
  row: Record<string, unknown> = {}
): SyncOpInput {
  return {
    operation_id: newId(),
    device_id: deviceId,
    entity_type: "journal_entry_revision",
    entity_id: id,
    operation_type: "projection.upsert",
    payload: {
      row: {
        id,
        entry_date: DATE,
        title: "Before",
        day_emoji: "🙂",
        text_content: "The old text",
        photo_paths: ["u/old.jpg"],
        video_path: null,
        video_thumbnail: null,
        created_at: "2026-10-05T12:00:00.000Z",
        updated_at: "2026-10-05T12:00:00.000Z",
        ...row,
      },
    },
    base_revision: null,
  };
}

describe("journal entry revisions", () => {
  let user: IsolatedUser;

  beforeAll(async () => {
    user = await createIsolatedUser();
  });

  it("accepts a revision and returns it in the snapshot", async () => {
    const id = newId();
    const [result] = await submitOps(user.deviceA, [revisionOp("a", id)]);
    expect(result.status).toBe("accepted");

    const snapshot = await pullSnapshot(user.deviceB);
    const revisions = snapshot.journal_entry_revisions as Array<
      Record<string, unknown>
    >;
    const stored = revisions.find((row) => row.id === id);
    expect(stored?.entry_date).toBe(DATE);
    expect(stored?.text_content).toBe("The old text");
    expect(stored?.photo_paths).toEqual(["u/old.jpg"]);
  });

  it("treats a replayed operation as a duplicate and stores one row", async () => {
    const id = newId();
    const op = revisionOp("a", id);
    const [first] = await submitOps(user.deviceA, [op]);
    const [second] = await submitOps(user.deviceA, [op]);
    expect(first.status).toBe("accepted");
    expect(second.status).toBe("duplicate");
    expect(second.server_sequence).toBe(first.server_sequence);

    const snapshot = await pullSnapshot(user.deviceA);
    const matches = (
      snapshot.journal_entry_revisions as Array<Record<string, unknown>>
    ).filter((row) => row.id === id);
    expect(matches).toHaveLength(1);
  });

  it("never overwrites a revision, even when the same id arrives again", async () => {
    const id = newId();
    await submitOps(user.deviceA, [revisionOp("a", id)]);
    const [again] = await submitOps(user.deviceB, [
      revisionOp("b", id, { text_content: "Tampered" }),
    ]);
    expect(again.status).toBe("accepted");

    const snapshot = await pullSnapshot(user.deviceA);
    const stored = (
      snapshot.journal_entry_revisions as Array<Record<string, unknown>>
    ).find((row) => row.id === id);
    expect(stored?.text_content).toBe("The old text");
  });

  it("keeps one revision from each of two devices and shows both to both", async () => {
    const fromA = newId();
    const fromB = newId();
    await Promise.all([
      submitOps(user.deviceA, [revisionOp("a", fromA, { title: "From A" })]),
      submitOps(user.deviceB, [revisionOp("b", fromB, { title: "From B" })]),
    ]);

    for (const device of [user.deviceA, user.deviceB]) {
      const snapshot = await pullSnapshot(device);
      const ids = (
        snapshot.journal_entry_revisions as Array<Record<string, unknown>>
      ).map((row) => row.id);
      expect(ids).toEqual(expect.arrayContaining([fromA, fromB]));
    }

    const ops = await pullOps(user.deviceA, 0);
    const revisionOps = ops.filter(
      (op) => op.entity_type === "journal_entry_revision"
    );
    expect(revisionOps.map((op) => op.entity_id)).toEqual(
      expect.arrayContaining([fromA, fromB])
    );
  });

  it("does not let a user read or write another user's revisions", async () => {
    const other = await createIsolatedUser();
    const id = newId();
    await submitOps(other.deviceA, [revisionOp("x", id)]);

    const snapshot = await pullSnapshot(user.deviceA);
    const ids = (
      snapshot.journal_entry_revisions as Array<Record<string, unknown>>
    ).map((row) => row.id);
    expect(ids).not.toContain(id);

    const direct = await user.deviceA
      .from("journal_entry_revisions")
      .update({ text_content: "x" })
      .eq("id", id)
      .select();
    expect(direct.data ?? []).toHaveLength(0);
  });

  it("does not let a client delete a revision through the API", async () => {
    const id = newId();
    await submitOps(user.deviceA, [revisionOp("a", id)]);
    await user.deviceA.from("journal_entry_revisions").delete().eq("id", id);
    const snapshot = await pullSnapshot(user.deviceA);
    const ids = (
      snapshot.journal_entry_revisions as Array<Record<string, unknown>>
    ).map((row) => row.id);
    expect(ids).toContain(id);
  });
});
