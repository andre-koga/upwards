import { describe, expect, it } from "vitest";
import {
  isNeverRoutine,
  isNeverTaskSlipRecorded,
  isNeverTaskSlipped,
  isNeverTaskSuccessfulDay,
  neverTaskTarget,
} from "./never-task";

describe("never-task helpers", () => {
  it("detects never routines", () => {
    expect(isNeverRoutine({ routine: "never" })).toBe(true);
    expect(isNeverRoutine({ routine: "daily" })).toBe(false);
    expect(isNeverRoutine(null)).toBe(false);
  });

  it("uses completion_target with a default of 1", () => {
    expect(neverTaskTarget({ routine: "never" })).toBe(1);
    expect(neverTaskTarget({ routine: "never", completion_target: 3 })).toBe(3);
  });

  it("treats reaching the target as a slip", () => {
    expect(isNeverTaskSlipped(0)).toBe(false);
    expect(isNeverTaskSlipped(1)).toBe(true);
    expect(isNeverTaskSuccessfulDay(0, 2)).toBe(true);
    expect(isNeverTaskSuccessfulDay(2, 2)).toBe(false);
    expect(
      isNeverTaskSlipRecorded({ routine: "never", completion_target: 2 }, 2)
    ).toBe(true);
  });
});
