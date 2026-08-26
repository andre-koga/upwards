import { db, now } from "@/lib/db";
import type { JournalEntry } from "@/lib/db/types";
import { journalEntryHasContent } from "@/lib/journal/archive";
import {
  enqueueProjectionUpsertForTable,
  withSuppressedProjectionEnqueue,
} from "@/lib/sync/projection-sync";
import {
  mergeJournalLocationRoute,
  parseJournalLocationRoute,
} from "@/lib/journal/utils";

export async function listActiveJournalEntriesForDate(
  entryDate: string
): Promise<JournalEntry[]> {
  return db.journalEntries
    .where("entry_date")
    .equals(entryDate)
    .filter((entry) => !entry.deleted_at)
    .toArray();
}

function journalEntryRichnessScore(entry: JournalEntry): number {
  let score = 0;
  if (entry.title?.trim()) score += 4;
  if (entry.text_content?.trim()) score += 8;
  if (entry.day_emoji?.trim()) score += 2;
  if (entry.video_path?.trim()) score += 4;
  if (entry.photo_paths?.length) score += 4 + entry.photo_paths.length;
  if (entry.location?.locations?.length) {
    score += 2 + entry.location.locations.length;
  }
  if (entry.is_bookmarked) score += 1;
  if (entry.is_journal_complete) score += 2;
  if (entry.synced_at) score += 1;
  return score;
}

export function pickPreferredJournalEntry(
  entries: JournalEntry[],
  preferredId?: string
): JournalEntry | null {
  if (entries.length === 0) return null;
  if (entries.length === 1) return entries[0]!;

  const sorted = [...entries].sort((a, b) => {
    if (preferredId) {
      if (a.id === preferredId && b.id !== preferredId) return -1;
      if (b.id === preferredId && a.id !== preferredId) return 1;
    }

    const scoreDiff = journalEntryRichnessScore(b) - journalEntryRichnessScore(a);
    if (scoreDiff !== 0) return scoreDiff;

    const syncedDiff = Number(Boolean(b.synced_at)) - Number(Boolean(a.synced_at));
    if (syncedDiff !== 0) return syncedDiff;

    const timeDiff = Date.parse(b.updated_at) - Date.parse(a.updated_at);
    if (timeDiff !== 0) return timeDiff;

    return a.id.localeCompare(b.id);
  });

  return sorted[0]!;
}

function mergeTextField(
  winner: string | null | undefined,
  loser: string | null | undefined
): string | null {
  const winnerText = winner?.trim();
  if (winnerText) return winner ?? null;
  const loserText = loser?.trim();
  return loserText ? (loser ?? null) : null;
}

function mergePhotoPaths(
  winner: string[] | null | undefined,
  loser: string[] | null | undefined
): string[] | null {
  const merged = new Set<string>();
  for (const path of winner ?? []) {
    if (path?.trim()) merged.add(path);
  }
  for (const path of loser ?? []) {
    if (path?.trim()) merged.add(path);
  }
  return merged.size > 0 ? [...merged] : null;
}

function mergeLocationRoutes(
  winner: JournalEntry["location"],
  loser: JournalEntry["location"]
): JournalEntry["location"] {
  let route = parseJournalLocationRoute(winner);
  for (const place of parseJournalLocationRoute(loser).locations) {
    route = mergeJournalLocationRoute(route, place);
  }
  return route.locations.length > 0 ? route : null;
}

export function mergeJournalEntryDuplicates(
  winner: JournalEntry,
  loser: JournalEntry
): JournalEntry {
  const mergedLocation = mergeLocationRoutes(winner.location, loser.location);
  const winnerComplete = Boolean(winner.is_journal_complete);
  const loserComplete = Boolean(loser.is_journal_complete);

  return {
    ...winner,
    title: mergeTextField(winner.title, loser.title),
    text_content: mergeTextField(winner.text_content, loser.text_content),
    day_emoji: mergeTextField(winner.day_emoji, loser.day_emoji),
    video_path: mergeTextField(winner.video_path, loser.video_path),
    video_thumbnail: mergeTextField(winner.video_thumbnail, loser.video_thumbnail),
    photo_paths: mergePhotoPaths(winner.photo_paths, loser.photo_paths),
    location: mergedLocation,
    is_bookmarked: Boolean(winner.is_bookmarked || loser.is_bookmarked),
    is_journal_complete: winnerComplete || loserComplete,
    journal_entry_number:
      winner.journal_entry_number ?? loser.journal_entry_number ?? null,
    journal_completion_streak:
      winner.journal_completion_streak ?? loser.journal_completion_streak ?? null,
    journal_completed_at:
      winner.journal_completed_at ?? loser.journal_completed_at ?? null,
  };
}

