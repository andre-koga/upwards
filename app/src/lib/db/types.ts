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

// ─── Goals (Promises) ─────────────────────────────────────────────────────────

export type PromiseStatus = "active" | "completed" | "cancelled";
export type PromiseInviteStatus = "pending" | "accepted" | "declined";

export interface GoalWithMembers extends Goal {
  members: GoalMember[];
}

export type GoalTargetKind = "streak_count" | "streak_until";

/**
 * Discriminated union for the two supported goal target types.
 * Used when creating or extending a goal.
 */
export type GoalTargetInput =
  | { kind: "streak_count"; streak: number }
  | { kind: "streak_until"; endDate: string }; // endDate: YYYY-MM-DD

/** A Goal — personal commitment for a habit; friends can join optionally. */
export interface Goal {
  id: string;
  creator_id: string;
  /** The creator's local activity id. Used to derive the title at read time. */
  creator_activity_id: string;
  status: PromiseStatus;
  /** null on legacy goals with no configured target. */
  target_kind: GoalTargetKind | null;
  /** Set when target_kind = 'streak_count'. */
  target_streak: number | null;
  /** Set when target_kind = 'streak_until'. YYYY-MM-DD. */
  target_end_date: string | null;
  created_at: string;
  completed_at: string | null;
}

/** Each person in a Goal and their optionally linked local activity.
 *  member_activity_id = null means "witness" (no local habit tracked). */
export interface GoalMember {
  id: string;
  promise_id: string;
  user_id: string;
  /** null = witness; non-null = mutual (tracks a local habit). */
  member_activity_id: string | null;
  invite_status: PromiseInviteStatus;
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
export interface GoalProgressEvent {
  id: string;
  promise_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  payload: ProgressPayload;
  created_at: string;
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
