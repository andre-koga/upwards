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
  is_archived: boolean | null;
  /** Set when the user marks the habit as "done" (distinct from archived; conveys a finished goal). */
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
  is_journal_complete: boolean | null;
  journal_entry_number: number | null;
  journal_completion_streak: number | null;
  journal_completed_at: string | null;
  /** Ordered places visited that day. */
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

// ─── Promises / Accountability ────────────────────────────────────────────────

export type PromiseMode = "mutual" | "witness";
export type PromiseStatus = "active" | "completed" | "cancelled";
export type PromiseMemberRole = "owner" | "member" | "witness";
export type PromiseInviteStatus = "pending" | "accepted" | "declined";
export type ProgressEventKind = "daily_complete" | "streak_milestone";
export type ReactionKind = "motivate" | "congratulate";

/** A commitment anchored to a habit, shared with specific people. */
export interface Promise {
  id: string;
  creator_id: string;
  /** Denormalized from the activity name at creation time. */
  title: string;
  mode: PromiseMode;
  status: PromiseStatus;
  /** The creator's local activity id. */
  creator_activity_id: string;
  created_at: string;
  completed_at: string | null;
}

/** Each person in a Promise and their linked activity. */
export interface PromiseMember {
  id: string;
  promise_id: string;
  user_id: string;
  role: PromiseMemberRole;
  /** Filled on accept for mutual mode; null for witnesses. */
  member_activity_id: string | null;
  invite_status: PromiseInviteStatus;
  display_name: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Progress payload — never contains journal text, locations, or memos. */
export interface ProgressPayload {
  activityName: string;
  streak?: number;
  completionTarget?: number;
}

/** Emitted when a member meets their daily habit target. */
export interface PromiseProgressEvent {
  id: string;
  promise_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  kind: ProgressEventKind;
  payload: ProgressPayload;
  created_at: string;
}

/** A private motivate/congratulate sent from one member to another. */
export interface PromiseReaction {
  id: string;
  promise_id: string;
  from_user_id: string;
  to_user_id: string;
  progress_event_id: string | null;
  kind: ReactionKind;
  created_at: string;
}

/** Token-based invite to join a promise before the recipient has accepted. */
export interface PromiseInvite {
  id: string;
  promise_id: string;
  token: string;
  email: string | null;
  mode: PromiseMode;
  created_at: string;
  expires_at: string | null;
  accepted_at: string | null;
}

/** User display name, used in promise cards and notifications. */
export interface UserProfile {
  user_id: string;
  display_name: string | null;
  updated_at: string;
}