async function dropPendingJournalOpsForEntity(entityId: string): Promise<void> {
  const pending = await db.syncPendingOperations
    .filter(
      (op) =>
        op.entity_type === "journal_entry" &&
        op.entity_id === entityId &&
        op.status === "pending"
    )
    .toArray();

  if (pending.length === 0) return;
  await db.syncPendingOperations.bulkDelete(pending.map((op) => op.id));
}

export async function reconcileJournalDuplicatesForDate(
  entryDate: string,
  options?: { preferredId?: string; suppressSync?: boolean }
): Promise<JournalEntry | null> {
  const entries = await listActiveJournalEntriesForDate(entryDate);
  if (entries.length <= 1) {
    return entries[0] ?? null;
  }

  const winner = pickPreferredJournalEntry(entries, options?.preferredId);
  if (!winner) return null;

  const losers = entries.filter((entry) => entry.id !== winner.id);
  let merged = winner;
  for (const loser of losers) {
    merged = mergeJournalEntryDuplicates(merged, loser);
  }

  const ts = now();
  merged = { ...merged, updated_at: ts };

  await withSuppressedProjectionEnqueue(async () => {
    await db.journalEntries.put(merged);
    for (const loser of losers) {
      await dropPendingJournalOpsForEntity(loser.id);
      if (loser.synced_at) {
        await db.journalEntries.update(loser.id, {
          deleted_at: ts,
          updated_at: ts,
        });
      } else {
        await db.journalEntries.delete(loser.id);
      }
    }
  });

  if (!options?.suppressSync) {
    await enqueueProjectionUpsertForTable(
      "journal_entries",
      merged as unknown as Record<string, unknown>,
      merged.updated_at
    );
    for (const loser of losers) {
      if (!loser.synced_at) continue;
      await enqueueProjectionUpsertForTable(
        "journal_entries",
        {
          ...(loser as unknown as Record<string, unknown>),
          deleted_at: ts,
          updated_at: ts,
        },
        loser.updated_at
      );
    }
  }

  return merged;
}

/** Repair any local days that still have multiple active journal rows. */
export async function reconcileAllJournalDuplicates(): Promise<number> {
  const entries = await db.journalEntries
    .filter((entry) => !entry.deleted_at)
    .toArray();

  const byDate = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.entry_date) ?? [];
    list.push(entry);
    byDate.set(entry.entry_date, list);
  }

  let repairedDates = 0;
  for (const [entryDate, list] of byDate) {
    if (list.length <= 1) continue;
    await reconcileJournalDuplicatesForDate(entryDate);
    repairedDates += 1;
  }

  return repairedDates;
}

export function journalEntryFieldsHaveContent(
  fields: Pick<
    JournalEntry,
    | "title"
    | "text_content"
    | "day_emoji"
    | "video_path"
    | "photo_paths"
    | "location"
    | "is_bookmarked"
  >
): boolean {
  if (fields.is_bookmarked) return true;

  return journalEntryHasContent({
    id: "preview",
    entry_date: "1970-01-01",
    title: fields.title,
    text_content: fields.text_content,
    day_emoji: fields.day_emoji,
    is_bookmarked: fields.is_bookmarked,
    video_path: fields.video_path,
    video_thumbnail: null,
    photo_paths: fields.photo_paths,
    is_journal_complete: null,
    journal_entry_number: null,
    journal_completion_streak: null,
    journal_completed_at: null,
    location: fields.location,
    created_at: "1970-01-01T00:00:00.000Z",
    updated_at: "1970-01-01T00:00:00.000Z",
    synced_at: null,
    deleted_at: null,
  });
}
