import { db } from "@/lib/db";
import { supabase, getCachedUserId } from "@/lib/supabase";
import { logError } from "@/lib/error-utils";
import {
  toRemoteRow,
  dedupeRowsForUpsert,
  UPSERT_CONFLICT_TARGET,
  isValidUuid,
} from "./sync-transformers";
import {
  sanitizeForeignKeyRefsBeforeUpsert,
  normalizeActivityStreakIdsBeforeUpsert,
  stripUnknownColumns,
} from "./sanitizers";
import { SYNC_TABLES, TABLE_MAP } from "./sync-constants";

export interface PushInternalContext {
  withLocalSyncMetadataWrites: <T>(operation: () => Promise<T>) => Promise<T>;
}

export async function runPushInternal(
  ctx: PushInternalContext,
  options: { forceAll: boolean }
): Promise<{ failedTables: string[] }> {
  const { forceAll } = options;
  const failedTables: string[] = [];
  if (!supabase) return { failedTables };
  const userId = getCachedUserId();
  if (!userId) return { failedTables };

  for (const table of SYNC_TABLES) {
    const dexieTable = TABLE_MAP[table];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const records: any[] = await (db[dexieTable] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) =>
        forceAll ? true : !r.synced_at || r.updated_at > r.synced_at
      )
      .toArray();

    if (records.length === 0) continue;

    const rows = records
      .map((r) => toRemoteRow(table, r, userId))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const dedupedRows = dedupeRowsForUpsert(table, rows);
    const duplicateCount = rows.length - dedupedRows.length;
    if (duplicateCount > 0) {
      console.warn(
        `[sync] deduped ${duplicateCount} conflicting row(s) on ${table} before upsert`
      );
    }

    const sanitizedRows = await sanitizeForeignKeyRefsBeforeUpsert(
      supabase,
      table,
      dedupedRows,
      userId
    );

    const normalizedRows = await normalizeActivityStreakIdsBeforeUpsert(
      supabase,
      table,
      sanitizedRows,
      userId
    );

    const pushRows =
      table === "activity_streaks"
        ? normalizedRows.filter((row) => isValidUuid(row.activity_id))
        : normalizedRows;

    if (table === "activity_streaks") {
      const skippedNullActivity = normalizedRows.length - pushRows.length;
      if (skippedNullActivity > 0) {
        console.warn(
          `[sync] skipping ${skippedNullActivity} activity_streaks row(s) with null activity_id`
        );
      }
    }

    const skippedCount = records.length - rows.length;
    if (skippedCount > 0) {
      console.warn(
        `[sync] skipped ${skippedCount} invalid row(s) on ${table} due to non-UUID id`
      );
    }

    const schemaSafeRows = stripUnknownColumns(table, pushRows);

    if (schemaSafeRows.length === 0) {
      const now = new Date().toISOString();
      await ctx.withLocalSyncMetadataWrites(async () => {
        await Promise.all(
          records.map((r) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (db[dexieTable] as any).update(r.id, { synced_at: now })
          )
        );
      });
      continue;
    }

    try {
      const { error } = await supabase.from(table).upsert(schemaSafeRows, {
        onConflict: UPSERT_CONFLICT_TARGET[table],
      });

      if (error) {
        failedTables.push(table);
        logError(`Sync push failed for table: ${table}`, new Error(error.message));
        continue;
      }

      const now = new Date().toISOString();
      await ctx.withLocalSyncMetadataWrites(async () => {
        await Promise.all(
          records.map((r) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (db[dexieTable] as any).update(r.id, { synced_at: now })
          )
        );
      });
    } catch (err) {
      failedTables.push(table);
      logError(`Sync push failed for table: ${table}`, err);
    }
  }

  return { failedTables };
}
