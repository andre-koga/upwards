import Dexie, { type Table } from "dexie";
import { v4 as uuidv4 } from "uuid";
import type {
  ActivityGroup,
  Activity,
  DailyEntry,
  ActivityPeriod,
  JournalEntry,
  OneTimeTask,
  ActivityStreak,
  ActivityStatusEvent,
  GroupStatusEvent,
  UserProfile,
  AppLog,
} from "./types";
import { shiftDate, startOfDay } from "@/lib/time-utils";

const JOURNAL_VIDEO_PREFIX = "/storage/v1/object/public/journal-videos/";

function normalizeLegacyVideoPath(pathOrUrl: unknown): string | null {
  if (typeof pathOrUrl !== "string") return null;
  const value = pathOrUrl.trim();
  if (!value) return null;
  if (!value.includes("://")) return value;

  try {
    const parsed = new URL(value);
    if (!parsed.pathname.startsWith(JOURNAL_VIDEO_PREFIX)) {
      return null;
    }
    return decodeURIComponent(
      parsed.pathname.slice(JOURNAL_VIDEO_PREFIX.length)
    );
  } catch {
    return null;
  }
}

function toLegacyLocationObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    const displayName = raw.trim();
    return displayName ? { displayName } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const displayName =
    (typeof obj.displayName === "string" && obj.displayName.trim()) ||
    (typeof obj.name === "string" && obj.name.trim()) ||
    (typeof obj.label === "string" && obj.label.trim()) ||
    (typeof obj.city === "string" && obj.city.trim()) ||
    (typeof obj.state === "string" && obj.state.trim()) ||
    (typeof obj.country === "string" && obj.country.trim()) ||
    "";
  if (!displayName) return null;
  return {
    displayName,
    city: typeof obj.city === "string" ? obj.city : null,
    state: typeof obj.state === "string" ? obj.state : null,
    country: typeof obj.country === "string" ? obj.country : null,
    countryCode: typeof obj.countryCode === "string" ? obj.countryCode : null,
    lat: typeof obj.lat === "number" ? obj.lat : null,
    lon: typeof obj.lon === "number" ? obj.lon : null,
  };
}

function normalizeLegacyLocationRoute(raw: unknown): { locations: unknown[] } | null {
  if (!raw) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const route = raw as Record<string, unknown>;
    if (Array.isArray(route.locations)) {
      const normalized = route.locations
        .map(toLegacyLocationObject)
        .filter((loc): loc is Record<string, unknown> => Boolean(loc));
      return normalized.length > 0 ? { locations: normalized } : null;
    }
  }

  if (Array.isArray(raw)) {
    const normalized = raw
      .map(toLegacyLocationObject)
      .filter((loc): loc is Record<string, unknown> => Boolean(loc));
    return normalized.length > 0 ? { locations: normalized } : null;
  }

  const single = toLegacyLocationObject(raw);
  return single ? { locations: [single] } : null;
}

class UpwardsDB extends Dexie {
  activityGroups!: Table<ActivityGroup>;
  activities!: Table<Activity>;
  dailyEntries!: Table<DailyEntry>;
  activityPeriods!: Table<ActivityPeriod>;
  journalEntries!: Table<JournalEntry>;
  oneTimeTasks!: Table<OneTimeTask>;
  activityStreaks!: Table<ActivityStreak>;
  activityStatusEvents!: Table<ActivityStatusEvent>;
  groupStatusEvents!: Table<GroupStatusEvent>;
  userProfiles!: Table<UserProfile>;
  appLogs!: Table<AppLog>;

