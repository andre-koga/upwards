import { beforeAll, describe, expect, it } from "vitest";
import {
  createIsolatedUser,
  newId,
  pullSnapshot,
  submitOps,
  type IsolatedUser,
  type SyncOpInput,
} from "./helpers";

// The sync RPC after the model cutover (20261007131137): retired entity types
// are refused, and activities and groups store the new lifecycle fields.

const T = "2026-10-07T12:00:00.000Z";

function upsert(
  entityType: string,
  id: string,
  row: Record<string, unknown>
): SyncOpInput {
  return {
    operation_id: newId(),
    device_id: "device-a",
    entity_type: entityType,
    entity_id: id,
    operation_type: "projection.upsert",
    payload: { row: { id, created_at: T, updated_at: T, ...row } },
    base_revision: null,
  };
}

describe("sync RPC after the model cutover", () => {
  let user: IsolatedUser;

  beforeAll(async () => {
    user = await createIsolatedUser();
  });

  const snapshotRow = async (table: string, id: string) => {
    const snapshot = await pullSnapshot(user.deviceB);
    return (snapshot[table] as Array<Record<string, unknown>>).find(
      (row) => row.id === id
    );
  };

  describe("retired shapes are refused", () => {
    for (const entityType of [
      "activity_status_event",
      "group_status_event",
      "recurring_memo",
    ]) {
      it(`rejects ${entityType} and stores nothing`, async () => {
        const id = newId();
        const [result] = await submitOps(user.deviceA, [
          upsert(entityType, id, { title: "x", status_type: "deleted" }),
        ]);
        expect(result.status).toBe("error");
        expect(JSON.stringify(result)).toContain("entity_type_retired");
      });
    }

    it("still accepts the rest of a batch that included a retired op", async () => {
      const activityId = newId();
      const results = await submitOps(user.deviceA, [
        upsert("recurring_memo", newId(), { title: "old" }),
        upsert("activity", activityId, { name: "Kept", routine: "daily" }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual(["accepted", "error"]);
      expect(await snapshotRow("activities", activityId)).toBeDefined();
    });

    it("keeps the old tables readable but not writable from the API", async () => {
      const read = await user.deviceA.from("recurring_memos").select("id");
      expect(read.error).toBeNull();
      const write = await user.deviceA.from("recurring_memos").insert({
        id: newId(),
        user_id: user.userId,
        title: "sneaky",
        routine: "daily",
        created_at: T,
        updated_at: T,
      });
      expect(write.error).not.toBeNull();
    });
  });

  describe("activities store the new fields", () => {
    it("saves tracks_time, is_pinned and archived_at", async () => {
      const id = newId();
      const [result] = await submitOps(user.deviceA, [
        upsert("activity", id, {
          name: "Meds",
          routine: "daily",
          tracks_time: false,
          is_pinned: true,
          archived_at: "2026-10-01T04:00:00.000Z",
        }),
      ]);
      expect(result.status).toBe("accepted");
      expect(await snapshotRow("activities", id)).toMatchObject({
        tracks_time: false,
        is_pinned: true,
        archived_at: "2026-10-01T04:00:00+00:00",
      });
    });

    it("clears archived_at when the activity is restored", async () => {
      const id = newId();
      await submitOps(user.deviceA, [
        upsert("activity", id, { name: "Read", routine: "daily", archived_at: "2026-10-01T04:00:00.000Z" }),
      ]);
      await submitOps(user.deviceA, [
        upsert("activity", id, { name: "Read", routine: "daily", archived_at: null, updated_at: "2026-10-07T13:00:00.000Z" }),
      ]);
      expect((await snapshotRow("activities", id))?.archived_at).toBeNull();
    });

    it("keeps the new fields when an update does not mention them", async () => {
      const id = newId();
      await submitOps(user.deviceA, [
        upsert("activity", id, { name: "Pinned", routine: "daily", is_pinned: true, tracks_time: false }),
      ]);
      await submitOps(user.deviceA, [
        upsert("activity", id, { name: "Pinned (renamed)", routine: "daily", updated_at: "2026-10-07T13:00:00.000Z" }),
      ]);
      expect(await snapshotRow("activities", id)).toMatchObject({
        name: "Pinned (renamed)",
        is_pinned: true,
        tracks_time: false,
      });
    });

    it("defaults a new activity to timed and unpinned", async () => {
      const id = newId();
      await submitOps(user.deviceA, [upsert("activity", id, { name: "Plain", routine: "daily" })]);
      expect(await snapshotRow("activities", id)).toMatchObject({
        tracks_time: true,
        is_pinned: false,
        archived_at: null,
      });
    });

    it("does not store the fields for an op the server did not accept", async () => {
      const id = newId();
      await submitOps(user.deviceA, [
        upsert("activity", id, { name: "Original", routine: "daily" }),
      ]);
      // A stale base revision is a conflict; its extra fields must not leak in.
      const stale = upsert("activity", id, {
        name: "Stale edit",
        routine: "daily",
        is_pinned: true,
        updated_at: "2026-10-07T14:00:00.000Z",
      });
      stale.base_revision = "2000-01-01T00:00:00.000Z";
      const [result] = await submitOps(user.deviceA, [stale]);
      expect(result.status).toBe("conflict");
      expect((await snapshotRow("activities", id))?.is_pinned).toBe(false);
    });

    it("cannot touch another user's activity", async () => {
      const other = await createIsolatedUser();
      const id = newId();
      await submitOps(other.deviceA, [
        upsert("activity", id, { name: "Theirs", routine: "daily", is_pinned: false }),
      ]);
      await submitOps(user.deviceA, [
        upsert("activity", id, { name: "Mine now?", routine: "daily", is_pinned: true }),
      ]);
      const { data } = await other.deviceA
        .from("activities")
        .select("is_pinned")
        .eq("id", id)
        .maybeSingle();
      expect(data?.is_pinned).toBe(false);
    });
  });

  describe("groups store archived_at", () => {
    it("saves and clears it", async () => {
      const id = newId();
      await submitOps(user.deviceA, [
        upsert("activity_group", id, { name: "Old", archived_at: "2026-09-01T04:00:00.000Z" }),
      ]);
      expect((await snapshotRow("activity_groups", id))?.archived_at).toBe(
        "2026-09-01T04:00:00+00:00"
      );
      await submitOps(user.deviceA, [
        upsert("activity_group", id, { name: "Old", archived_at: null, updated_at: "2026-10-07T13:00:00.000Z" }),
      ]);
      expect((await snapshotRow("activity_groups", id))?.archived_at).toBeNull();
    });
  });
});
