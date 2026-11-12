import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupDocument,
} from "../format";

export interface BackupDocumentV6 extends Omit<
  BackupDocument,
  "format_version"
> {
  format_version: 6;
}

/**
 * Format 7 added a compass table, which has since been removed. The tables are
 * the same as format 6 now, so this only moves the version. A format 7 file
 * written while the compass existed still carries a `compassItems` array;
 * nothing reads it, so it is ignored on import.
 */
export function migrateV6ToV7(doc: BackupDocumentV6): BackupDocument {
  return {
    ...doc,
    format: BACKUP_FORMAT,
    format_version: BACKUP_FORMAT_VERSION,
  };
}
