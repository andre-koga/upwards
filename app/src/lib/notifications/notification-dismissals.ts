import { supabase } from "@/lib/supabase";
import type { InboxNotification } from "@/lib/notifications/use-notifications";

export function isNotificationClearable(
  notification: InboxNotification
): boolean {
  if (notification.actionStatus === "pending") return false;
  return notification.kind === "activity_complete" || notification.kind === "daily_summary";
}

export async function fetchDismissedNotificationIds(
  userId: string
): Promise<Set<string>> {
  if (!supabase) return new Set();

  const { data, error } = await supabase
    .from("notification_dismissals")
    .select("notification_id")
    .eq("user_id", userId);

  if (error) throw error;

  return new Set((data ?? []).map((row) => row.notification_id as string));
}

export async function dismissNotifications(
  userId: string,
  notificationIds: string[]
): Promise<void> {
  if (!supabase || notificationIds.length === 0) return;

  const ts = new Date().toISOString();
  const rows = notificationIds.map((notificationId) => ({
    user_id: userId,
    notification_id: notificationId,
    dismissed_at: ts,
  }));

  const { error } = await supabase
    .from("notification_dismissals")
    .upsert(rows, { onConflict: "user_id,notification_id" });

  if (error) throw error;
}

export async function pruneDismissedNotifications(
  userId: string,
  activeNotificationIds: Iterable<string>
): Promise<void> {
  if (!supabase) return;

  const active = new Set(activeNotificationIds);
  const { data, error } = await supabase
    .from("notification_dismissals")
    .select("notification_id")
    .eq("user_id", userId);

  if (error) throw error;

  const staleIds = (data ?? [])
    .map((row) => row.notification_id as string)
    .filter((id) => !active.has(id));

  if (staleIds.length === 0) return;

  const { error: deleteError } = await supabase
    .from("notification_dismissals")
    .delete()
    .eq("user_id", userId)
    .in("notification_id", staleIds);

  if (deleteError) throw deleteError;
}
