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
