import { describe, expect, it } from "vitest";
import {
  activityTracksTime,
  resolveTracksTime,
  trackTimeRule,
} from "./tracks-time";

describe("activityTracksTime", () => {
  it("is true unless explicitly turned off, so older rows keep their timer", () => {
    expect(activityTracksTime({ tracks_time: true })).toBe(true);
    expect(activityTracksTime({ tracks_time: false })).toBe(false);
    expect(activityTracksTime({} as unknown as { tracks_time: boolean })).toBe(
      true
    );
    expect(activityTracksTime(null)).toBe(true);
    expect(activityTracksTime(undefined)).toBe(true);
  });
});

describe("trackTimeRule", () => {
  it("never times an avoid habit, and does not offer the choice", () => {
    expect(trackTimeRule("never")).toEqual({ forced: false, canChoose: false });
  });

  it("always times a time-only activity, and does not offer the choice", () => {
    expect(trackTimeRule("anytime")).toEqual({
      forced: true,
      canChoose: false,
    });
  });

  it("lets scheduled habits choose", () => {
    for (const routine of [
      "daily",
      "weekly:1,3,5",
      "monthly:15",
      "custom:2:days",
    ]) {
      expect(trackTimeRule(routine)).toEqual({ forced: null, canChoose: true });
    }
  });

  it("lets an unset routine choose", () => {
    expect(trackTimeRule(null).canChoose).toBe(true);
    expect(trackTimeRule(undefined).canChoose).toBe(true);
  });
});

describe("resolveTracksTime", () => {
  it("overrides the switch for avoid and time-only activities", () => {
    expect(resolveTracksTime("never", true)).toBe(false);
    expect(resolveTracksTime("anytime", false)).toBe(true);
  });

  it("uses the switch for everything else", () => {
    expect(resolveTracksTime("daily", false)).toBe(false);
    expect(resolveTracksTime("daily", true)).toBe(true);
  });

  it("fixes the meaningless combination of a changed routine and a stale switch", () => {
    // Switch was turned off for a daily med, then the routine became "anytime".
    expect(resolveTracksTime("anytime", false)).toBe(true);
  });
});
