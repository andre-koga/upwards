/**
 * Field-level three-way diff and merge, shared by every conflict flow.
 *
 * Extracted from conflict-resolution.ts, which was named for the definition
 * conflicts it was written for but had become the host of the generic engine: the
 * journal and projection conflict resolvers both import from here, so this is not
 * definition-specific code and did not belong in a module being deleted.
 *
 * The "definition" naming is kept on the exported functions to avoid a rename
 * touching every call site; the behaviour is table-agnostic.
 */

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a == null && b == null) return true;
  return String(a ?? "") === String(b ?? "");
}

export interface FieldDiffAnalysis {
  differing_fields: string[];
  auto_combinable_fields: string[];
  both_changed_fields: string[];
}

/** Compare local vs remote fields relative to an optional common ancestor. */
export function analyzeDefinitionFieldDiffs(
  localFields: Record<string, unknown>,
  remoteFields: Record<string, unknown> | null,
  baseFields: Record<string, unknown> | null
): FieldDiffAnalysis {
  const keys = new Set([
    ...Object.keys(localFields),
    ...Object.keys(remoteFields ?? {}),
    ...Object.keys(baseFields ?? {}),
  ]);

  const differing_fields: string[] = [];
  const auto_combinable_fields: string[] = [];
  const both_changed_fields: string[] = [];

  for (const key of [...keys].sort()) {
    const localVal = localFields[key];
    const remoteVal = remoteFields?.[key];
    const baseVal = baseFields?.[key];

    if (remoteFields == null) {
      if (baseFields != null && !valuesEqual(localVal, baseVal)) {
        differing_fields.push(key);
        auto_combinable_fields.push(key);
      } else if (baseFields == null && localVal !== undefined) {
        differing_fields.push(key);
      }
      continue;
    }

    if (valuesEqual(localVal, remoteVal)) continue;
    differing_fields.push(key);

    const localChanged =
      baseFields != null ? !valuesEqual(localVal, baseVal) : true;
    const remoteChanged =
      baseFields != null ? !valuesEqual(remoteVal, baseVal) : true;

    if (localChanged && remoteChanged) {
      both_changed_fields.push(key);
    } else {
      auto_combinable_fields.push(key);
    }
  }

  return { differing_fields, auto_combinable_fields, both_changed_fields };
}

/** Merge fields: one-side change wins; both-changed prefers local by default. */
export function combineDefinitionFields(
  localFields: Record<string, unknown>,
  remoteFields: Record<string, unknown>,
  baseFields: Record<string, unknown> | null,
  options?: { preferLocalOnConflict?: boolean }
): Record<string, unknown> {
  const preferLocal = options?.preferLocalOnConflict !== false;
  const keys = new Set([
    ...Object.keys(localFields),
    ...Object.keys(remoteFields),
    ...Object.keys(baseFields ?? {}),
  ]);
  const result: Record<string, unknown> = {};

  for (const key of keys) {
    const localVal = localFields[key];
    const remoteVal = remoteFields[key];
    const baseVal = baseFields?.[key];

    if (valuesEqual(localVal, remoteVal)) {
      result[key] = localVal;
      continue;
    }

    if (baseFields != null) {
      const localChanged = !valuesEqual(localVal, baseVal);
      const remoteChanged = !valuesEqual(remoteVal, baseVal);
      if (localChanged && !remoteChanged) {
        result[key] = localVal;
        continue;
      }
      if (remoteChanged && !localChanged) {
        result[key] = remoteVal;
        continue;
      }
    }

    result[key] = preferLocal ? localVal : remoteVal;
  }

  return result;
}

export type ConflictResolutionChoice = "keep_local" | "keep_remote" | "combine";

/** Format a field value for display in the conflict UI. */
export function formatConflictFieldValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}
