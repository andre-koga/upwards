import { describe, expect, it } from "vitest";
import {
  isArchivedAsOf,
  isArchivedNow,
  isDeletedAsOf,
  isRetiredAsOf,
} from "./lifecycle";

const at = (y: number, m: number, d: number, h = 12) =>
  new Date(y, m - 1, d, h, 0, 0).toISOString();
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe("archiving hides from the next day", () => {
  const archived = { archived_at: at(2026, 6, 10, 14) };

  it("still shows the item on days before it was archived", () => {
    expect(isArchivedAsOf(archived, day(2026, 6, 1))).toBe(false);
    expect(isArchivedAsOf(archived, day(2026, 6, 9))).toBe(false);
  });

  it("still shows it on the day it was archived, even afterwards", () => {
    expect(isArchivedAsOf(archived, day(2026, 6, 10))).toBe(false);
  });

  it("hides it from the next day on", () => {
    expect(isArchivedAsOf(archived, day(2026, 6, 11))).toBe(true);
    expect(isArchivedAsOf(archived, day(2027, 1, 1))).toBe(true);
  });

  it("treats an item that was never archived as never archived", () => {
    expect(isArchivedAsOf({ archived_at: null }, day(2026, 6, 11))).toBe(false);
    expect(isArchivedAsOf({}, day(2026, 6, 11))).toBe(false);
  });

  it("handles an archive date at exactly midnight (a migrated 'effective' time)", () => {
    // Migrated events set archived_at to the start of the next day.
    const migrated = {
      archived_at: new Date(2026, 5, 11, 0, 0, 0).toISOString(),
    };
    expect(isArchivedAsOf(migrated, day(2026, 6, 10))).toBe(false);
    expect(isArchivedAsOf(migrated, day(2026, 6, 11))).toBe(true);
  });
});

describe("deleting hides from the same day", () => {
  const deleted = { deleted_at: at(2026, 6, 10, 14) };

  it("keeps the item's recorded past", () => {
    expect(isDeletedAsOf(deleted, day(2026, 6, 9))).toBe(false);
    expect(isDeletedAsOf(deleted, day(2026, 1, 1))).toBe(false);
  });

  it("hides it on the day it was deleted, so it vanishes at once", () => {
    expect(isDeletedAsOf(deleted, day(2026, 6, 10))).toBe(true);
  });

  it("keeps it hidden afterwards", () => {
    expect(isDeletedAsOf(deleted, day(2026, 6, 11))).toBe(true);
  });

  it("is not deleted when the timestamp is null", () => {
    expect(isDeletedAsOf({ deleted_at: null }, day(2026, 6, 11))).toBe(false);
  });

  it("keeps a day an item was used on visible after it is deleted later", () => {
    // Gym: used on 3 Sept, deleted on 7 Oct.
    const gym = { deleted_at: at(2026, 10, 7, 13) };
    expect(isDeletedAsOf(gym, day(2026, 9, 3))).toBe(false);
    expect(isDeletedAsOf(gym, day(2026, 10, 7))).toBe(true);
  });
});

describe("isRetiredAsOf", () => {
  it("is true when either rule applies", () => {
    expect(
      isRetiredAsOf({ archived_at: at(2026, 6, 10) }, day(2026, 6, 11))
    ).toBe(true);
    expect(
      isRetiredAsOf({ deleted_at: at(2026, 6, 10) }, day(2026, 6, 10))
    ).toBe(true);
  });

  it("is false for a live item", () => {
    expect(isRetiredAsOf({}, day(2026, 6, 10))).toBe(false);
  });
});

describe("isArchivedNow", () => {
  it("is true for an archived item", () => {
    expect(isArchivedNow({ archived_at: at(2026, 6, 10) })).toBe(true);
  });

  it("is false once deleted, since deleted items are not in the archive list", () => {
    expect(
      isArchivedNow({
        archived_at: at(2026, 6, 10),
        deleted_at: at(2026, 6, 12),
      })
    ).toBe(false);
  });

  it("is false when restored", () => {
    expect(isArchivedNow({ archived_at: null })).toBe(false);
  });
});
