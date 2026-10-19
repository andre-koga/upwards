/**
 * Which fields of two versions of one row differ, and how to show a value.
 *
 * Conflict review shows two whole versions and lets the person keep one
 * (product-scope.md §2.10). There is no per-field choice and no automatic merge
 * here: working out which side "won" each field needs a common ancestor the app
 * does not keep, and a wrong guess would silently drop someone's edit.
 */

function isEmpty(value: unknown): boolean {
  return value == null || value === "";
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (isEmpty(a) || isEmpty(b)) return isEmpty(a) && isEmpty(b);
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return String(a) === String(b);
}

/**
 * The field names whose values differ between this device's version and the
 * other. With no other version (it could not be fetched), every field this
 * device has a value for is listed, so the review still has something to show.
 */
export function differingFields(
  localFields: Record<string, unknown>,
  remoteFields: Record<string, unknown> | null
): string[] {
  const keys = new Set([
    ...Object.keys(localFields),
    ...Object.keys(remoteFields ?? {}),
  ]);
  return [...keys]
    .sort()
    .filter((key) =>
      remoteFields == null
        ? localFields[key] !== undefined
        : !valuesEqual(localFields[key], remoteFields[key])
    );
}

/** What a person chooses to keep. Journal days also offer `keep_both`. */
export type ConflictChoice = "keep_local" | "keep_remote" | "keep_both";

/** Format a field value for display in the conflict UI. */
export function formatConflictFieldValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}
