import { beforeAll, describe, expect, it } from "vitest";
import {
  createIsolatedUser,
  newId,
  submitOps,
  type IsolatedUser,
  type SyncOpInput,
} from "./helpers";

// How the server decides a projection edit is stale. The check used to compare
// `updated_at::TEXT` with the client's ISO string; Postgres writes a space where
// the client writes 'T', so the answer came from the date part alone.

const T0 = "2026-10-19T10:00:00.000Z";
const T1 = "2026-10-19T10:05:00.000Z";
const T2 = "2026-10-19T10:06:00.000Z";
const T3 = "2026-10-19T10:07:00.000Z";
const YESTERDAY = "2026-10-18T10:00:00.000Z";

type Row = Record<string, unknown>;

function op(
  entityType: string,
  device: string,
  id: string,
  row: Row,
  base: string | null,
): SyncOpInput {
  return {
    operation_id: newId(),
    device_id: device,
    entity_type: entityType,
    entity_id: id,
    operation_type: "projection.upsert",
    payload: { row: { id, ...row } },
    base_revision: base,
  };
}

const task = (id: string, title: string, updated_at: string) => ({
  title,
  date: null,
  due_date: null,
  is_completed: false,
  is_pinned: false,
  is_archived: false,
  order_index: null,
  created_at: T0,
  updated_at,
  deleted_at: null,
});

const memory = (text: string, updated_at: string) => ({
  text_content: text,
  photo_paths: null,
  time_label: null,
  created_at: T0,
  updated_at,
  deleted_at: null,
});

describe("stale edits to tasks (the generic projection path)", () => {
  let user: IsolatedUser;
  beforeAll(async () => {
    user = await createIsolatedUser();
  });

  async function seed(id: string) {
    const [created] = await submitOps(user.deviceA, [
      op("one_time_task", "a", id, task(id, "v0", T0), null),
    ]);
    expect(created.status).toBe("accepted");
  }

  it("flags a stale edit made on the same day as the version it replaces", async () => {
    const id = newId();
    await seed(id);
    await submitOps(user.deviceA, [
      op("one_time_task", "a", id, task(id, "From A", T1), T0),
    ]);
    const [stale] = await submitOps(user.deviceB, [
      op("one_time_task", "b", id, task(id, "From B", T2), T0),
    ]);
    expect(stale.status).toBe("conflict");
  });

  it("flags a stale edit from an earlier day as before", async () => {
    const id = newId();
    await submitOps(user.deviceA, [
      op("one_time_task", "a", id, task(id, "v0", YESTERDAY), null),
    ]);
    await submitOps(user.deviceA, [
      op("one_time_task", "a", id, task(id, "From A", T1), YESTERDAY),
    ]);
    const [stale] = await submitOps(user.deviceB, [
      op("one_time_task", "b", id, task(id, "From B", T2), YESTERDAY),
    ]);
    expect(stale.status).toBe("conflict");
  });

  it("accepts an edit based on the current version", async () => {
    const id = newId();
    await seed(id);
    const [edit] = await submitOps(user.deviceA, [
      op("one_time_task", "a", id, task(id, "v1", T1), T0),
    ]);
    const [again] = await submitOps(user.deviceB, [
      op("one_time_task", "b", id, task(id, "v2", T2), T1),
    ]);
    expect(edit.status).toBe("accepted");
    expect(again.status).toBe("accepted");
  });

  it("accepts offline edits collapsed into one, whose base is the device's own earlier edit", async () => {
    // The client keeps only the newest of several pending edits, and that edit's
    // base is the previous local edit (T1), a version the server has never
    // seen. The server holds T0, which is older than the base, so it is not stale.
    const id = newId();
    await seed(id);
    const [collapsed] = await submitOps(user.deviceA, [
      op("one_time_task", "a", id, task(id, "after two offline edits", T2), T1),
    ]);
    expect(collapsed.status).toBe("accepted");
  });

  it("never keeps the stale text when it flags a conflict", async () => {
    const id = newId();
    await seed(id);
    await submitOps(user.deviceA, [
      op("one_time_task", "a", id, task(id, "From A", T1), T0),
    ]);
    await submitOps(user.deviceB, [
      op("one_time_task", "b", id, task(id, "From B", T2), T0),
    ]);
    const { data } = await user.deviceA
      .from("one_time_tasks")
      .select("title")
      .eq("id", id)
      .single();
    expect(data?.title).toBe("From A");
  });
});

describe("memories", () => {
  let user: IsolatedUser;
  beforeAll(async () => {
    user = await createIsolatedUser();
  });

  it("accepts an edit based on the current version", async () => {
    const id = newId();
    await submitOps(user.deviceA, [
      op("memory", "a", id, memory("v0", T0), null),
    ]);
    const [edit] = await submitOps(user.deviceA, [
      op("memory", "a", id, memory("v1", T1), T0),
    ]);
    const [again] = await submitOps(user.deviceA, [
      op("memory", "a", id, memory("v2", T2), T1),
    ]);
    // Every one of these used to come back as a conflict.
    expect(edit.status).toBe("accepted");
    expect(again.status).toBe("accepted");
  });

  it("flags a stale edit and keeps the first", async () => {
    const id = newId();
    await submitOps(user.deviceA, [
      op("memory", "a", id, memory("v0", T0), null),
    ]);
    await submitOps(user.deviceA, [
      op("memory", "a", id, memory("From A", T1), T0),
    ]);
    const [stale] = await submitOps(user.deviceB, [
      op("memory", "b", id, memory("From B", T2), T0),
    ]);
    expect(stale.status).toBe("conflict");
    const { data } = await user.deviceA
      .from("memories")
      .select("text_content")
      .eq("id", id)
      .single();
    expect(data?.text_content).toBe("From A");
  });

  it("accepts collapsed offline edits", async () => {
    const id = newId();
    await submitOps(user.deviceA, [
      op("memory", "a", id, memory("v0", T0), null),
    ]);
    const [collapsed] = await submitOps(user.deviceA, [
      op("memory", "a", id, memory("after two offline edits", T3), T2),
    ]);
    expect(collapsed.status).toBe("accepted");
  });

  it("can be read by its owner, which conflict review needs, and by nobody else", async () => {
    const id = newId();
    await submitOps(user.deviceA, [
      op("memory", "a", id, memory("Private", T0), null),
    ]);
    const own = await user.deviceA
      .from("memories")
      .select("text_content")
      .eq("id", id);
    expect(own.error).toBeNull();
    expect(own.data?.[0]?.text_content).toBe("Private");

    const other = await createIsolatedUser();
    const theirs = await other.deviceA
      .from("memories")
      .select("*")
      .eq("id", id);
    expect(theirs.error).toBeNull();
    expect(theirs.data ?? []).toHaveLength(0);
  });

  it("is read-only through the API: the RPC is the only way to write", async () => {
    const id = newId();
    await submitOps(user.deviceA, [
      op("memory", "a", id, memory("Mine", T0), null),
    ]);
    const write = await user.deviceA
      .from("memories")
      .update({ text_content: "Tampered" })
      .eq("id", id)
      .select();
    expect(write.error).not.toBeNull();
    const { data } = await user.deviceA
      .from("memories")
      .select("text_content")
      .eq("id", id)
      .single();
    expect(data?.text_content).toBe("Mine");
  });
});

describe("tables that stay closed", () => {
  it("keeps journal revisions unreadable: append-only, so nothing needs to read them", async () => {
    const user = await createIsolatedUser();
    const { error } = await user.deviceA
      .from("journal_entry_revisions")
      .select("id")
      .limit(1);
    expect(error?.code).toBe("42501");
  });
});
