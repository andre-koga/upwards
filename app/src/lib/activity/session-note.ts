export const SESSION_NOTE_MAX_LENGTH = 200;

/** Trim and cap a session note. Empty text becomes null. */
export function normalizeSessionNote(
  value: string | null | undefined
): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, SESSION_NOTE_MAX_LENGTH);
}
