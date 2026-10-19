import type { JournalEntry } from "@/lib/db/types";

/**
 * A one-shot request to open a day's journal editor on Today. "Keep both" in
 * conflict review joins two versions of a day and then opens the result for
 * editing (product-scope.md §2.10), so the person can trim it.
 *
 * The editor reads its starting values once, as it opens. Opened a moment too
 * early it would hold the empty draft Today starts with, and saving that would
 * blank the day. So the request records what the day should contain, and Today
 * opens the editor only when its draft matches; a request that never matches
 * (the day changed again meanwhile) expires instead of opening something stale.
 */
const KEY = "okhabit:journal-edit-request";
export const EDIT_REQUEST_TTL_MS = 2 * 60_000;

export interface JournalEditRequest {
  date: string;
  title: string;
  text: string;
  photoCount: number;
  /** When the request was made, in epoch milliseconds. */
  at: number;
}

export function requestJournalEdit(
  entry: Pick<
    JournalEntry,
    "entry_date" | "title" | "text_content" | "photo_paths"
  >,
  at: number = Date.now()
): void {
  const request: JournalEditRequest = {
    date: entry.entry_date,
    title: entry.title ?? "",
    text: entry.text_content ?? "",
    photoCount: entry.photo_paths?.length ?? 0,
    at,
  };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(request));
  } catch {
    // Storage unavailable: the resolution is saved; the person opens the day.
  }
}

/** The pending request for `date`, if there is one and it has not expired. */
export function peekJournalEditRequest(
  date: string,
  now: number = Date.now()
): JournalEditRequest | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<JournalEditRequest> | null;
    if (
      !value ||
      value.date !== date ||
      typeof value.at !== "number" ||
      typeof value.title !== "string" ||
      typeof value.text !== "string" ||
      typeof value.photoCount !== "number"
    ) {
      return null;
    }
    if (now - value.at > EDIT_REQUEST_TTL_MS || now < value.at) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return value as JournalEditRequest;
  } catch {
    return null;
  }
}

export function clearJournalEditRequest(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Whether Today's draft already holds what the request is for. */
export function draftMatchesRequest(
  request: JournalEditRequest,
  draft: { title: string; text: string; photoCount: number }
): boolean {
  return (
    draft.title === request.title &&
    draft.text === request.text &&
    draft.photoCount === request.photoCount
  );
}
