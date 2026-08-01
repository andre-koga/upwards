import { db, now, newId } from "@/lib/db";
import type { SyncDeviceRecord } from "@/lib/db/types";

const DEVICE_ID_KEY = "okhabit:device_id";

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = newId();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export async function ensureLocalDeviceRecord(): Promise<SyncDeviceRecord> {
  const deviceId = getOrCreateDeviceId();
  const existing = await db.syncDevices.get(deviceId);
  if (existing) return existing;

  const record: SyncDeviceRecord = {
    id: deviceId,
    account_id: null,
    label: null,
    last_seen_at: now(),
    created_at: now(),
    retired_at: null,
  };
  await db.syncDevices.add(record);
  return record;
}

export async function touchLocalDevice(
  accountId?: string | null
): Promise<void> {
  const deviceId = getOrCreateDeviceId();
  const ts = now();
  const existing = await db.syncDevices.get(deviceId);

  if (existing) {
    await db.syncDevices.update(deviceId, {
      last_seen_at: ts,
      account_id: accountId ?? existing.account_id,
    });
    return;
  }

  await db.syncDevices.add({
    id: deviceId,
    account_id: accountId ?? null,
    label: null,
    last_seen_at: ts,
    created_at: ts,
    retired_at: null,
  });
}
