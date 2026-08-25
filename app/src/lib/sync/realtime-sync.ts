import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, getCachedUserId } from "@/lib/supabase";
import { getOrCreateDeviceId } from "./device-id";

export interface RealtimeSyncCallbacks {
  onRemoteChange: () => void;
  onResubscribe: () => void;
}

let activeChannel: RealtimeChannel | null = null;

export function subscribeToRemoteSyncOperations(
  callbacks: RealtimeSyncCallbacks
): () => void {
  if (!supabase) return () => undefined;

  const userId = getCachedUserId();
  if (!userId) return () => undefined;

  unsubscribeFromRemoteSyncOperations();

  const channel = supabase
    .channel(`sync-ops:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "sync_operations",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as { device_id?: string };
        if (row.device_id === getOrCreateDeviceId()) return;
        callbacks.onRemoteChange();
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        callbacks.onResubscribe();
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
