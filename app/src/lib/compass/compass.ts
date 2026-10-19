import { db, newId, now } from "@/lib/db";
import type { CompassItem, CompassKind } from "@/lib/db/types";
import { currentSyncUserKey, naturalNorthStarId } from "@/lib/sync/natural-ids";
import { patchCompassItem, saveCompassItem } from "@/lib/sync/mutate-synced";

/**
 * The compass: what a person writes about who they are becoming
 * (temporal-data-sync.md, "Compass"). Every function here is a named command
 * over `mutateSynced`; nothing else writes `compassItems`.
 */

/** Longest text each kind may hold. The server enforces the same limits. */
export const COMPASS_LIMITS = {
  north_star: 200,
  identity: 40,
  goal: 120,
  knowledge: 1000,
  question: 200,
} as const satisfies Record<CompassKind | "question", number>;

export type CompassRejection = "empty" | "too_long" | "link_conflict";

export class CompassError extends Error {
  readonly code: CompassRejection;
  constructor(code: CompassRejection) {
    super(`Compass: ${code}`);
    this.name = "CompassError";
    this.code = code;
  }
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * The words as stored: trimmed, and inner runs of whitespace collapsed for the
 * short kinds. A knowledge answer is prose, so it keeps its line breaks.
 */
export function normalizeCompassText(kind: CompassKind, value: string): string {
  const text = kind === "knowledge" ? value.trim() : clean(value);
  if (!text) throw new CompassError("empty");
  if (text.length > COMPASS_LIMITS[kind]) throw new CompassError("too_long");
  return text;
}

function normalizeQuestion(value: string | null | undefined): string | null {
  const question = value ? clean(value) : "";
  if (!question) return null;
  if (question.length > COMPASS_LIMITS.question) {
    throw new CompassError("too_long");
  }
  return question;
}

interface GoalLink {
  activityId?: string | null;
  groupId?: string | null;
}

/** A goal is measured by one habit or one group, never both. */
function resolveLink(link: GoalLink | undefined) {
  const activity_id = link?.activityId ?? null;
  const group_id = link?.groupId ?? null;
  if (activity_id && group_id) throw new CompassError("link_conflict");
  return { activity_id, group_id };
}

function blank(kind: CompassKind, id: string): CompassItem {
  const stamp = now();
  return {
    id,
    kind,
    text: "",
    question: null,
    activity_id: null,
    group_id: null,
    created_at: stamp,
    updated_at: stamp,
    synced_at: null,
    archived_at: null,
    deleted_at: null,
  };
}

/** The id of this person's north star on every device. */
export function northStarId(): string {
  return naturalNorthStarId(currentSyncUserKey());
}

/**
 * Write the north star. There is one per person, with an id every device
 * computes, so two devices that write it offline converge on one row and
 * disagree about its text (a reviewable conflict) instead of making two.
 */
export async function setNorthStar(text: string): Promise<CompassItem> {
  const value = normalizeCompassText("north_star", text);
  const id = northStarId();
  const existing = await db.compassItems.get(id);
  if (!existing) {
    const row = { ...blank("north_star", id), text: value };
    await saveCompassItem(row);
    return row;
  }
  // Writing again after setting it aside or deleting it brings it back.
  await patchCompassItem(id, {
    text: value,
    archived_at: null,
    deleted_at: null,
  });
  return (await db.compassItems.get(id))!;
}

export async function addIdentityWord(text: string): Promise<CompassItem> {
  const row = {
    ...blank("identity", newId()),
    text: normalizeCompassText("identity", text),
  };
  await saveCompassItem(row);
  return row;
}

export async function addGoal(
  text: string,
  link?: GoalLink
): Promise<CompassItem> {
  const row = {
    ...blank("goal", newId()),
    text: normalizeCompassText("goal", text),
    ...resolveLink(link),
  };
  await saveCompassItem(row);
  return row;
}

/** Something the person tells the app about themselves, with what prompted it. */
export async function addKnowledge(
  answer: string,
  question?: string | null
): Promise<CompassItem> {
  const row = {
    ...blank("knowledge", newId()),
    text: normalizeCompassText("knowledge", answer),
    question: normalizeQuestion(question),
  };
  await saveCompassItem(row);
  return row;
}

interface CompassEdit {
  text?: string;
  question?: string | null;
  link?: GoalLink;
}

export async function editCompassItem(
  id: string,
  edit: CompassEdit
): Promise<void> {
  const existing = await db.compassItems.get(id);
  if (!existing) return;
  const patch: Partial<CompassItem> = {};
  if (edit.text !== undefined) {
    patch.text = normalizeCompassText(existing.kind, edit.text);
  }
  if (edit.question !== undefined && existing.kind === "knowledge") {
    patch.question = normalizeQuestion(edit.question);
  }
  if (edit.link !== undefined && existing.kind === "goal") {
    Object.assign(patch, resolveLink(edit.link));
  }
  await patchCompassItem(id, patch);
}

/** Set aside: out of the main list, still there, and it can come back. */
export async function archiveCompassItem(id: string): Promise<void> {
  await patchCompassItem(id, { archived_at: now() });
}

export async function restoreCompassItem(id: string): Promise<void> {
  await patchCompassItem(id, { archived_at: null, deleted_at: null });
}

/** A tombstone, not an erasure: it can be restored from the deleted list. */
export async function deleteCompassItem(id: string): Promise<void> {
  await patchCompassItem(id, { deleted_at: now() });
}

export interface CompassSnapshot {
  northStar: CompassItem | null;
  identity: CompassItem[];
  goals: CompassItem[];
  knowledge: CompassItem[];
  /** Set aside by the person; restorable. */
  archived: CompassItem[];
  /** Deleted; restorable from the deleted list. */
  deleted: CompassItem[];
}

/** Oldest first, so what was written first stays where it was. */
function byCreated(a: CompassItem, b: CompassItem): number {
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/** Sort the rows into the lists the compass shows. Pure, so it is testable. */
export function groupCompassItems(
  items: readonly CompassItem[]
): CompassSnapshot {
  const live = items.filter((item) => !item.deleted_at);
  const active = live.filter((item) => !item.archived_at);
  const ofKind = (kind: CompassKind) =>
    active.filter((item) => item.kind === kind).sort(byCreated);
  return {
    northStar: ofKind("north_star")[0] ?? null,
    identity: ofKind("identity"),
    goals: ofKind("goal"),
    knowledge: ofKind("knowledge"),
    archived: live.filter((item) => item.archived_at).sort(byCreated),
    deleted: items.filter((item) => item.deleted_at).sort(byCreated),
  };
}
