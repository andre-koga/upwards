import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_TABLE_NAMES,
  type BackupDocument,
} from "../format";
import { migrateV4ToV5 } from "./v4-to-v5";

export type BackupFormatErrorCode = "unrecognized" | "newer_version";

export class BackupFormatError extends Error {
  readonly code: BackupFormatErrorCode;

  constructor(code: BackupFormatErrorCode) {
    super(`Backup format error: ${code}`);
    this.name = "BackupFormatError";
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isLegacyLayout(raw: Record<string, unknown>): boolean {
  return (
    typeof raw.version === "number" &&
    raw.version <= 4 &&
    Array.isArray(raw.activityGroups)
  );
}

function normalizeCurrent(raw: Record<string, unknown>): BackupDocument {
  const doc = raw as unknown as BackupDocument;
  const tables = asRecord(doc.tables);
  if (!tables) throw new BackupFormatError("unrecognized");
  for (const name of BACKUP_TABLE_NAMES) {
    if (!Array.isArray(tables[name])) tables[name] = [];
  }
  return {
    ...doc,
    source_user_key:
      typeof doc.source_user_key === "string" ? doc.source_user_key : null,
    settings: asRecord(doc.settings) as BackupDocument["settings"],
    media: Array.isArray(doc.media) ? doc.media : [],
  };
}

/**
 * Upgrade any supported backup file to the current format. Each step converts
 * one version to the next, so an old file passes through every later step.
 */
export function migrateBackupDocument(input: unknown): BackupDocument {
  const raw = asRecord(input);
  if (!raw) throw new BackupFormatError("unrecognized");

  if (isLegacyLayout(raw)) return migrateV4ToV5(raw);

  if (raw.format !== BACKUP_FORMAT || typeof raw.format_version !== "number") {
    throw new BackupFormatError("unrecognized");
  }
  if (raw.format_version > BACKUP_FORMAT_VERSION) {
    throw new BackupFormatError("newer_version");
  }
  if (raw.format_version < BACKUP_FORMAT_VERSION) {
    throw new BackupFormatError("unrecognized");
  }
  return normalizeCurrent(raw);
}
