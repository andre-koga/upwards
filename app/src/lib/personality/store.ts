import { db, newId, now } from "@/lib/db";
import type { PersonalitySitting } from "@/lib/db/types";
import {
  patchPersonalitySitting,
  savePersonalitySitting,
} from "@/lib/sync/mutate-synced";
import { ITEM_IDS, isValidAnswer } from "./items";
import { scoreSitting } from "./scoring";

/** Newest first, among rows that are not deleted. */
async function liveSittings(): Promise<PersonalitySitting[]> {
  const rows = await db.personalitySittings.toArray();
  return rows
    .filter((row) => !row.deleted_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
}

/** The sitting still being answered, if any. */
export async function currentSitting(): Promise<PersonalitySitting | null> {
  const rows = await liveSittings();
  return rows.find((row) => !row.completed_at) ?? null;
}

/** Finished sittings, newest first. */
export async function completedSittings(): Promise<PersonalitySitting[]> {
  const rows = await liveSittings();
  return rows.filter((row) => row.completed_at && row.scores);
}

/**
 * Starts a sitting. A retake is a new row, so the earlier sitting stays and the
 * page can show it as "last time". If a sitting is already in progress it is
 * returned rather than starting a second one.
 */
export async function startSitting(): Promise<PersonalitySitting> {
  const existing = await currentSitting();
  if (existing) return existing;
  const stamp = now();
  const row: PersonalitySitting = {
    id: newId(),
    started_at: stamp,
    completed_at: null,
    answers: {},
    scores: null,
    created_at: stamp,
    updated_at: stamp,
    synced_at: null,
    deleted_at: null,
  };
  await savePersonalitySitting(row, null);
  return row;
}

/**
 * Records one answer and saves it. The fiftieth answer finishes the sitting:
 * it is scored here, on the device, and the answers never go to a model.
 */
export async function answerQuestion(
  sittingId: string,
  itemId: string,
  value: number
): Promise<PersonalitySitting | null> {
  if (!ITEM_IDS.includes(itemId) || !isValidAnswer(value)) return null;
  const existing = await db.personalitySittings.get(sittingId);
  if (!existing || existing.deleted_at || existing.completed_at) return null;

  const answers = { ...existing.answers, [itemId]: value };
  const scores = scoreSitting(answers);
  const stamp = now();
  return patchPersonalitySitting(sittingId, {
    answers,
    scores,
    completed_at: scores ? stamp : null,
    updated_at: stamp,
  });
}

/** Drops an unfinished sitting's answers and removes the row (a tombstone syncs). */
export async function discardSitting(sittingId: string): Promise<void> {
  const existing = await db.personalitySittings.get(sittingId);
  if (!existing || existing.completed_at) return;
  await patchPersonalitySitting(sittingId, { deleted_at: now() });
}
