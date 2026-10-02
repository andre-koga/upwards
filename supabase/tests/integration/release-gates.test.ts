import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  countDeltaOp,
  createIsolatedUser,
  loadSupabaseEnv,
  newId,
  pullOps,
  type IsolatedUser,
  type SyncOpInput,
} from "./helpers";

const PROTOCOL = 1;
const DATE = "2026-10-02";
const DEVICE_A = "device-a";

function adminClient(): SupabaseClient {
  const env = loadSupabaseEnv();
  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readConfig(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("app_config")
    .select("min_client_protocol,data_epoch")
    .single();
  if (error) throw error;
  return data as { min_client_protocol: number; data_epoch: number };
}

async function setConfig(
  admin: SupabaseClient,
  patch: Partial<{ min_client_protocol: number; data_epoch: number }>
) {
  const { error } = await admin.from("app_config").update(patch).eq("id", true);
  if (error) throw error;
}

function incrementOp(activityId: string): SyncOpInput {
  return countDeltaOp({
    deviceId: DEVICE_A,
    activityId,
    date: DATE,
    delta: 1,
    previousCount: 0,
    nextCount: 1,
  });
}

describe("sync release gates", () => {
  let user: IsolatedUser;
  let admin: SupabaseClient;
  let original: { min_client_protocol: number; data_epoch: number };

  beforeAll(async () => {
    admin = adminClient();
    original = await readConfig(admin);
    user = await createIsolatedUser();
  });

  beforeEach(async () => {
    await setConfig(admin, original);
  });

  afterAll(async () => {
    await setConfig(admin, original);
  });

  it("returns the data epoch from every gated RPC", async () => {
    await setConfig(admin, { data_epoch: original.data_epoch + 1 });
    const epoch = original.data_epoch + 1;

    const submit = await user.deviceA.rpc("submit_sync_operations", {
      ops: [incrementOp(newId())],
      p_client_protocol: PROTOCOL,
    });
    expect(submit.error).toBeNull();
    expect(submit.data).toMatchObject({ data_epoch: epoch });
    expect(submit.data.results[0].status).toBe("accepted");

    const pull = await user.deviceA.rpc("pull_sync_operations", {
      since_sequence: 0,
      p_client_protocol: PROTOCOL,
    });
    expect(pull.error).toBeNull();
    expect(pull.data.data_epoch).toBe(epoch);
    expect(Array.isArray(pull.data.operations)).toBe(true);

    const snapshot = await user.deviceA.rpc("pull_sync_snapshot", {
      p_client_protocol: PROTOCOL,
    });
    expect(snapshot.error).toBeNull();
    expect(snapshot.data.data_epoch).toBe(epoch);
  });

  it("keeps the legacy response shapes for builds that predate the gate", async () => {
    const submit = await user.deviceA.rpc("submit_sync_operations", {
      ops: [incrementOp(newId())],
    });
    expect(submit.error).toBeNull();
    expect(Array.isArray(submit.data)).toBe(true);

    const pull = await user.deviceA.rpc("pull_sync_operations", {
      since_sequence: 0,
    });
    expect(pull.error).toBeNull();
    expect(Array.isArray(pull.data)).toBe(true);
  });

  it("rejects outdated protocols and writes nothing, so the op can be resubmitted after updating", async () => {
    await setConfig(admin, { min_client_protocol: PROTOCOL + 1 });
    const op = incrementOp(newId());

    const legacy = await user.deviceA.rpc("submit_sync_operations", {
      ops: [op],
    });
    expect(legacy.error?.message).toBe("client_outdated");

    const outdated = await user.deviceA.rpc("submit_sync_operations", {
      ops: [op],
      p_client_protocol: PROTOCOL,
    });
    expect(outdated.error?.message).toBe("client_outdated");

    const pull = await user.deviceA.rpc("pull_sync_operations", {
      since_sequence: 0,
      p_client_protocol: PROTOCOL,
    });
    expect(pull.error?.message).toBe("client_outdated");

    const snapshot = await user.deviceA.rpc("pull_sync_snapshot", {
      p_client_protocol: PROTOCOL,
    });
    expect(snapshot.error?.message).toBe("client_outdated");

    // The updated build sends the same queued op: it is accepted exactly once.
    const updated = await user.deviceA.rpc("submit_sync_operations", {
      ops: [op],
      p_client_protocol: PROTOCOL + 1,
    });
    expect(updated.error).toBeNull();
    expect(updated.data.results[0]).toMatchObject({
      operation_id: op.operation_id,
      status: "accepted",
    });

    await setConfig(admin, original);
    const stored = (await pullOps(user.deviceA, 0)).filter(
      (row) => row.operation_id === op.operation_id
    );
    expect(stored).toHaveLength(1);
  });

  it("includes ops submitted under a bumped epoch in the re-bootstrap snapshot", async () => {
    const activityId = newId();
    await setConfig(admin, { data_epoch: original.data_epoch + 1 });

    const submit = await user.deviceA.rpc("submit_sync_operations", {
      ops: [incrementOp(activityId)],
      p_client_protocol: PROTOCOL,
    });
    expect(submit.error).toBeNull();

    const snapshot = await user.deviceB.rpc("pull_sync_snapshot", {
      p_client_protocol: PROTOCOL,
    });
    expect(snapshot.error).toBeNull();
    expect(snapshot.data.data_epoch).toBe(original.data_epoch + 1);
    const entry = (
      snapshot.data.daily_entries as Array<{
        date: string;
        task_counts: Record<string, number> | null;
      }>
    ).find((row) => row.date === DATE && row.task_counts?.[activityId] != null);
    expect(entry?.task_counts?.[activityId]).toBe(1);
  });

  it("keeps the gate config and ungated RPC bodies out of client reach", async () => {
    const config = await user.deviceA.from("app_config").select("*");
    expect(config.data ?? []).toHaveLength(0);

    const update = await user.deviceA
      .from("app_config")
      .update({ min_client_protocol: 0 })
      .eq("id", true)
      .select();
    expect(update.data ?? []).toHaveLength(0);

    const bypass = await user.deviceA.rpc("submit_sync_operations_ungated", {
      ops: [incrementOp(newId())],
    });
    expect(bypass.error).not.toBeNull();

    const snapshotBypass = await user.deviceA.rpc("pull_sync_snapshot_ungated");
    expect(snapshotBypass.error).not.toBeNull();
  });

  it("records the device heartbeat fields", async () => {
    const deviceId = `device-${newId()}`;
    const { error } = await user.deviceA.from("sync_devices").upsert(
      {
        id: deviceId,
        user_id: user.userId,
        last_seen_at: new Date().toISOString(),
        client_protocol: PROTOCOL,
        local_schema_version: 30,
        pending_count: 2,
      },
      { onConflict: "user_id,id" }
    );
    expect(error).toBeNull();

    const { data } = await user.deviceA
      .from("sync_devices")
      .select("client_protocol,local_schema_version,pending_count")
      .eq("id", deviceId)
      .single();
    expect(data).toEqual({
      client_protocol: PROTOCOL,
      local_schema_version: 30,
      pending_count: 2,
    });
  });
});
