import { v5 as uuidv5 } from "uuid";
import { getCachedUserId } from "@/lib/supabase";
import { getOrCreateDeviceId } from "./device-id";

/** Stable namespace so every device computes the same journal/daily-entry IDs. */
export const UPWARDS_SYNC_NAMESPACE = "7e1b4c3a-9f20-4d8e-8c11-a1b2c3d4e5f6";

export function syncUserKey(
  userId?: string | null,
  deviceId?: string | null
): string {
  if (userId && userId.length > 0) return userId;
  const device = deviceId && deviceId.length > 0 ? deviceId : getOrCreateDeviceId();
  return `guest:${device}`;
}

export function currentSyncUserKey(): string {
  return syncUserKey(getCachedUserId());
}

export function naturalJournalId(userKey: string, date: string): string {
  return uuidv5(`journal:${userKey}:${date}`, UPWARDS_SYNC_NAMESPACE);
}

export function naturalDailyEntryId(userKey: string, date: string): string {
  return uuidv5(`daily:${userKey}:${date}`, UPWARDS_SYNC_NAMESPACE);
}

export function naturalJournalIdForDate(date: string): string {
  return naturalJournalId(currentSyncUserKey(), date);
}

export function naturalDailyEntryIdForDate(date: string): string {
  return naturalDailyEntryId(currentSyncUserKey(), date);
}

