import { db, now } from "@/lib/db";
import { isUntimedPeriod } from "@/lib/activity/untimed-period";
import {
  enqueueProjectionUpsertForTable,
  OPS_MANAGED_SYNC_TABLES,
  withSuppressedProjectionEnqueue,
} from "./projection-sync";
import { TABLE_MAP } from "./sync-constants";
import {
  naturalDailyEntryIdForDate,
  naturalJournalIdForDate,
} from "./natural-ids";
import {
  pickPreferredJournalEntry,
  mergeJournalEntryDuplicates,
} from "@/lib/journal/dedupe-by-date";
import { listPendingEntityIds } from "./unsynced-data";

const IDENTITY_REPAIR_KEY = "okhabit_natural_identity_repaired_v1";
const CUTOVER_ENQUEUED_KEY = "okhabit_cutover_enqueued_v1";

export function hasRepairedNaturalIdentity(): boolean {
  return localStorage.getItem(IDENTITY_REPAIR_KEY) === "1";
}

export function markNaturalIdentityRepaired(): void {
  localStorage.setItem(IDENTITY_REPAIR_KEY, "1");
}

export function hasEnqueuedCutoverRows(): boolean {
  return localStorage.getItem(CUTOVER_ENQUEUED_KEY) === "1";
}

export function markCutoverRowsEnqueued(): void {
  localStorage.setItem(CUTOVER_ENQUEUED_KEY, "1");
}

export function clearCutoverEnqueueFlag(): void {
  localStorage.removeItem(CUTOVER_ENQUEUED_KEY);
}

async function remapDailyEntries(): Promise<void> {
  const entries = await db.dailyEntries.toArray();
  for (const entry of entries) {
    if (entry.deleted_at) continue;
    const canonical = naturalDailyEntryIdForDate(entry.date);
    if (entry.id === canonical) continue;

    const existingCanonical = await db.dailyEntries.get(canonical);
    const keep = existingCanonical && !existingCanonical.deleted_at
      ? existingCanonical
      : { ...entry, id: canonical };

    await withSuppressedProjectionEnqueue(async () => {
      if (!existingCanonical) {
        await db.dailyEntries.add(keep);
      }
      const periods = await db.activityPeriods
        .where("daily_entry_id")
        .equals(entry.id)
        .toArray();
      for (const period of periods) {
        await db.activityPeriods.update(period.id, {
          daily_entry_id: canonical,
          updated_at: now(),
        });
      }
      await db.dailyEntries.delete(entry.id);
    });
  }

  const remaining = await db.dailyEntries.toArray();
  const byDate = new Map<string, typeof remaining>();
  for (const entry of remaining) {
    if (entry.deleted_at) continue;
    const list = byDate.get(entry.date) ?? [];
    list.push(entry);
    byDate.set(entry.date, list);
  }
  for (const [date, list] of byDate) {
    if (list.length < 2) continue;
    const canonicalId = naturalDailyEntryIdForDate(date);
    const winner =
      list.find((row) => row.id === canonicalId) ?? list[0]!;
    await withSuppressedProjectionEnqueue(async () => {
      for (const extra of list) {
        if (extra.id === winner.id) continue;
        const periods = await db.activityPeriods
          .where("daily_entry_id")
          .equals(extra.id)
          .toArray();
        for (const period of periods) {
          await db.activityPeriods.update(period.id, {
            daily_entry_id: winner.id,
            updated_at: now(),
          });
        }
        await db.dailyEntries.delete(extra.id);
      }
    });
  }
}

