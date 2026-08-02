export interface ActivityGroup {
  id: string;
  name: string;
  /** Legacy sync column; always null — groups use color only in the UI. */
  emoji: string | null;
  color: string | null;
  order_index: number | null;
  is_archived: boolean | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}

export interface Activity {
  id: string;
  group_id: string;
  name: string | null; // null = group-default (timing the group without a specific activity)
  routine: string | null;
  completion_target: number | null;
  /** Set when the user marks the habit as done; hides it from For Today. Clear to reactivate. */
  completed_at: string | null;
  order_index: number | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}

export interface DailyEntry {
  id: string;
  date: string; // YYYY-MM-DD
  task_counts: Record<string, number> | null;
  paused_task_ids: string[] | null;
  is_break_day: boolean | null;
  current_activity_id: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}

export interface ActivityPeriod {
  id: string;
  daily_entry_id: string;
  activity_id: string;
  start_time: string; // ISO string
  end_time: string | null; // ISO string
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}

export interface LocationData {
  displayName: string; // human-readable, used for display
  city: string | null;
  state: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number | null;
  lon: number | null;
}

export interface JournalLocationRoute {
  locations: LocationData[];
}

export interface JournalEntry {
  id: string;
  entry_date: string; // YYYY-MM-DD
  title: string | null;
  text_content: string | null;
  day_emoji: string | null;
  is_bookmarked: boolean | null;
  video_path: string | null;
  video_thumbnail: string | null;
  photo_paths: string[] | null;
  is_journal_complete: boolean | null;
  journal_entry_number: number | null;
  journal_completion_streak: number | null;
  journal_completed_at: string | null;
  /** Distinct places visited that day (unordered set; array order is display-only). */
  location: JournalLocationRoute | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}

export interface OneTimeTask {
  id: string;
  date: string | null; // YYYY-MM-DD, completion date when done
  title: string;
  is_completed: boolean | null;
  order_index: number | null;
  is_pinned: boolean | null;
  due_date: string | null; // YYYY-MM-DD, when memo is due
  /** Legacy column; kept for sync shape. Always null — memos are not tied to projects. */
  group_id: string | null;
  is_archived: boolean | null;
  /** Set when spawned from a recurring_memos preset. */
  recurring_memo_id: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}

export interface RecurringMemo {
  id: string;
  title: string;
  routine: string;
  is_pinned: boolean | null;
  is_enabled: boolean | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}

export interface ActivityStreak {
  id: string;
  activity_id: string;
  date: string; // YYYY-MM-DD
  streak: number;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}

/** Append-only status change for an activity (completed / deleted). */
export type ActivityStatusType = "completed" | "deleted";

export interface ActivityStatusEvent {
  id: string;
  entity_id: string;
  status_type: ActivityStatusType;
  /** true = enters status; false = leaves it (e.g. uncompleted). */
  next_value: boolean;
  /** When this status begins applying (local calendar semantics via startOfDay rules). */
  effective_at: string;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}

/** Append-only status change for a group (archived / deleted). */
export type GroupStatusType = "archived" | "deleted";

export interface GroupStatusEvent {
  id: string;
  entity_id: string;
  status_type: GroupStatusType;
  next_value: boolean;
  effective_at: string;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  deleted_at: string | null;
}

/** User profile — username used for friend invites; display_name shown in UI. */
export interface UserProfile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  updated_at: string;
}

/** A friend request (pending / accepted / declined). */
export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
}

/** An accepted friendship (ordered pair). */
export interface Friendship {
  user_a: string;
  user_b: string;
  created_at: string;
}

/** Application log entry for errors and important events. */
export interface AppLog {
  id: string;
  level: "error" | "success" | "info" | "warning";
  context: string;
  message: string;
  created_at: string;
}

export type SyncPendingStatus = "pending" | "acked" | "discarded" | "failed";
export interface SyncPendingOperation {
  id: string; // row id
  operation_id: string; // globally unique idempotency key
  account_id: string | null;
  device_id: string;
  entity_type: string;
  entity_id: string | null;
  operation_type: string;
  payload: unknown;
  base_revision: string | null;
  status: SyncPendingStatus;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  acked_at: string | null;
}

export type SyncIssueKind = "conflict" | "pending" | "error" | "info";
export type SyncIssueStatus = "open" | "resolved" | "deferred";
export interface SyncIssue {
  id: string;
  kind: SyncIssueKind;
  status: SyncIssueStatus;
  account_id: string | null;
  title: string;
  detail: string | null;
  entity_type: string | null;
  entity_id: string | null;
  operation_id: string | null;
  payload: unknown;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface SyncDeviceRecord {
  id: string; // device_id
  account_id: string | null;
  label: string | null;
  last_seen_at: string;
  created_at: string;
  retired_at: string | null;
}

/**
 * Immutable activity definition snapshot (authoritative history).
 * Current `activities` rows remain a disposable projection.
 */
export interface ActivityDefinitionVersion {
  id: string;
  activity_id: string;
  parent_version_id: string | null;
  /** Logical calendar date (YYYY-MM-DD) this version begins applying. */
  effective_from: string;
  recorded_at: string;
  server_sequence: number | null;
  operation_id: string;
  device_id: string;
  name: string | null;
  routine: string | null;
  completion_target: number | null;
  group_id: string;
  order_index: number | null;
  schema_version: number;
  created_at: string;
  deleted_at: string | null;
}

/** Immutable group definition snapshot (authoritative history). */
export interface GroupDefinitionVersion {
  id: string;
  group_id: string;
  parent_version_id: string | null;
  effective_from: string;
  recorded_at: string;
  server_sequence: number | null;
  operation_id: string;
  device_id: string;
  name: string;
  color: string | null;
  order_index: number | null;
  schema_version: number;
  created_at: string;
  deleted_at: string | null;
}
