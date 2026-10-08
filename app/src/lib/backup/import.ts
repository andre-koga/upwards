import { db, now } from "@/lib/db";
import { toJournalVideoPath } from "@/lib/journal/video-storage";
import { getCachedUserId, isSupabaseConfigured } from "@/lib/supabase";
import { syncEngine } from "@/lib/sync";
import {
  importBackup,
  saveJournalEntry,
  type BackupImportSummary,
} from "@/lib/sync/mutate-synced";
import { currentSyncUserKey } from "@/lib/sync/natural-ids";
import { countUnsyncedOperations } from "@/lib/sync/pending-operations";
import {
  loadLastAppliedSequence,
  loadSyncProtocolV2,
} from "@/lib/sync/sync-storage";
import {
  BACKUP_JSON_NAME,
  CLIPS_JSON_NAME,
  isClipsManifest,
  mediaArchivePath,
  type BackupMediaFile,
} from "./format";
import { remapBackupIdentity, rewriteMediaOwner } from "./identity";
import { restoreMediaFile, rewriteMediaReferences } from "./media";
import { BackupFormatError, migrateBackupDocument } from "./migrators";
import { applyBackupSettings } from "./settings";
import { isZipFile, readZipEntries, readZipJson, type ZipEntry } from "./zip";

export type ImportBlockReason =
  | "offline"
  | "update_required"
  | "pending_changes"
  | "sync_failed";

export interface ImportReadiness {
  ready: boolean;
  reason: ImportBlockReason | null;
  pendingCount: number;
}

export class BackupImportBlockedError extends Error {
  readonly readiness: ImportReadiness;

  constructor(readiness: ImportReadiness) {
    super(`Backup import blocked: ${readiness.reason}`);
    this.name = "BackupImportBlockedError";
    this.readiness = readiness;
  }
}

export type BackupFileErrorCode =
  | "unrecognized"
  | "newer_version"
  | "sign_in_required";

export class BackupFileError extends Error {
  readonly code: BackupFileErrorCode;

  constructor(code: BackupFileErrorCode) {
    super(`Backup file error: ${code}`);
    this.name = "BackupFileError";
    this.code = code;
  }
}

function isSignedIn(): boolean {
  return isSupabaseConfigured && !!getCachedUserId();
}

/**
 * Import needs this device to match the account: counts merge as the
 * difference from local state, which is only the account's state once every
 * pending change has reached the server. Signed-out (local-only) data has no
 * server to agree with.
 */
export async function getImportReadiness(options: {
  sync: boolean;
}): Promise<ImportReadiness> {
  if (!isSignedIn()) return { ready: true, reason: null, pendingCount: 0 };
  const blocked = (reason: ImportBlockReason, pendingCount = 0) => ({
    ready: false,
    reason,
    pendingCount,
  });
  if (syncEngine.getState().updateRequired) return blocked("update_required");
  if (!navigator.onLine) return blocked("offline");
  if (options.sync) await syncEngine.sync();

  const state = syncEngine.getState();
  if (state.updateRequired) return blocked("update_required");
  const pendingCount = await countUnsyncedOperations();
  if (pendingCount > 0) return blocked("pending_changes", pendingCount);
  if (options.sync && state.lastError) return blocked("sync_failed");
  // Without the snapshot, local state is not the account's, and every count
  // would merge as its full value instead of the difference.
  if (!loadSyncProtocolV2()) return blocked("sync_failed");
  return { ready: true, reason: null, pendingCount: 0 };
}

export interface ImportProgress {
  phase: "syncing" | "reading" | "media" | "merging";
  done: number;
  total: number;
}

interface MediaRestoreCounts {
  restored: number;
  alreadyPresent: number;
  failed: number;
}

export type BackupImportResult =
  | { kind: "data"; summary: BackupImportSummary; media: MediaRestoreCounts }
  | {
      kind: "clips";
      media: MediaRestoreCounts;
      linked: number;
      unmatched: number;
    };

type ProgressListener = (progress: ImportProgress) => void;

async function readSource(
  file: File
): Promise<{ json: unknown; entries: Map<string, ZipEntry> | null }> {
  try {
    if (await isZipFile(file)) {
      const entries = await readZipEntries(file);
      const manifest =
        entries.get(BACKUP_JSON_NAME) ?? entries.get(CLIPS_JSON_NAME);
      if (!manifest) throw new BackupFileError("unrecognized");
      return { json: await readZipJson(manifest), entries };
    }
    return { json: JSON.parse(await file.text()), entries: null };
  } catch (err) {
    if (err instanceof BackupFileError) throw err;
    throw new BackupFileError("unrecognized");
  }
}

