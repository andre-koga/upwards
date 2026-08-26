import { describe, expect, it } from "vitest";
import {
  naturalDailyEntryId,
  naturalJournalId,
  syncUserKey,
} from "./natural-ids";

describe("natural sync ids", () => {
  it("is stable across calls for the same user and date", () => {
    const user = "11111111-1111-4111-8111-111111111111";
    expect(naturalJournalId(user, "2026-08-26")).toBe(
      naturalJournalId(user, "2026-08-26")
    );
    expect(naturalDailyEntryId(user, "2026-08-26")).toBe(
      naturalDailyEntryId(user, "2026-08-26")
    );
  });

  it("differs by entity kind, user, and date", () => {
    const userA = "11111111-1111-4111-8111-111111111111";
    const userB = "22222222-2222-4222-8222-222222222222";
    const journal = naturalJournalId(userA, "2026-08-26");
    const daily = naturalDailyEntryId(userA, "2026-08-26");
    expect(journal).not.toBe(daily);
    expect(journal).not.toBe(naturalJournalId(userB, "2026-08-26"));
    expect(journal).not.toBe(naturalJournalId(userA, "2026-08-25"));
  });

  it("uses guest:device when unsigned", () => {
    expect(syncUserKey(null, "device-1")).toBe("guest:device-1");
    expect(syncUserKey("user-1", "device-1")).toBe("user-1");
  });
});
