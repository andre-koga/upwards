/**
 * In-memory only — survives dialog close, lost on full page reload.
 * Used so accidental overlay clicks / Escape do not lose in-progress form text.
 */

export type JournalEditSessionValues = {
  emoji: string;
  title: string;
  text: string;
  videoPath: string;
};

const journalEditDrafts = new Map<string, JournalEditSessionValues>();

export function getJournalEditSessionDraft(
  entryDate: string
): JournalEditSessionValues | null {
  return journalEditDrafts.get(entryDate) ?? null;
}

export function setJournalEditSessionDraft(
  entryDate: string,
  values: JournalEditSessionValues
) {
  journalEditDrafts.set(entryDate, values);
}

export function clearJournalEditSessionDraft(entryDate: string) {
  journalEditDrafts.delete(entryDate);
}

export type QuickMemoSessionValues = {
  title: string;
  dueDate: string | null;
  isPinned: boolean;
};

let quickMemoDraft: QuickMemoSessionValues | null = null;

export function getQuickMemoSessionDraft(): QuickMemoSessionValues | null {
  return quickMemoDraft;
}

export function setQuickMemoSessionDraft(values: QuickMemoSessionValues) {
  quickMemoDraft = values;
}

export function clearQuickMemoSessionDraft() {
  quickMemoDraft = null;
}
