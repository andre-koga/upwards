import Dexie, { type Table } from "dexie";
import { v4 as uuidv4 } from "uuid";
import type {
  ActivityGroup,
  Activity,
  DailyEntry,
  ActivityPeriod,
  JournalEntry,
  OneTimeTask,
  RecurringMemo,
  ActivityStreak,
  ActivityStatusEvent,
  GroupStatusEvent,
  AppLog,
  SyncPendingOperation,
  SyncIssue,
  SyncDeviceRecord,
  ActivityDefinitionVersion,
  GroupDefinitionVersion,
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

function normalizeLegacyLocationRoute(
  raw: unknown
): { locations: unknown[] } | null {
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
  recurringMemos!: Table<RecurringMemo>;
  activityStreaks!: Table<ActivityStreak>;
  activityStatusEvents!: Table<ActivityStatusEvent>;
  groupStatusEvents!: Table<GroupStatusEvent>;
  appLogs!: Table<AppLog>;
  syncPendingOperations!: Table<SyncPendingOperation>;
  syncIssues!: Table<SyncIssue>;
  syncDevices!: Table<SyncDeviceRecord>;
  activityDefinitionVersions!: Table<ActivityDefinitionVersion>;
  groupDefinitionVersions!: Table<GroupDefinitionVersion>;

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
            const normalizedLocation = normalizeLegacyLocationRoute(
              entry.location
            );
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
      activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
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
      promiseReactions: "id, promise_id, from_user_id, to_user_id, created_at",
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
        activities: "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
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
        activities: "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
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
        activities: "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
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
        const groupById = new Map(groups.map((g: ActivityGroup) => [g.id, g]));

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
        activities: "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
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

    // v20: drop local goals tables
    this.version(20)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
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
        activities: "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
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

    // v22: recurring memo presets + link from spawned one_time_tasks
    this.version(22)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, recurring_memo_id, deleted_at, created_at",
        recurringMemos: "id, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
        activityStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        groupStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        userProfiles: "user_id",
        appLogs: "id, created_at, level",
      })
      .upgrade(async (tx) => {
        await tx
          .table("oneTimeTasks")
          .toCollection()
          .modify((task: Record<string, unknown>) => {
            if (!("recurring_memo_id" in task)) {
              task.recurring_memo_id = null;
            }
          });
      });

    // v23: local sync queue, issues, and device registry (not pushed to Supabase yet)
    this.version(23).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities: "id, group_id, completed_at, deleted_at, created_at",
      dailyEntries: "id, date, is_break_day, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries:
        "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
      oneTimeTasks:
        "id, date, is_completed, is_pinned, due_date, group_id, recurring_memo_id, deleted_at, created_at",
      recurringMemos: "id, deleted_at, created_at",
      activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
      activityStatusEvents:
        "id, entity_id, status_type, effective_at, deleted_at",
      groupStatusEvents: "id, entity_id, status_type, effective_at, deleted_at",
      userProfiles: "user_id",
      appLogs: "id, created_at, level",
      syncPendingOperations:
        "id, operation_id, status, account_id, device_id, created_at",
      syncIssues: "id, kind, status, account_id, created_at",
      syncDevices: "id, account_id, last_seen_at, retired_at",
    });

    // v24: immutable activity/group definition versions (local authoritative history)
    this.version(24)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, completed_at, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, recurring_memo_id, deleted_at, created_at",
        recurringMemos: "id, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
        activityStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        groupStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        userProfiles: "user_id",
        appLogs: "id, created_at, level",
        syncPendingOperations:
          "id, operation_id, status, account_id, device_id, created_at",
        syncIssues: "id, kind, status, account_id, created_at",
        syncDevices: "id, account_id, last_seen_at, retired_at",
        activityDefinitionVersions:
          "id, activity_id, effective_from, recorded_at, operation_id, deleted_at",
        groupDefinitionVersions:
          "id, group_id, effective_from, recorded_at, operation_id, deleted_at",
      })
      .upgrade(async (tx) => {
        const deviceIdKey = "okhabit:device_id";
        let deviceId =
          typeof localStorage !== "undefined"
            ? localStorage.getItem(deviceIdKey)
            : null;
        if (!deviceId) {
          deviceId = uuidv4();
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(deviceIdKey, deviceId);
          }
        }

        const recordedAt = new Date().toISOString();
        const toLogicalDay = (iso: string) => {
          const d = new Date(iso);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        const activities = await tx.table("activities").toArray();
        for (const activity of activities as Array<Record<string, unknown>>) {
          if (activity.deleted_at) continue;
          const createdAt =
            typeof activity.created_at === "string"
              ? activity.created_at
              : recordedAt;
          await tx.table("activityDefinitionVersions").add({
            id: uuidv4(),
            activity_id: activity.id,
            parent_version_id: null,
            effective_from: toLogicalDay(createdAt),
            recorded_at: recordedAt,
            server_sequence: null,
            operation_id: uuidv4(),
            device_id: deviceId,
            name: activity.name ?? null,
            routine: activity.routine ?? null,
            completion_target: activity.completion_target ?? null,
            group_id: activity.group_id,
            order_index: activity.order_index ?? null,
            schema_version: 1,
            created_at: recordedAt,
            deleted_at: null,
          });
        }

        const groups = await tx.table("activityGroups").toArray();
        for (const group of groups as Array<Record<string, unknown>>) {
          if (group.deleted_at) continue;
          const createdAt =
            typeof group.created_at === "string"
              ? group.created_at
              : recordedAt;
          await tx.table("groupDefinitionVersions").add({
            id: uuidv4(),
            group_id: group.id,
            parent_version_id: null,
            effective_from: toLogicalDay(createdAt),
            recorded_at: recordedAt,
            server_sequence: null,
            operation_id: uuidv4(),
            device_id: deviceId,
            name: group.name,
            color: group.color ?? null,
            order_index: group.order_index ?? null,
            schema_version: 1,
            created_at: recordedAt,
            deleted_at: null,
          });
        }
      });

    // v25: drop unused local userProfiles (locale lives on Supabase)
    this.version(25).stores({
      activityGroups: "id, name, is_archived, deleted_at, created_at",
      activities: "id, group_id, completed_at, deleted_at, created_at",
      dailyEntries: "id, date, is_break_day, deleted_at",
      activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
      journalEntries:
        "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
      oneTimeTasks:
        "id, date, is_completed, is_pinned, due_date, group_id, recurring_memo_id, deleted_at, created_at",
      recurringMemos: "id, deleted_at, created_at",
      activityStreaks: "id, activity_id, date, [activity_id+date], deleted_at",
      activityStatusEvents:
        "id, entity_id, status_type, effective_at, deleted_at",
      groupStatusEvents: "id, entity_id, status_type, effective_at, deleted_at",
      userProfiles: null,
      appLogs: "id, created_at, level",
      syncPendingOperations:
        "id, operation_id, status, account_id, device_id, created_at",
      syncIssues: "id, kind, status, account_id, created_at",
      syncDevices: "id, account_id, last_seen_at, retired_at",
      activityDefinitionVersions:
        "id, activity_id, effective_from, recorded_at, operation_id, deleted_at",
      groupDefinitionVersions:
        "id, group_id, effective_from, recorded_at, operation_id, deleted_at",
    });

    // v26: habits archive like groups — restore is_archived, migrate completed_at
    this.version(26)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, is_archived, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, recurring_memo_id, deleted_at, created_at",
        recurringMemos: "id, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
        activityStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        groupStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        userProfiles: null,
        appLogs: "id, created_at, level",
        syncPendingOperations:
          "id, operation_id, status, account_id, device_id, created_at",
        syncIssues: "id, kind, status, account_id, created_at",
        syncDevices: "id, account_id, last_seen_at, retired_at",
        activityDefinitionVersions:
          "id, activity_id, effective_from, recorded_at, operation_id, deleted_at",
        groupDefinitionVersions:
          "id, group_id, effective_from, recorded_at, operation_id, deleted_at",
      })
      .upgrade(async (tx) => {
        await tx
          .table("activities")
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            const completedAt =
              typeof row.completed_at === "string" ? row.completed_at : null;
            row.is_archived = row.is_archived === true || !!completedAt;
          });
      });

    // v27: optional 200-character note on activity periods
    this.version(27)
      .stores({
        activityGroups: "id, name, is_archived, deleted_at, created_at",
        activities: "id, group_id, is_archived, deleted_at, created_at",
        dailyEntries: "id, date, is_break_day, deleted_at",
        activityPeriods: "id, daily_entry_id, activity_id, deleted_at",
        journalEntries:
          "id, entry_date, is_bookmarked, is_journal_complete, journal_entry_number, deleted_at",
        oneTimeTasks:
          "id, date, is_completed, is_pinned, due_date, group_id, recurring_memo_id, deleted_at, created_at",
        recurringMemos: "id, deleted_at, created_at",
        activityStreaks:
          "id, activity_id, date, [activity_id+date], deleted_at",
        activityStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        groupStatusEvents:
          "id, entity_id, status_type, effective_at, deleted_at",
        userProfiles: null,
        appLogs: "id, created_at, level",
        syncPendingOperations:
          "id, operation_id, status, account_id, device_id, created_at",
        syncIssues: "id, kind, status, account_id, created_at",
        syncDevices: "id, account_id, last_seen_at, retired_at",
        activityDefinitionVersions:
          "id, activity_id, effective_from, recorded_at, operation_id, deleted_at",
        groupDefinitionVersions:
          "id, group_id, effective_from, recorded_at, operation_id, deleted_at",
      })
      .upgrade(async (tx) => {
        await tx
          .table("activityPeriods")
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            if (typeof row.note !== "string") {
              row.note = null;
              return;
            }
            const trimmed = row.note.trim();
            row.note = trimmed ? trimmed.slice(0, 200) : null;
          });
      });
  }
}

export const db = new UpwardsDB();

// Helper: current ISO timestamp
export const now = () => new Date().toISOString();

// Helper: new UUID
export const newId = () => uuidv4();
