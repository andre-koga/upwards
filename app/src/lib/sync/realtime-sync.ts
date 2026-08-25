import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, getCachedUserId } from "@/lib/supabase";
import { getOrCreateDeviceId } from "./device-id";

export interface RealtimeSyncCallbacks {
  userId?: string | null;
  onRemoteChange: () => void;
  onResubscribe: () => void;
}

let activeChannel: RealtimeChannel | null = null;

export function subscribeToRemoteSyncOperations(
  callbacks: RealtimeSyncCallbacks
): () => void {
  if (!supabase) return () => undefined;

  const userId = callbacks.userId ?? getCachedUserId();
  if (!userId) {
    console.warn("[sync] realtime skipped: no user id");
    return () => undefined;
  }

  unsubscribeFromRemoteSyncOperations();

  // Do not filter on user_id in postgres_changes: that column is not the
  // primary key, so filtered INSERT events are often dropped unless replica
  // identity is FULL. RLS already limits events to this user's rows.
  const channel = supabase
    .channel(`sync-ops:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "sync_operations",
      },
      (payload) => {
        const row = payload.new as { user_id?: string; device_id?: string };
        if (row.user_id && row.user_id !== userId) return;
        if (row.device_id === getOrCreateDeviceId()) return;
        callbacks.onRemoteChange();
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        callbacks.onResubscribe();
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[sync] realtime channel status:", status);
      }
    });

  activeChannel = channel;

  return () => {
    if (activeChannel === channel) {
      unsubscribeFromRemoteSyncOperations();
    }
  };
}

export function unsubscribeFromRemoteSyncOperations(): void {
  if (!activeChannel || !supabase) return;
  void supabase.removeChannel(activeChannel);
  activeChannel = null;
}