async function remapJournals(): Promise<void> {
  const entries = await db.journalEntries.toArray();
  const byDate = new Map<string, typeof entries>();
  for (const entry of entries) {
    if (entry.deleted_at) continue;
    const list = byDate.get(entry.entry_date) ?? [];
    list.push(entry);
    byDate.set(entry.entry_date, list);
  }

  for (const [date, list] of byDate) {
    const canonicalId = naturalJournalIdForDate(date);
    const preferred = pickPreferredJournalEntry(list, canonicalId);
    if (!preferred) continue;
    // Fold the other rows' fields in rather than dropping them: richness
    // scoring picks a single winner, so an entry that only had photos could
    // otherwise lose its media to one that only had text.
    let merged = preferred;
    for (const other of list) {
      if (other.id === preferred.id) continue;
      merged = mergeJournalEntryDuplicates(merged, other);
    }
    const winner = { ...merged, id: canonicalId };
    await withSuppressedProjectionEnqueue(async () => {
      if (preferred.id !== canonicalId) {
        const existing = await db.journalEntries.get(canonicalId);
        if (existing) {
          await db.journalEntries.put({
            ...winner,
            updated_at: now(),
          });
        } else {
          await db.journalEntries.add({ ...winner, updated_at: now() });
        }
      } else {
        await db.journalEntries.put({ ...winner, updated_at: now() });
      }
      for (const extra of list) {
        if (extra.id === canonicalId) continue;
        await db.journalEntries.update(extra.id, {
          deleted_at: now(),
          updated_at: now(),
        });
      }
    });
    const canonical = await db.journalEntries.get(canonicalId);
    if (canonical) {
      await enqueueProjectionUpsertForTable(
        "journal_entries",
        canonical as unknown as Record<string, unknown>,
        null
      );
    }
  }
}

export async function repairNaturalIdentity(): Promise<void> {
  if (hasRepairedNaturalIdentity()) return;
  await remapDailyEntries();
  await remapJournals();
  await dropLocalUntimedPeriods();
  markNaturalIdentityRepaired();
}

/**
 * Re-keys local rows onto the signed-in user's natural IDs.
 *
 * Natural IDs are derived from `guest:<deviceId>` before sign-in and `userId`
 * after, so every row a guest wrote carries an id no signed-in device will ever
 * compute. The `upload_local` handoff pushed them as-is, and the next time that
 * date was touched while signed in a *second* row appeared under the canonical id.
 * That is what manufactured the duplicate `(user, date)` rows the journal dedupe
 * then had to destroy something to clean up.
 *
 * Same remapping as the one-shot cutover above, minus its flag: this has to run at
 * the moment of sign-in, which is normally long after that flag is set.
 */
export async function rekeyLocalRowsToCurrentUser(): Promise<void> {
  await remapDailyEntries();
  await remapJournals();
}

async function dropLocalUntimedPeriods(): Promise<void> {
  const periods = await db.activityPeriods.toArray();
  const untimedIds = periods
    .filter((period) => isUntimedPeriod(period.start_time, period.end_time))
    .map((period) => period.id);
  if (untimedIds.length === 0) return;
  await withSuppressedProjectionEnqueue(async () => {
    await db.activityPeriods.bulkDelete(untimedIds);
  });
}

export async function enqueueUnsyncedCurrentStateRows(): Promise<void> {
  if (hasEnqueuedCutoverRows()) return;
  const pendingIds = await listPendingEntityIds();
  for (const table of OPS_MANAGED_SYNC_TABLES) {
    const dexieTable = TABLE_MAP[table];
    const rows: Array<Record<string, unknown>> = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db[dexieTable] as any
    ).toArray();
    for (const row of rows) {
      const syncedAt = typeof row.synced_at === "string" ? row.synced_at : null;
      const updatedAt =
        typeof row.updated_at === "string" ? row.updated_at : null;
      if (syncedAt && updatedAt && updatedAt <= syncedAt) continue;
      if (table === "activity_periods") {
        const start = typeof row.start_time === "string" ? row.start_time : "";
        const end = typeof row.end_time === "string" ? row.end_time : null;
        if (end && start === end) continue;
        if (isUntimedPeriod(start, end)) continue;
      }
      // journal_entries is UNIQUE(user_id, entry_date) on the server, so a
      // local duplicate tombstone would collapse onto the surviving row for
      // that date and delete real content. The canonical row is enqueued by
      // remapJournals; these locally-superseded rows must not be pushed.
      if (table === "journal_entries" && row.deleted_at) continue;
      const id = typeof row.id === "string" ? row.id : null;
      if (id && pendingIds.has(id)) continue;
      await enqueueProjectionUpsertForTable(table, row, null);
      if (id) pendingIds.add(id);
    }
  }
  markCutoverRowsEnqueued();
}
