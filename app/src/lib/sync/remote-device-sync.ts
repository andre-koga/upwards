import { supabase, getCachedUserId } from "@/lib/supabase";
import { db, now } from "@/lib/db";
import type { SyncDeviceRecord } from "@/lib/db/types";
import { getOrCreateDeviceId } from "./device-id";

const APP_VERSION =
  typeof import.meta.env.VITE_APP_VERSION === "string"
    ? import.meta.env.VITE_APP_VERSION
    : null;

export async function upsertRemoteDeviceRecord(
  accountId: string
): Promise<void> {
  if (!supabase) return;
  const deviceId = getOrCreateDeviceId();
  const ts = now();

  const { error } = await supabase.from("sync_devices").upsert(
    {
      id: deviceId,
      user_id: accountId,
      last_seen_at: ts,
      app_version: APP_VERSION,
      updated_at: ts,
    },
    { onConflict: "user_id,id" }
  );

  if (error) {
    console.warn("[sync] failed to upsert remote device record:", error.message);
  }
}

export async function pullRemoteDeviceRecords(
  accountId: string
): Promise<SyncDeviceRecord[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("sync_devices")
    .select("id,user_id,label,last_seen_at,created_at,updated_at")
    .eq("user_id", accountId)
    .order("last_seen_at", { ascending: false });

  if (error || !data) {
    console.warn("[sync] failed to pull remote device records:", error?.message);
    return [];
  }

  const localDeviceId = getOrCreateDeviceId();
  const records: SyncDeviceRecord[] = data.map((row) => ({
    id: row.id,
    account_id: row.user_id,
    label: row.label,
    last_seen_at: row.last_seen_at,
    created_at: row.created_at,
    retired_at: null,
  }));

  await Promise.all(
    records.map((record) => {
      if (record.id === localDeviceId) {
        return db.syncDevices.put(record);
      }
      return db.syncDevices.put(record);
    })
  );

  return records;
}

export async function syncDeviceRegistry(accountId?: string | null): Promise<void> {
  const userId = accountId ?? getCachedUserId();
  if (!userId) return;
  await upsertRemoteDeviceRecord(userId);
  await pullRemoteDeviceRecords(userId);
}
