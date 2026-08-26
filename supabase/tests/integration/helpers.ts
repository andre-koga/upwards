import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SubmitResult {
  operation_id: string;
  status: string;
  server_sequence: number;
}

export interface RemoteOp {
  operation_id: string;
  device_id: string;
  entity_type: string;
  entity_id: string | null;
  operation_type: string;
  payload: Record<string, unknown>;
  base_revision: string | null;
  status: string;
  server_sequence: number;
  created_at: string;
}

export interface SyncOpInput {
  operation_id: string;
  device_id: string;
  entity_type: string;
  entity_id: string | null;
  operation_type: string;
  payload: Record<string, unknown>;
  base_revision?: string | null;
}

export interface IsolatedUser {
  userId: string;
  email: string;
  deviceA: SupabaseClient;
  deviceB: SupabaseClient;
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function parseStatusEnv(output: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of output.split("\n")) {
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    env[line.slice(0, eq)] = stripQuotes(line.slice(eq + 1).trim());
  }
  return env;
}

export function loadSupabaseEnv(): {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
} {
  const fromProcess = {
    url: process.env.SUPABASE_URL ?? process.env.API_URL,
    anonKey:
      process.env.SUPABASE_ANON_KEY ??
      process.env.ANON_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.PUBLISHABLE_KEY,
    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY,
  };
  if (fromProcess.url && fromProcess.anonKey && fromProcess.serviceRoleKey) {
    return {
      url: fromProcess.url,
      anonKey: fromProcess.anonKey,
      serviceRoleKey: fromProcess.serviceRoleKey,
    };
  }

  let statusOutput = "";
  try {
    statusOutput = execFileSync(
      "pnpm",
      ["exec", "supabase", "status", "-o", "env"],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "supabase status failed";
    throw new Error(
      `Local Supabase is not reachable. Start it with \`pnpm supabase start\`, then retry. (${detail})`
    );
  }

  const status = parseStatusEnv(statusOutput);
  const url = fromProcess.url ?? status.API_URL ?? status.SUPABASE_URL;
  const anonKey =
    fromProcess.anonKey ??
    status.ANON_KEY ??
    status.PUBLISHABLE_KEY ??
    status.SUPABASE_ANON_KEY;
  const serviceRoleKey =
    fromProcess.serviceRoleKey ??
    status.SERVICE_ROLE_KEY ??
    status.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Could not resolve SUPABASE_URL, anon key, and service role key from env or `supabase status`."
    );
  }

  return { url, anonKey, serviceRoleKey };
}

function userClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createIsolatedUser(): Promise<IsolatedUser> {
  const env = loadSupabaseEnv();
  const admin = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `integ-${crypto.randomUUID()}@example.com`;
  const password = `Pw-${crypto.randomUUID()}aA1`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error("Failed to create integration test user");
  }

  async function signIn(): Promise<SupabaseClient> {
    const client = userClient(env.url, env.anonKey);
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    return client;
  }

  const [deviceA, deviceB] = await Promise.all([signIn(), signIn()]);
  return { userId: created.data.user.id, email, deviceA, deviceB };
}

export function newId(): string {
  return crypto.randomUUID();
}

export async function submitOps(
  client: SupabaseClient,
  ops: SyncOpInput[]
): Promise<SubmitResult[]> {
  const { data, error } = await client.rpc("submit_sync_operations", { ops });
  if (error) throw error;
  if (!Array.isArray(data)) {
    throw new Error(
      `submit_sync_operations returned ${typeof data}, expected array`
    );
  }
  return data as SubmitResult[];
}

export async function pullOps(
  client: SupabaseClient,
  sinceSequence = 0
): Promise<RemoteOp[]> {
  const { data, error } = await client.rpc("pull_sync_operations", {
    since_sequence: sinceSequence,
  });
  if (error) throw error;
  if (!data) return [];
  return data as RemoteOp[];
}

export async function pullSnapshot(
  client: SupabaseClient
): Promise<Record<string, unknown>> {
  const { data, error } = await client.rpc("pull_sync_snapshot");
  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("pull_sync_snapshot returned a non-object");
  }
  return data as Record<string, unknown>;
}

export function countDeltaOp(input: {
  deviceId: string;
  activityId: string;
  date: string;
  delta: number;
  previousCount: number;
  nextCount: number;
}): SyncOpInput {
  return {
    operation_id: newId(),
    device_id: input.deviceId,
    entity_type: "daily_entry",
    entity_id: input.activityId,
    operation_type: "count.delta",
    payload: {
      activity_id: input.activityId,
      date: input.date,
      delta: input.delta,
      previous_count: input.previousCount,
      next_count: input.nextCount,
      reason: input.delta > 0 ? "increment" : "cycle",
    },
  };
}

export function projectionUpsertOp(input: {
  deviceId: string;
  entityType: string;
  entityId: string;
  row: Record<string, unknown>;
  baseRevision?: string | null;
}): SyncOpInput {
  return {
    operation_id: newId(),
    device_id: input.deviceId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    operation_type: "projection.upsert",
    payload: { row: input.row },
    base_revision: input.baseRevision ?? null,
  };
}
