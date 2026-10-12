import { describe, expect, it } from "vitest";
import {
  activityTypeOfRoutine,
  habitRoutineOrDefault,
  normalizeActivityByType,
} from "./activity-type";

describe("activityTypeOfRoutine", () => {
  it("maps routines onto the three types", () => {
    expect(activityTypeOfRoutine("never")).toBe("avoid");
    expect(activityTypeOfRoutine("anytime")).toBe("time-only");
    for (const routine of [
      "daily",
      "weekly:1,3",
      "monthly:5",
      "custom:2:days",
    ]) {
      expect(activityTypeOfRoutine(routine)).toBe("habit");
    }
  });

  it("treats a missing routine as a habit", () => {
    expect(activityTypeOfRoutine(null)).toBe("habit");
    expect(activityTypeOfRoutine(undefined)).toBe("habit");
  });
});

describe("habitRoutineOrDefault", () => {
  it("keeps a real schedule and replaces the other types' routines", () => {
    expect(habitRoutineOrDefault("weekly:2")).toBe("weekly:2");
    expect(habitRoutineOrDefault("never")).toBe("daily");
    expect(habitRoutineOrDefault("anytime")).toBe("daily");
    expect(habitRoutineOrDefault(null)).toBe("daily");
  });
});

describe("normalizeActivityByType", () => {
  it("avoid habits are never-routine, never timed, even if the switch is on", () => {
    expect(
      normalizeActivityByType({
        type: "avoid",
        habitRoutine: "weekly:1",
        target: 5,
        tracksTime: true,
      })
    ).toEqual({ routine: "never", completion_target: 1, tracks_time: false });
  });

  it("time-only activities are anytime, always timed", () => {
    expect(
      normalizeActivityByType({
        type: "time-only",
        habitRoutine: "daily",
        target: 3,
        tracksTime: false,
      })
    ).toEqual({ routine: "anytime", completion_target: 1, tracks_time: true });
  });

  it("keeps an existing target on non-habit types", () => {
    expect(
      normalizeActivityByType({
        type: "avoid",
        habitRoutine: "daily",
        target: 1,
        tracksTime: false,
        existingTarget: 3,
      }).completion_target
    ).toBe(3);
  });

  it("habits keep their schedule, target, and timer choice", () => {
    expect(
      normalizeActivityByType({
        type: "habit",
        habitRoutine: "weekly:1,3",
        target: "2",
        tracksTime: false,
      })
    ).toEqual({
      routine: "weekly:1,3",
      completion_target: 2,
      tracks_time: false,
    });
  });

  it("habits never save a never/anytime routine or a target below 1", () => {
    const result = normalizeActivityByType({
      type: "habit",
      habitRoutine: "never",
      target: "",
      tracksTime: true,
    });
    expect(result.routine).toBe("daily");
    expect(result.completion_target).toBe(1);
    expect(result.tracks_time).toBe(true);
  });
});