async function restoreArchivedMedia(
  files: BackupMediaFile[],
  entries: Map<string, ZipEntry> | null,
  onProgress?: ProgressListener
): Promise<{ counts: MediaRestoreCounts; renamed: Map<string, string> }> {
  const counts: MediaRestoreCounts = {
    restored: 0,
    alreadyPresent: 0,
    failed: 0,
  };
  const renamed = new Map<string, string>();
  for (const [index, file] of files.entries()) {
    onProgress?.({ phase: "media", done: index, total: files.length });
    const entry = entries?.get(mediaArchivePath(file));
    if (!entry || !isSignedIn()) {
      counts.failed += 1;
      continue;
    }
    try {
      const result = await restoreMediaFile(file, await entry.read());
      if (result.status === "renamed") {
        renamed.set(`${file.bucket}:${file.path}`, result.path);
      }
      if (result.status === "present") counts.alreadyPresent += 1;
      else counts.restored += 1;
    } catch (err) {
      console.warn("[backup] media restore failed", file.path, err);
      counts.failed += 1;
    }
  }
  return { counts, renamed };
}

async function importClips(
  json: unknown,
  entries: Map<string, ZipEntry> | null,
  onProgress?: ProgressListener
): Promise<BackupImportResult> {
  if (!isClipsManifest(json)) throw new BackupFileError("unrecognized");
  if (!isSignedIn()) throw new BackupFileError("sign_in_required");
  const target = currentSyncUserKey();
  const clips = json.clips.map((clip) => ({
    entry_date: clip.entry_date,
    archivePath: mediaArchivePath(clip.file),
    file: {
      ...clip.file,
      path: rewriteMediaOwner(clip.file.path, json.source_user_key, target),
    },
  }));

  const counts: MediaRestoreCounts = {
    restored: 0,
    alreadyPresent: 0,
    failed: 0,
  };
  let linked = 0;
  let unmatched = 0;
  for (const [index, clip] of clips.entries()) {
    onProgress?.({ phase: "media", done: index, total: clips.length });
    const entry = entries?.get(clip.archivePath);
    if (!entry) {
      counts.failed += 1;
      continue;
    }
    let finalPath: string;
    try {
      const result = await restoreMediaFile(clip.file, await entry.read());
      finalPath = result.path;
      if (result.status === "present") counts.alreadyPresent += 1;
      else counts.restored += 1;
    } catch (err) {
      console.warn("[backup] clip restore failed", clip.file.path, err);
      counts.failed += 1;
      continue;
    }

    const journal = await db.journalEntries
      .where("entry_date")
      .equals(clip.entry_date)
      .filter((row) => !row.deleted_at)
      .first();
    const current = journal?.video_path
      ? toJournalVideoPath(journal.video_path)
      : "";
    if (
      !journal ||
      (current && current !== clip.file.path && current !== finalPath)
    ) {
      unmatched += 1;
      continue;
    }
    if (current === finalPath) continue;
    await saveJournalEntry(
      {
        ...journal,
        video_path: finalPath,
        video_thumbnail: current ? journal.video_thumbnail : null,
        updated_at: now(),
      },
      journal.updated_at
    );
    linked += 1;
  }
  return { kind: "clips", media: counts, linked, unmatched };
}

/**
 * Restore a backup or clips archive into the signed-in account (or this
 * device's local data when signed out). Safe to repeat: a second import of
 * the same file changes nothing.
 */
export async function importBackupFile(
  file: File,
  onProgress?: ProgressListener
): Promise<BackupImportResult> {
  onProgress?.({ phase: "syncing", done: 0, total: 0 });
  const readiness = await getImportReadiness({ sync: true });
  if (!readiness.ready) throw new BackupImportBlockedError(readiness);

  onProgress?.({ phase: "reading", done: 0, total: 0 });
  const { json, entries } = await readSource(file);
  if (isClipsManifest(json)) return importClips(json, entries, onProgress);
  return importDocument(json, entries, onProgress);
}

/** A data document already in memory (the recovery bundle). Same rules as a file. */
export async function importBackupJson(
  json: unknown
): Promise<BackupImportResult> {
  const readiness = await getImportReadiness({ sync: true });
  if (!readiness.ready) throw new BackupImportBlockedError(readiness);
  return importDocument(json, null);
}

async function importDocument(
  json: unknown,
  entries: Map<string, ZipEntry> | null,
  onProgress?: ProgressListener
): Promise<BackupImportResult> {
  let doc;
  try {
    doc = migrateBackupDocument(json);
  } catch (err) {
    if (err instanceof BackupFormatError) throw new BackupFileError(err.code);
    throw err;
  }

  const targetUserKey = currentSyncUserKey();
  doc = remapBackupIdentity(doc, targetUserKey);
  const { counts, renamed } = await restoreArchivedMedia(
    doc.media,
    entries,
    onProgress
  );
  const tables = rewriteMediaReferences(doc.tables, renamed);

  onProgress?.({ phase: "merging", done: 0, total: 0 });
  const summary = await importBackup(tables, {
    targetUserKey,
    syncedSequence: loadLastAppliedSequence(),
  });
  await applyBackupSettings(doc.settings);
  if (isSignedIn()) void syncEngine.sync();
  return { kind: "data", summary, media: counts };
}
