import { db, now } from "@/lib/db";
import type { JournalEntry } from "@/lib/db/types";
import { journalEntryHasContent } from "@/lib/journal/archive";
import {
  enqueueProjectionUpsertForTable,
  withSuppressedProjectionEnqueue,
} from "@/lib/sync/projection-sync";
import { discardPendingOperation } from "@/lib/sync/pending-operations";
import { recordSyncIssue, listOpenConflictEntityIds } from "@/lib/sync/sync-issues-store";
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

/**
 * Keeps both sides when both hold prose.
 *
 * This used to return the winner and silently drop the loser's text. Journal prose
 * is the least replaceable data in the app and, unlike every other conflicting
 * field, no conflict was recorded and no copy was kept — the words were simply
 * gone. Duplicate (date) rows are produced by the guest -> signed-in id divergence,
 * so both sides are routinely real user writing from the same day.
 *
 * Concatenating is lossless and the user can trim it. Identical text is not
 * duplicated, and a substring already contained in the winner is dropped.
 */
function mergeTextField(
  winner: string | null | undefined,
  loser: string | null | undefined
): string | null {
  const winnerText = winner?.trim();
  const loserText = loser?.trim();

  if (!winnerText) return loserText ? (loser ?? null) : null;
  if (!loserText) return winner ?? null;
  if (winnerText === loserText) return winner ?? null;
  if (winnerText.includes(loserText)) return winner ?? null;
  if (loserText.includes(winnerText)) return loser ?? null;

  return `${winner}\n\n${loser}`;
}

/**
 * Single-value fields where concatenating would corrupt the value: an emoji, a
 * storage path. The winner keeps it; the caller reports that the loser's value was
 * not absorbed so the loser is not tombstoned over it.
 */
function preferWinnerValue(
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
  // video_path and video_thumbnail have to move together or the thumbnail points
  // at a video that is not there.
  const keepWinnerVideo = Boolean(winner.video_path?.trim());

  return {
    ...winner,
    title: mergeTextField(winner.title, loser.title),
    text_content: mergeTextField(winner.text_content, loser.text_content),
    day_emoji: preferWinnerValue(winner.day_emoji, loser.day_emoji),
    video_path: keepWinnerVideo ? winner.video_path : (loser.video_path ?? null),
    video_thumbnail: keepWinnerVideo
      ? winner.video_thumbnail
      : (loser.video_thumbnail ?? null),
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

/**
 * Whether every piece of the loser's content survived into the merged row.
 *
 * The tombstone below is what actually destroys data, so it needs a positive
 * answer to "is this row now redundant?" rather than an assumption. Production
 * holds 54 journal tombstones, 53 with text and 49 with media, all machine-written
 * — there is no user-facing journal delete — so this check is the difference
 * between deduplication and deletion.
 */
export function loserContentWasAbsorbed(
  merged: JournalEntry,
  loser: JournalEntry
): boolean {
  const loserText = loser.text_content?.trim();
  if (loserText && !(merged.text_content ?? "").includes(loserText)) {
    return false;
  }

  const loserTitle = loser.title?.trim();
  if (loserTitle && !(merged.title ?? "").includes(loserTitle)) return false;

  const loserEmoji = loser.day_emoji?.trim();
  if (loserEmoji && merged.day_emoji?.trim() !== loserEmoji) return false;

  const loserVideo = loser.video_path?.trim();
  if (loserVideo && merged.video_path?.trim() !== loserVideo) return false;

  const mergedPhotos = new Set(merged.photo_paths ?? []);
  for (const path of loser.photo_paths ?? []) {
    if (path?.trim() && !mergedPhotos.has(path)) return false;
  }

  const mergedPlaces = new Set(
    (merged.location?.locations ?? []).map((place) => place.displayName)
  );
  for (const place of loser.location?.locations ?? []) {
    if (!mergedPlaces.has(place.displayName)) return false;
  }

  return true;
}

/**
 * Retires the loser's queued ops without erasing the audit trail.
 *
 * This used to `bulkDelete()` the rows outright, the only place in the app that
 * hard-deletes pending ops instead of setting status `discarded`. That destroyed
 * the record of a write that had not reached the server, so if the merge below then
 * failed there was nothing left to show what was lost.
 *
 * Also covers `failed` ops: a rejected op for the loser is the case most likely to
 * be holding the only copy of something.
 */
async function discardPendingJournalOpsForEntity(
  entityId: string
): Promise<void> {
  const pending = await db.syncPendingOperations
    .filter(
      (op) =>
        op.entity_type === "journal_entry" &&
        op.entity_id === entityId &&
        (op.status === "pending" || op.status === "failed")
    )
    .toArray();

  for (const op of pending) {
    await discardPendingOperation(op.id);
  }
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

  const candidates = entries.filter((entry) => entry.id !== winner.id);
  let merged = winner;
  for (const loser of candidates) {
    merged = mergeJournalEntryDuplicates(merged, loser);
  }

  const ts = now();
  merged = { ...merged, updated_at: ts };

  // Only retire a duplicate whose content actually survived the merge. A row whose
  // content did not fit (a second emoji, a second video) stays active: two visible
  // rows for one day is a cosmetic bug, whereas tombstoning it loses the content
  // for good, on every device.
  const losers: JournalEntry[] = [];
  const retained: JournalEntry[] = [];
  for (const loser of candidates) {
    if (journalEntryHasContent(loser) && !loserContentWasAbsorbed(merged, loser)) {
      retained.push(loser);
    } else {
      losers.push(loser);
    }
  }

  if (retained.length > 0) {
    // reconcileAllJournalDuplicates runs after every sync, and recordSyncIssue only
    // dedupes `error` kinds, so without this check a permanently-retained pair would
    // add a new conflict card on every tick.
    const alreadyFlagged = await listOpenConflictEntityIds();
    if (!alreadyFlagged.has(winner.id)) {
      await recordSyncIssue({
        kind: "conflict",
        title: "Duplicate journal entries kept",
        detail: `${entryDate} had ${entries.length} journal entries. ${retained.length} could not be merged without losing content, so nothing was deleted. Review the day and combine them by hand.`,
        entity_type: "journal_entry",
        entity_id: winner.id,
      });
    }
  }

  await withSuppressedProjectionEnqueue(async () => {
    await db.journalEntries.put(merged);
    for (const loser of losers) {
      await discardPendingJournalOpsForEntity(loser.id);
      if (loser.synced_at) {
        await db.journalEntries.update(loser.id, {
          deleted_at: ts,
          updated_at: ts,
        });
      } else {
        // Never synced and fully absorbed, so the row exists nowhere else and
        // holds nothing the winner lacks.
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
