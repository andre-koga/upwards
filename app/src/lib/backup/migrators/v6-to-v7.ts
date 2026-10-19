import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupDocument,
  type BackupTables,
} from "../format";

/** Format 6 predates the compass: it has every table except `compassItems`. */
type BackupTablesV6 = Omit<BackupTables, "compassItems">;

export interface BackupDocumentV6 extends Omit<
  BackupDocument,
  "format_version" | "tables"
> {
  format_version: 6;
  tables: BackupTablesV6;
}

/**
 * Format 7 adds the compass (temporal-data-sync.md, "Compass"). A file from
 * before it holds none, so the table starts empty and importing it changes
 * nothing about a compass the account already has.
 */
export function migrateV6ToV7(doc: BackupDocumentV6): BackupDocument {
  return {
    ...doc,
    format: BACKUP_FORMAT,
    format_version: BACKUP_FORMAT_VERSION,
    tables: { ...doc.tables, compassItems: [] },
  };
}
