import { describe, expect, it } from "vitest";
import {
  analyzeDefinitionFieldDiffs,
  combineDefinitionFields,
  formatConflictFieldValue,
} from "./field-diff";

/**
 * Coverage ported from conflict-resolution.test.ts, which was deleted with the
 * definition-conflict subsystem. These functions are not definition-specific — the
 * journal and projection conflict resolvers are their real consumers — so their
 * tests had to survive the deletion.
 */

describe("analyzeDefinitionFieldDiffs", () => {
  it("marks one-side changes as auto-combinable when base is known", () => {
    const analysis = analyzeDefinitionFieldDiffs(
      { name: "Mine", routine: "daily", completion_target: 1 },
      { name: "Base", routine: "weekly:1", completion_target: 1 },
      { name: "Base", routine: "daily", completion_target: 1 }
    );

    expect(analysis.differing_fields).toEqual(["name", "routine"]);
    expect(analysis.auto_combinable_fields).toEqual(["name", "routine"]);
    expect(analysis.both_changed_fields).toEqual([]);
  });

  it("detects both-changed fields", () => {
    const analysis = analyzeDefinitionFieldDiffs(
      { name: "Mine", routine: "daily" },
      { name: "Theirs", routine: "never" },
      { name: "Base", routine: "daily" }
    );

    expect(analysis.both_changed_fields).toEqual(["name"]);
    expect(analysis.auto_combinable_fields).toEqual(["routine"]);
  });

  it("treats every difference as both-changed when there is no ancestor", () => {
    // No base means no way to tell who moved, so nothing may be auto-combined.
    const analysis = analyzeDefinitionFieldDiffs(
      { name: "Mine" },
      { name: "Theirs" },
      null
    );

    expect(analysis.both_changed_fields).toEqual(["name"]);
    expect(analysis.auto_combinable_fields).toEqual([]);
  });
});

describe("combineDefinitionFields", () => {
  it("takes each one-side change and prefers local on overlap", () => {
    const combined = combineDefinitionFields(
      { name: "Mine", routine: "daily", completion_target: 3 },
      { name: "Theirs", routine: "weekly:1", completion_target: 1 },
      { name: "Base", routine: "daily", completion_target: 1 },
      { preferLocalOnConflict: true }
    );

    expect(combined).toEqual({
      name: "Mine",
      routine: "weekly:1",
      completion_target: 3,
    });
  });

  it("prefers remote on overlap when asked", () => {
    const combined = combineDefinitionFields(
      { name: "Mine" },
      { name: "Theirs" },
      { name: "Base" },
      { preferLocalOnConflict: false }
    );

    expect(combined).toEqual({ name: "Theirs" });
  });
});

describe("formatConflictFieldValue", () => {
  it("renders empty values as a dash rather than 'null'", () => {
    expect(formatConflictFieldValue(null)).toBe("—");
    expect(formatConflictFieldValue(undefined)).toBe("—");
    expect(formatConflictFieldValue("")).toBe("—");
  });

  it("passes scalars through and serializes anything else", () => {
    expect(formatConflictFieldValue("daily")).toBe("daily");
    expect(formatConflictFieldValue(3)).toBe("3");
    expect(formatConflictFieldValue({ a: 1 })).toBe('{"a":1}');
  });
});
