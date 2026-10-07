import { db } from "@/lib/db";
import { getCachedUserId } from "@/lib/supabase";
import { syncEngine } from "@/lib/sync";
import { currentSyncUserKey } from "@/lib/sync/natural-ids";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_JSON_NAME,
  CLIPS_FORMAT,
  CLIPS_FORMAT_VERSION,
  CLIPS_JSON_NAME,
  mediaArchivePath,
  type BackupDocument,
  type BackupMediaFile,
  type BackupTables,
  type ClipsManifest,
} from "./format";
import {
  collectClipRefs,
  collectPhotoRefs,
  describeMedia,
  downloadMedia,
  type MediaRef,
} from "./media";
import { readBackupSettings } from "./settings";
import { ZipBlobWriter } from "./zip";

export interface BackupProgress {
  phase: "syncing" | "collecting" | "media" | "packing";
  done: number;
  total: number;
}

type ProgressListener = (progress: BackupProgress) => void;

export interface ExportResult {
  /** Media that could not be downloaded and is missing from the archive. */
  missingMedia: number;
}

/** Push and pull first so the file reflects what the account holds. */
async function syncBeforeExport(onProgress?: ProgressListener) {
  if (!getCachedUserId() || !navigator.onLine) return;
  onProgress?.({ phase: "syncing", done: 0, total: 0 });
  await syncEngine.sync();
}

async function readBackupTables(): Promise<BackupTables> {
  const [
    activityGroups,
    activities,
    dailyEntries,
    activityPeriods,
    journalEntries,
    journalEntryRevisions,
    memories,
    oneTimeTasks,
  ] = await Promise.all([
    db.activityGroups.toArray(),
    db.activities.toArray(),
    db.dailyEntries.toArray(),
    db.activityPeriods.toArray(),
    db.journalEntries.toArray(),
    db.journalEntryRevisions.toArray(),
    db.memories.toArray(),
    db.oneTimeTasks.toArray(),
  ]);
  return {
    activityGroups,
    activities,
    dailyEntries,
    activityPeriods,
    journalEntries,
    journalEntryRevisions,
    memories,
    oneTimeTasks,
  };
}

export async function buildBackupDocument(options?: {
  tables?: BackupTables;
  media?: BackupMediaFile[];
}): Promise<BackupDocument> {
  return {
    format: BACKUP_FORMAT,
    format_version: BACKUP_FORMAT_VERSION,
    exported_at: new Date().toISOString(),
    source_user_key: currentSyncUserKey(),
    settings: readBackupSettings(),
    tables: options?.tables ?? (await readBackupTables()),
    media: options?.media ?? [],
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function addMedia(
  zip: ZipBlobWriter,
  refs: MediaRef[],
  onProgress?: ProgressListener
): Promise<{ files: BackupMediaFile[]; missing: number }> {
  const files: BackupMediaFile[] = [];
  let missing = 0;
  for (const [index, ref] of refs.entries()) {
    onProgress?.({ phase: "media", done: index, total: refs.length });
    try {
      const { file, bytes } = await describeMedia(
        ref,
        await downloadMedia(ref)
      );
      zip.addFile(mediaArchivePath(file), bytes);
      files.push(file);
    } catch (err) {
      console.warn("[backup] media unavailable", ref.path, err);
      missing += 1;
    }
  }
  return { files, missing };
}

export async function exportDataOnly(
  onProgress?: ProgressListener
): Promise<ExportResult> {
  await syncBeforeExport(onProgress);
  onProgress?.({ phase: "collecting", done: 0, total: 0 });
  const zip = new ZipBlobWriter();
  zip.addJson(BACKUP_JSON_NAME, await buildBackupDocument());
  onProgress?.({ phase: "packing", done: 0, total: 0 });
  downloadBlob(await zip.finish(), `upwards-backup-${today()}.zip`);
  return { missingMedia: 0 };
}

/** Data plus journal and memory photos. Video posters live in the rows. */
export async function exportDataWithPhotos(
  onProgress?: ProgressListener
): Promise<ExportResult> {
  await syncBeforeExport(onProgress);
  onProgress?.({ phase: "collecting", done: 0, total: 0 });
  const tables = await readBackupTables();
  const zip = new ZipBlobWriter();
  const { files, missing } = await addMedia(
    zip,
    collectPhotoRefs(tables),
    onProgress
  );
  zip.addJson(
    BACKUP_JSON_NAME,
    await buildBackupDocument({ tables, media: files })
  );
  onProgress?.({ phase: "packing", done: 0, total: 0 });
  downloadBlob(await zip.finish(), `upwards-backup-photos-${today()}.zip`);
  return { missingMedia: missing };
}

export interface ClipYear {
  year: number;
  count: number;
}

export async function listClipYears(): Promise<ClipYear[]> {
  const counts = new Map<number, number>();
  for (const clip of collectClipRefs(await readBackupTables())) {
    const year = Number(clip.entry_date.slice(0, 4));
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year);
}

/** One zip per year keeps each clips download a size a phone can build. */
export async function exportClipsForYear(
  year: number,
  onProgress?: ProgressListener
): Promise<ExportResult> {
  await syncBeforeExport(onProgress);
  onProgress?.({ phase: "collecting", done: 0, total: 0 });
  const refs = collectClipRefs(await readBackupTables()).filter((clip) =>
    clip.entry_date.startsWith(`${year}-`)
  );
  const zip = new ZipBlobWriter();
  const clips: ClipsManifest["clips"] = [];
  let missing = 0;
  for (const [index, ref] of refs.entries()) {
    onProgress?.({ phase: "media", done: index, total: refs.length });
    const added = await addMedia(zip, [ref]);
    missing += added.missing;
    if (added.files[0]) {
      clips.push({ entry_date: ref.entry_date, file: added.files[0] });
    }
  }
  const manifest: ClipsManifest = {
    format: CLIPS_FORMAT,
    format_version: CLIPS_FORMAT_VERSION,
    exported_at: new Date().toISOString(),
    source_user_key: currentSyncUserKey(),
    year,
    clips,
  };
  zip.addJson(CLIPS_JSON_NAME, manifest);
  onProgress?.({ phase: "packing", done: 0, total: 0 });
  downloadBlob(await zip.finish(), `upwards-clips-${year}.zip`);
  return { missingMedia: missing };
}