  constructor() {
    super("okhabit");
    this.version(1).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities: "id, group_id, is_archived, deleted_at, created_at",
      dailyEntries: "id, date, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries: "id, entry_date, is_bookmarked, deleted_at",
      oneTimeTasks: "id, date, is_completed, deleted_at, created_at",
    });

    this.version(2).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities: "id, group_id, is_archived, deleted_at, created_at",
      dailyEntries: "id, date, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries: "id, entry_date, is_bookmarked, deleted_at",
      oneTimeTasks: "id, date, is_completed, deleted_at, created_at",
      activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
    });

    this.version(3).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities: "id, group_id, is_archived, deleted_at, created_at",
      dailyEntries: "id, date, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries:
        "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
      oneTimeTasks: "id, date, is_completed, deleted_at, created_at",
      activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
    });

    this.version(4).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities: "id, group_id, is_archived, deleted_at, created_at",
      dailyEntries: "id, date, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries:
        "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
      oneTimeTasks:
        "id, date, is_completed, is_pinned, due_date, deleted_at, created_at",
      activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
      memoPeriods: "id, daily_entry_id, one_time_task_id, deleted_at",
    });

    this.version(5).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities: "id, group_id, is_archived, deleted_at, created_at",
      dailyEntries: "id, date, is_break_day, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries:
        "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
      oneTimeTasks:
        "id, date, is_completed, is_pinned, due_date, deleted_at, created_at",
      activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
      memoPeriods: "id, daily_entry_id, one_time_task_id, deleted_at",
    });

    this.version(6)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, is_archived, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
        memoPeriods: "id, daily_entry_id, one_time_task_id, deleted_at",
      })
      .upgrade(async (tx) => {
        await tx
          .table("journalEntries")
          .toCollection()
          .modify((entry: Record<string, unknown>) => {
            const legacyPath = normalizeLegacyVideoPath(entry.youtube_url);
            const currentPath = normalizeLegacyVideoPath(entry.video_path);
            entry.video_path = currentPath ?? legacyPath;
            if ("youtube_url" in entry) {
              delete entry.youtube_url;
            }
          });
      });

    this.version(7)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, is_archived, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
      })
      .upgrade(async (tx) => {
        await tx.table("memoPeriods").clear();
        await tx
          .table("dailyEntries")
          .toCollection()
          .modify((row) => {
            delete (row as Record<string, unknown>).current_memo_id;
          });
      });

    this.version(8)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, is_archived, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
      })
      .upgrade(async (tx) => {
        await tx
          .table("journalEntries")
          .toCollection()
          .modify((entry: Record<string, unknown>) => {
            const location = entry.location;
            if (!location || typeof location !== "object") return;
            if (!("transitionTimes" in (location as Record<string, unknown>))) {
              return;
            }
            const normalizedLocation = {
              ...(location as Record<string, unknown>),
            };
            delete normalizedLocation.transitionTimes;
            entry.location = normalizedLocation;
          });
      });

    this.version(9)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, is_archived, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
      })
      .upgrade(async (tx) => {
        await tx
          .table("journalEntries")
          .toCollection()
          .modify((entry: Record<string, unknown>) => {
            const normalizedLocation = normalizeLegacyLocationRoute(entry.location);
            entry.location = normalizedLocation;
          });
      });

    this.version(10).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities: "id, group_id, is_archived, deleted_at, created_at",
      dailyEntries: "id, date, is_break_day, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries:
        "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
      oneTimeTasks:
        "id, date, is_completed, is_pinned, due_date, category_id, deleted_at, created_at",
      activityStreaks:
        "id, activity_id, date, [activity_id+date], deleted_at",
      memoCategories: "id, name, deleted_at, created_at",
    });

    this.version(11)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, is_archived, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
        memoCategories: null,
      })
      .upgrade(async (tx) => {
        await tx
          .table("oneTimeTasks")
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            if ("category_id" in row) {
              delete row.category_id;
            }
            if (!("group_id" in row)) {
              row.group_id = null;
            }
          });
      });

    this.version(12)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, is_archived, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
        memoCategories: null,
      })
      .upgrade(async (tx) => {
        await tx
          .table("activityGroups")
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            row.emoji = null;
          });
        await tx
          .table("oneTimeTasks")
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            row.group_id = null;
          });
      });

    // v13: add completed_at to activities (mark habit as "done", distinct from archived)
    this.version(13)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities:
          "id, group_id, is_archived, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
      })
      .upgrade(async (tx) => {
        await tx
          .table("activities")
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            if (!("completed_at" in row)) {
              row.completed_at = null;
            }
          });
      });

    // v14: promises / accountability tables (legacy schema — superseded by v15)
    this.version(14).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities:
        "id, group_id, is_archived, completed_at, deleted_at, created_at",
      dailyEntries: "id, date, is_break_day, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries:
        "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
      oneTimeTasks:
        "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
      activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
      promises: "id, creator_id, status, created_at",
      promiseMembers:
        "id, promise_id, user_id, role, invite_status, [promise_id+user_id]",
      promiseProgressEvents: "id, promise_id, user_id, date, kind, created_at",
      promiseReactions:
        "id, promise_id, from_user_id, to_user_id, created_at",
      promiseInvites: "id, promise_id, token, created_at",
      userProfiles: "user_id",
    });

    // v15: simplified goals schema — drop promiseReactions, promiseInvites;
    // update promiseMembers index (removed role/kind columns)
    this.version(15).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities:
        "id, group_id, is_archived, completed_at, deleted_at, created_at",
      dailyEntries: "id, date, is_break_day, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries:
        "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
      oneTimeTasks:
        "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
      activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
      promises: "id, creator_id, status, created_at",
      promiseMembers:
        "id, promise_id, user_id, invite_status, [promise_id+user_id]",
      promiseProgressEvents: "id, promise_id, user_id, date, created_at",
      promiseReactions: null,
      promiseInvites: null,
      userProfiles: "user_id",
    });

    // v16: remove is_archived from activities — archive is group-only (derived at read time)
    this.version(16)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities:
          "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
        promises: "id, creator_id, status, created_at",
        promiseMembers:
          "id, promise_id, user_id, invite_status, [promise_id+user_id]",
        promiseProgressEvents: "id, promise_id, user_id, date, created_at",
        promiseReactions: null,
        promiseInvites: null,
        userProfiles: "user_id",
      })
      .upgrade(async (tx) => {
        await tx
          .table("activities")
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            delete row.is_archived;
          });
      });

    // v17: append-only status event tables for date-aware visibility
    this.version(17)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities:
          "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
        activityStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        groupStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        promises: "id, creator_id, status, created_at",
        promiseMembers:
          "id, promise_id, user_id, invite_status, [promise_id+user_id]",
        promiseProgressEvents: "id, promise_id, user_id, date, created_at",
        promiseReactions: null,
        promiseInvites: null,
        userProfiles: "user_id",
      })
      .upgrade(async (tx) => {
        const timestamp = new Date().toISOString();
        const activityEvents: ActivityStatusEvent[] = [];
        const groupEvents: GroupStatusEvent[] = [];

        await tx.table("activities").each((activity: Activity) => {
          if (activity.completed_at) {
            const actionDay = startOfDay(new Date(activity.completed_at));
            activityEvents.push({
              id: uuidv4(),
              entity_id: activity.id,
              status_type: "completed",
              next_value: true,
              effective_at: shiftDate(actionDay, 1).toISOString(),
              created_at: timestamp,
              updated_at: timestamp,
              synced_at: null,
              deleted_at: null,
            });
          }
          if (activity.deleted_at) {
            const actionDay = startOfDay(new Date(activity.deleted_at));
            activityEvents.push({
              id: uuidv4(),
              entity_id: activity.id,
              status_type: "deleted",
              next_value: true,
              effective_at: actionDay.toISOString(),
              created_at: timestamp,
              updated_at: timestamp,
              synced_at: null,
              deleted_at: null,
            });
          }
        });

        await tx.table("activityGroups").each((group: ActivityGroup) => {
          if (group.is_archived) {
            const ref = group.updated_at || group.created_at;
            const actionDay = startOfDay(new Date(ref));
            groupEvents.push({
              id: uuidv4(),
              entity_id: group.id,
              status_type: "archived",
              next_value: true,
              effective_at: shiftDate(actionDay, 1).toISOString(),
              created_at: timestamp,
              updated_at: timestamp,
              synced_at: null,
              deleted_at: null,
            });
          }
          if (group.deleted_at) {
            const actionDay = startOfDay(new Date(group.deleted_at));
            groupEvents.push({
              id: uuidv4(),
              entity_id: group.id,
              status_type: "deleted",
              next_value: true,
              effective_at: actionDay.toISOString(),
              created_at: timestamp,
              updated_at: timestamp,
              synced_at: null,
              deleted_at: null,
            });
          }
        });

        if (activityEvents.length > 0) {
          await tx.table("activityStatusEvents").bulkAdd(activityEvents);
        }
        if (groupEvents.length > 0) {
          await tx.table("groupStatusEvents").bulkAdd(groupEvents);
        }
      });

    // v18: deleted status hides from action day (today inclusive), not next day
    this.version(18)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities:
          "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
        activityStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        groupStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        promises: "id, creator_id, status, created_at",
        promiseMembers:
          "id, promise_id, user_id, invite_status, [promise_id+user_id]",
        promiseProgressEvents: "id, promise_id, user_id, date, created_at",
        promiseReactions: null,
        promiseInvites: null,
        userProfiles: "user_id",
      })
      .upgrade(async (tx) => {
        const activities = await tx.table("activities").toArray();
        const activityById = new Map(
          activities.map((a: Activity) => [a.id, a])
        );
        const groups = await tx.table("activityGroups").toArray();
        const groupById = new Map(
          groups.map((g: ActivityGroup) => [g.id, g])
        );

        await tx
          .table("activityStatusEvents")
          .toCollection()
          .modify((row: ActivityStatusEvent) => {
            if (row.status_type !== "deleted" || !row.next_value) return;
            const activity = activityById.get(row.entity_id);
            if (activity?.deleted_at) {
              row.effective_at = startOfDay(
                new Date(activity.deleted_at)
              ).toISOString();
            }
          });

        await tx
          .table("groupStatusEvents")
          .toCollection()
          .modify((row: GroupStatusEvent) => {
            if (row.status_type !== "deleted" || !row.next_value) return;
            const group = groupById.get(row.entity_id);
            if (group?.deleted_at) {
              row.effective_at = startOfDay(
                new Date(group.deleted_at)
              ).toISOString();
            }
          });
      });

    // v19: drop local promiseMembers — goals use goal_shares in Supabase only
    this.version(19)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities:
          "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
        activityStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        groupStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        promises: "id, user_id, status, created_at",
        promiseMembers: null,
        promiseProgressEvents: "id, promise_id, user_id, date, created_at",
        promiseReactions: null,
        promiseInvites: null,
        userProfiles: "user_id",
      })
      .upgrade(async (tx) => {
        await tx.table("promiseMembers").clear();
      });

    // v20: drop local goals tables; milestones + friend completions are Supabase-only
    this.version(20)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities:
          "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
        activityStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        groupStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        promises: null,
        promiseMembers: null,
        promiseProgressEvents: null,
        promiseReactions: null,
        promiseInvites: null,
        userProfiles: "user_id",
      })
      .upgrade(async (tx) => {
        await tx.table("promises").clear();
        await tx.table("promiseProgressEvents").clear();
      });

    // v21: add photo_paths field to journal entries (stored as array, no index needed)
    this.version(21)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities:
          "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
        activityStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        groupStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        promises: null,
        promiseMembers: null,
        promiseProgressEvents: null,
        promiseReactions: null,
        promiseInvites: null,
        userProfiles: "user_id",
        appLogs: "id, created_at, level",
      })
      .upgrade(async (tx) => {
        await tx
          .table("journalEntries")
          .toCollection()
          .modify((entry: Record<string, unknown>) => {
            if (!("photo_paths" in entry)) {
              entry.photo_paths = null;
            }
          });
      });
  }
}

export const db = new UpwardsDB();

// Helper: current ISO timestamp
export const now = () => new Date().toISOString();

// Helper: new UUID
export const newId = () => uuidv4();
