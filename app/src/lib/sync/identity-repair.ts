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
import { pickPreferredJournalEntry } from "@/lib/journal/dedupe-by-date";

const IDENTITY_REPAIR_KEY = "okhabit_natural_identity_repaired_v1";

export function hasRepairedNaturalIdentity(): boolean {
  return localStorage.getItem(IDENTITY_REPAIR_KEY) === "1";
}

export function markNaturalIdentityRepaired(): void {
  localStorage.setItem(IDENTITY_REPAIR_KEY, "1");
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
    const winner = { ...preferred, id: canonicalId };
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
  for (const table of OPS_MANAGED_SYNC_TABLES) {
    const dexieTable = TABLE_MAP[table];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: Array<Record<string, unknown>> = await (
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
      await enqueueProjectionUpsertForTable(table, row, null);
    }
  }
}
