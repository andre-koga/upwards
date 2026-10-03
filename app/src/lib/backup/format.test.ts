import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  BACKUP_TABLE_NAMES,
  NON_BACKUP_TABLE_NAMES,
  emptyBackupTables,
} from "./format";

describe("backup coverage", () => {
  it("classifies every Dexie table as backed up or device-local", () => {
    // A new user-owned table must be added to BACKUP_TABLE_NAMES (and to
    // export, import, and the merge) before this passes.
    const dexieTables = db.tables.map((table) => table.name).sort();
    const classified = [
      ...BACKUP_TABLE_NAMES,
      ...NON_BACKUP_TABLE_NAMES,
    ].sort();
    expect(dexieTables).toEqual(classified);
  });

  it("builds a table set with exactly the backed-up tables", () => {
    expect(Object.keys(emptyBackupTables()).sort()).toEqual(
      [...BACKUP_TABLE_NAMES].sort()
    );
  });
});
