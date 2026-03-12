import type { SupabaseClient } from "@supabase/supabase-js";
import { db, newId } from "@/lib/db";
import type { SyncTable } from "./sync-transformers";
import { isValidUuid } from "./sync-transformers";

/**
 * Allowed columns per Supabase table. Legacy keys not in this set are stripped
 * before upsert so sync continues to work when local data has old schema fields.
 * Keep in sync with supabase/migrations/ when adding new columns.
 */
const ALLOWED_COLUMNS: Record<SyncTable, Set<string>> = {
  activity_groups: new Set([
    "id",
    "user_id",
    "name",
    "emoji",
    "color",
    "order_index",
    "is_archived",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  activities: new Set([
    "id",
    "user_id",
    "group_id",
    "name",
    "pattern",
    "routine",
    "completion_target",
    "color",
    "is_archived",
    "order_index",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  daily_entries: new Set([
    "id",
    "user_id",
    "date",
    "task_counts",
    "current_activity_id",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  activity_periods: new Set([
    "id",
    "user_id",
    "daily_entry_id",
    "activity_id",
    "start_time",
    "end_time",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  journal_entries: new Set([
    "id",
    "user_id",
    "entry_date",
    "title",
    "text_content",
    "day_emoji",
    "is_bookmarked",
    "youtube_url",
    "is_journal_complete",
    "journal_entry_number",
    "journal_completion_streak",
    "journal_completed_at",
    "location",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  one_time_tasks: new Set([
    "id",
    "user_id",
    "date",
    "title",
    "is_completed",
    "order_index",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
  activity_streaks: new Set([
    "id",
    "user_id",
    "activity_id",
    "date",
    "streak",
    "created_at",
    "updated_at",
    "deleted_at",
  ]),
};

/**
 * Strips legacy/unknown columns from rows before upsert. Only columns present in
 * the Supabase schema are kept. This makes sync resilient to local data with
 * old schema fields.
 */
export function stripUnknownColumns(
  table: SyncTable,
  rows: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  const allowed = ALLOWED_COLUMNS[table];
  const result: Array<Record<string, unknown>> = [];
  let strippedCount = 0;

  for (const row of rows) {
    const stripped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (allowed.has(key)) {
        stripped[key] = value;
      } else {
        strippedCount += 1;
      }
    }
    result.push(stripped);
  }

  if (strippedCount > 0) {
    console.warn(
      `[sync] stripped ${strippedCount} legacy column(s) from ${table} before upsert`
    );
  }

  return result;
}

export async function sanitizeForeignKeyRefsBeforeUpsert(
  supabaseClient: SupabaseClient | null,
  table: SyncTable,
  rows: Array<Record<string, unknown>>,
  userId: string
): Promise<Array<Record<string, unknown>>> {
  if (rows.length === 0) return rows;
  if (!supabaseClient) return rows;

  let result = rows;

  if (table === "activity_periods" || table === "activity_streaks") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activityIdsRaw: any[] = await (db.activities as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((a: any) => !a.deleted_at)
      .primaryKeys();
    const validActivityIds = new Set(
      activityIdsRaw.map((id) => String(id)).filter((id) => isValidUuid(id))
    );

    let missingActivityRefCount = 0;
    result = result.map((row) => {
      if (!row.activity_id || !isValidUuid(row.activity_id)) {
        return row;
      }
      if (validActivityIds.has(row.activity_id)) {
        return row;
      }
      missingActivityRefCount += 1;
      return { ...row, activity_id: null };
    });

    if (missingActivityRefCount > 0) {
      console.warn(
        `[sync] nulled ${missingActivityRefCount} missing activity_id reference(s) on ${table}`
      );
    }

    const referencedActivityIds = Array.from(
      new Set(
        result
          .map((row) => row.activity_id)
          .filter((id): id is string => isValidUuid(id))
      )
    );

    if (referencedActivityIds.length > 0) {
      const { data: remoteActivities, error: remoteActivitiesError } =
        await supabaseClient
          .from("activities")
          .select("id")
          .eq("user_id", userId)
          .in("id", referencedActivityIds);

      if (!remoteActivitiesError) {
        const remoteActivityIds = new Set(
          (remoteActivities ?? []).map((a) => a.id)
        );

        let missingRemoteActivityRefCount = 0;
        result = result.map((row) => {
          if (!row.activity_id || !isValidUuid(row.activity_id)) {
            return row;
          }
          if (remoteActivityIds.has(row.activity_id)) {
            return row;
          }
          missingRemoteActivityRefCount += 1;
          return { ...row, activity_id: null };
        });

        if (missingRemoteActivityRefCount > 0) {
          console.warn(
            `[sync] nulled ${missingRemoteActivityRefCount} non-existent remote activity_id reference(s) on ${table}`
          );
        }
      }
    }
  }

  if (table === "activity_periods") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dailyEntryIdsRaw: any[] = await (db.dailyEntries as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((d: any) => !d.deleted_at)
      .primaryKeys();
    const validDailyEntryIds = new Set(
      dailyEntryIdsRaw.map((id) => String(id)).filter((id) => isValidUuid(id))
    );

    let missingDailyEntryRefCount = 0;
    result = result.map((row) => {
      if (!row.daily_entry_id || !isValidUuid(row.daily_entry_id)) {
        return row;
      }
      if (validDailyEntryIds.has(row.daily_entry_id)) {
        return row;
      }
      missingDailyEntryRefCount += 1;
      return { ...row, daily_entry_id: null };
    });

    if (missingDailyEntryRefCount > 0) {
      console.warn(
        `[sync] nulled ${missingDailyEntryRefCount} missing daily_entry_id reference(s) on ${table}`
      );
    }

    const referencedDailyEntryIds = Array.from(
      new Set(
        result
          .map((row) => row.daily_entry_id)
          .filter((id): id is string => isValidUuid(id))
      )
    );

    if (referencedDailyEntryIds.length > 0) {
      const { data: remoteDailyEntries, error: remoteDailyEntriesError } =
        await supabaseClient
          .from("daily_entries")
          .select("id")
          .eq("user_id", userId)
          .in("id", referencedDailyEntryIds);

      if (!remoteDailyEntriesError) {
        const remoteDailyEntryIds = new Set(
          (remoteDailyEntries ?? []).map((d) => d.id)
        );

        let missingRemoteDailyEntryRefCount = 0;
        result = result.map((row) => {
          if (!row.daily_entry_id || !isValidUuid(row.daily_entry_id)) {
            return row;
          }
          if (remoteDailyEntryIds.has(row.daily_entry_id)) {
            return row;
          }
          missingRemoteDailyEntryRefCount += 1;
          return { ...row, daily_entry_id: null };
        });

        if (missingRemoteDailyEntryRefCount > 0) {
          console.warn(
            `[sync] nulled ${missingRemoteDailyEntryRefCount} non-existent remote daily_entry_id reference(s) on ${table}`
          );
        }
      }
    }
  }

  return result;
}

export async function normalizeActivityStreakIdsBeforeUpsert(
  supabaseClient: SupabaseClient | null,
  table: SyncTable,
  rows: Array<Record<string, unknown>>,
  userId: string
): Promise<Array<Record<string, unknown>>> {
  if (table !== "activity_streaks" || rows.length === 0) return rows;
  if (!supabaseClient) return rows;

  const { data: remoteStreaks, error } = await supabaseClient
    .from("activity_streaks")
    .select("id, activity_id, date")
    .eq("user_id", userId);

  if (error) {
    return rows;
  }

  const remoteCompositeToId = new Map<string, string>();
  const remoteIdToComposite = new Map<string, string>();

  for (const row of remoteStreaks ?? []) {
    const activityId = row.activity_id;
    const date = row.date;
    if (!isValidUuid(activityId) || typeof date !== "string") continue;
    const key = `${activityId}|${date}`;
    remoteCompositeToId.set(key, row.id);
    remoteIdToComposite.set(row.id, key);
  }

  const usedIds = new Set<string>(remoteIdToComposite.keys());
  const normalizedRows: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const activityId = row.activity_id;
    const date = row.date;
    if (!isValidUuid(activityId) || typeof date !== "string") {
      normalizedRows.push(row);
      continue;
    }

    const compositeKey = `${activityId}|${date}`;
    const existingCompositeId = remoteCompositeToId.get(compositeKey);
    if (existingCompositeId) {
      normalizedRows.push({ ...row, id: existingCompositeId });
      usedIds.add(existingCompositeId);
      continue;
    }

    const rowId = row.id;
    const needsFreshId =
      !isValidUuid(rowId) ||
      usedIds.has(rowId) ||
      Boolean(
        remoteIdToComposite.get(rowId) &&
        remoteIdToComposite.get(rowId) !== compositeKey
      );

    if (needsFreshId) {
      let generatedId = newId();
      while (usedIds.has(generatedId)) {
        generatedId = newId();
      }
      usedIds.add(generatedId);
      normalizedRows.push({ ...row, id: generatedId });
      continue;
    }

    usedIds.add(rowId);
    normalizedRows.push(row);
  }

  return normalizedRows;
}
