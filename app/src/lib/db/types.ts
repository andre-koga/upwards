export interface ActivityGroup {
  id: string;
  name: string;
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
  location: LocationData | null;
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
