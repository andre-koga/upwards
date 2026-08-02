import { db } from "@/lib/db";
import { supabase, getCachedUserId } from "@/lib/supabase";
import { isTransientNetworkError, logError } from "@/lib/error-utils";
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
import {
  isOpOwnedProjectionTable,
  stripOpOwnedFields,
} from "./op-owned-fields";
import { OPS_MANAGED_SYNC_TABLES } from "./projection-sync";
import { listOpenConflictEntityIds } from "./sync-issues-store";

export interface PushInternalContext {
  withLocalSyncMetadataWrites: <T>(operation: () => Promise<T>) => Promise<T>;
}

export async function runPushInternal(
  ctx: PushInternalContext,
  options: {
    /** When true, strip op-owned fields so LWW cannot undo sequence merges. */
    opsSyncActive?: boolean;
  }
): Promise<{
  failedTables: string[];
  /** At least one failure was abort/offline noise. */
  hadTransientFailure: boolean;
  /** At least one failure was durable (auth, schema, validation, etc.). */
  hadDurableFailure: boolean;
}> {
  const { opsSyncActive = false } = options;
  const failedTables: string[] = [];
  let hadTransientFailure = false;
  let hadDurableFailure = false;
  if (!supabase) {
    return { failedTables, hadTransientFailure, hadDurableFailure };
  }
  const userId = getCachedUserId();
  if (!userId) {
    return { failedTables, hadTransientFailure, hadDurableFailure };
  }

  const conflictEntityIds = opsSyncActive
    ? await listOpenConflictEntityIds()
    : new Set<string>();

  const noteFailure = (table: string, err: unknown) => {
    failedTables.push(table);
    if (isTransientNetworkError(err)) {
      hadTransientFailure = true;
      console.warn(`[sync] transient push failure for ${table}:`, err);
      return;
    }
    hadDurableFailure = true;
    logError(`Sync push failed for table: ${table}`, err);
  };

  for (const table of SYNC_TABLES) {
    if (opsSyncActive && OPS_MANAGED_SYNC_TABLES.includes(table)) {
      continue;
    }

    const dexieTable = TABLE_MAP[table];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let records: any[] = await (db[dexieTable] as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => !r.synced_at || r.updated_at > r.synced_at)
      .toArray();

    if (
      opsSyncActive &&
      (table === "activities" || table === "activity_groups") &&
      conflictEntityIds.size > 0
    ) {
      records = records.filter(
        (r) => !conflictEntityIds.has(String((r as { id: string }).id))
      );
    }

    if (records.length === 0) continue;

    let rows = records
      .map((r) => toRemoteRow(table, r, userId))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (opsSyncActive && isOpOwnedProjectionTable(table)) {
      rows = rows.map((row) => stripOpOwnedFields(table, row));
    }

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
      const nowIso = new Date().toISOString();
      await ctx.withLocalSyncMetadataWrites(async () => {
        await Promise.all(
          records.map((r) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (db[dexieTable] as any).update(r.id, { synced_at: nowIso })
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
        noteFailure(table, error);
        continue;
      }

      const nowIso = new Date().toISOString();
      await ctx.withLocalSyncMetadataWrites(async () => {
        await Promise.all(
          records.map((r) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (db[dexieTable] as any).update(r.id, { synced_at: nowIso })
          )
        );
      });
    } catch (err) {
      noteFailure(table, err);
    }
  }

  return { failedTables, hadTransientFailure, hadDurableFailure };
}
