// Local-first type definitions
// Sync fields (synced_at, deleted_at) are null for local-only data
// and will be used when the optional cloud sync feature is added.

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
    name: string;
    pattern: string | null;
    routine: string | null;
    completion_target: number | null;
    color: string | null;
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
    displayName: string;      // human-readable, used for display
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
    youtube_url: string | null;
    location: LocationData | null;
    created_at: string;
    updated_at: string;
    synced_at: string | null;
    deleted_at: string | null;
}

export interface OneTimeTask {
    id: string;
    date: string | null; // YYYY-MM-DD
    title: string;
    is_completed: boolean | null;
    order_index: number | null;
    created_at: string;
    updated_at: string;
    synced_at: string | null;
    deleted_at: string | null;
}

export interface TimeEntry {
    id: string;
    activity_id: string;
    time_start: string; // ISO string
    time_end: string | null; // ISO string
    created_at: string;
    updated_at: string;
    synced_at: string | null;
    deleted_at: string | null;
}
