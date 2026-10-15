import { describe, expect, it } from "vitest";
import { differingFields, formatConflictFieldValue } from "./field-diff";

describe("differingFields", () => {
  it("lists only the fields whose values differ, in a stable order", () => {
    expect(
      differingFields(
        { name: "Run", routine: "daily", color: "green" },
        { name: "Jog", routine: "daily", color: "blue" }
      )
    ).toEqual(["color", "name"]);
  });

  it("is empty when the versions agree", () => {
    expect(differingFields({ name: "Run" }, { name: "Run" })).toEqual([]);
  });

  it("treats a missing value and an empty one as the same", () => {
    expect(
      differingFields(
        { note: null, title: "" },
        { note: undefined, title: null }
      )
    ).toEqual([]);
  });

  it("compares lists and objects by content, not identity", () => {
    expect(
      differingFields(
        { photo_paths: ["a", "b"], location: { locations: [] } },
        { photo_paths: ["a", "b"], location: { locations: [] } }
      )
    ).toEqual([]);
    expect(
      differingFields({ photo_paths: ["a", "b"] }, { photo_paths: ["b", "a"] })
    ).toEqual(["photo_paths"]);
  });

  it("counts a field only one side has as different", () => {
    expect(differingFields({ a: 1 }, { b: 2 })).toEqual(["a", "b"]);
  });

  it("lists every field this device has when the other version is unavailable", () => {
    expect(differingFields({ name: "Run", note: undefined }, null)).toEqual([
      "name",
    ]);
  });
});

describe("formatConflictFieldValue", () => {
  it("shows a dash for nothing", () => {
    expect(formatConflictFieldValue(null)).toBe("—");
    expect(formatConflictFieldValue("")).toBe("—");
    expect(formatConflictFieldValue(undefined)).toBe("—");
  });

  it("shows strings and numbers as they are, and anything else as JSON", () => {
    expect(formatConflictFieldValue("Run")).toBe("Run");
    expect(formatConflictFieldValue(3)).toBe("3");
    expect(formatConflictFieldValue(0)).toBe("0");
    expect(formatConflictFieldValue(["a"])).toBe('["a"]');
  });
});
