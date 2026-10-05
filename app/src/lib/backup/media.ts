import { supabase } from "@/lib/supabase";
import { toJournalVideoPath } from "@/lib/journal/video-storage";
import {
  PHOTO_BUCKET,
  VIDEO_BUCKET,
  type BackupMediaFile,
  type BackupTables,
  type MediaBucket,
} from "./format";

class MediaUnavailableError extends Error {}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    data as Uint8Array<ArrayBuffer>
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export interface MediaRef {
  bucket: MediaBucket;
  path: string;
}

/** Journal and memory photos still referenced by a live row. */
export function collectPhotoRefs(tables: BackupTables): MediaRef[] {
  const paths = new Set<string>();
  for (const entry of tables.journalEntries) {
    if (entry.deleted_at) continue;
    for (const path of entry.photo_paths ?? [])
      if (path.trim()) paths.add(path);
  }
  for (const memory of tables.memories) {
    if (memory.deleted_at) continue;
    for (const path of memory.photo_paths ?? [])
      if (path.trim()) paths.add(path);
  }
  // Revisions are never deleted, so the photos they reference stay in the backup.
  for (const revision of tables.journalEntryRevisions) {
    for (const path of revision.photo_paths ?? [])
      if (path.trim()) paths.add(path);
  }
  return [...paths].map((path) => ({ bucket: PHOTO_BUCKET, path }));
}

export interface ClipRef extends MediaRef {
  entry_date: string;
}

export function collectClipRefs(tables: BackupTables): ClipRef[] {
  const clips: ClipRef[] = [];
  for (const entry of tables.journalEntries) {
    if (entry.deleted_at || !entry.video_path) continue;
    const path = toJournalVideoPath(entry.video_path);
    if (path)
      clips.push({ bucket: VIDEO_BUCKET, path, entry_date: entry.entry_date });
  }
  return clips.sort((a, b) => a.entry_date.localeCompare(b.entry_date));
}

export async function downloadMedia(ref: MediaRef): Promise<Blob> {
  if (!supabase) throw new MediaUnavailableError("Storage is not configured");
  const { data, error } = await supabase.storage
    .from(ref.bucket)
    .download(ref.path);
  if (error || !data) {
    throw new MediaUnavailableError(error?.message ?? "Download failed");
  }
  return data;
}

export async function describeMedia(
  ref: MediaRef,
  blob: Blob
): Promise<{ file: BackupMediaFile; bytes: Uint8Array }> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    bytes,
    file: {
      bucket: ref.bucket,
      path: ref.path,
      sha256: await sha256Hex(bytes),
      size: bytes.byteLength,
      content_type: blob.type || null,
    },
  };
}

function isAlreadyExists(error: unknown): boolean {
  const record = error as { statusCode?: unknown; message?: unknown } | null;
  return (
    String(record?.statusCode ?? "") === "409" ||
    /already exists|duplicate/i.test(String(record?.message ?? ""))
  );
}

async function uploadIfAbsent(
  bucket: MediaBucket,
  path: string,
  bytes: Uint8Array,
  contentType: string | null
): Promise<"uploaded" | "exists"> {
  if (!supabase) throw new MediaUnavailableError("Storage is not configured");
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, new Blob([bytes as Uint8Array<ArrayBuffer>]), {
      cacheControl: "3600",
      upsert: false,
      ...(contentType ? { contentType } : {}),
    });
  if (!error) return "uploaded";
  if (isAlreadyExists(error)) return "exists";
  throw new MediaUnavailableError(error.message);
}

function contentAddressedPath(path: string, sha256: string): string {
  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  return `${dir}${sha256.slice(0, 16)}-${name}`;
}

export type MediaRestoreStatus = "uploaded" | "present" | "renamed";

/**
 * Put one archived file back in storage, deduplicated by content hash. A file
 * already at its path with the same hash is left alone. A different file at
 * that path is never overwritten: this one goes to a hash-named sibling and the
 * caller rewrites references to it.
 */
export async function restoreMediaFile(
  file: BackupMediaFile,
  bytes: Uint8Array
): Promise<{ path: string; status: MediaRestoreStatus }> {
  const actual = await sha256Hex(bytes);
  if (actual !== file.sha256) {
    throw new MediaUnavailableError(`Checksum mismatch for ${file.path}`);
  }

  const first = await uploadIfAbsent(
    file.bucket,
    file.path,
    bytes,
    file.content_type
  );
  if (first === "uploaded") return { path: file.path, status: "uploaded" };

  const existing = await describeMedia(file, await downloadMedia(file));
  if (existing.file.sha256 === file.sha256) {
    return { path: file.path, status: "present" };
  }

  const alternate = contentAddressedPath(file.path, file.sha256);
  await uploadIfAbsent(file.bucket, alternate, bytes, file.content_type);
  return { path: alternate, status: "renamed" };
}

/** Point rows at the paths restored media actually landed on. */
export function rewriteMediaReferences(
  tables: BackupTables,
  renamed: Map<string, string>
): BackupTables {
  if (renamed.size === 0) return tables;
  const photo = (path: string) =>
    renamed.get(`${PHOTO_BUCKET}:${path}`) ?? path;
  const video = (path: string | null) =>
    path
      ? (renamed.get(`${VIDEO_BUCKET}:${toJournalVideoPath(path)}`) ?? path)
      : path;
  return {
    ...tables,
    journalEntries: tables.journalEntries.map((entry) => ({
      ...entry,
      photo_paths: entry.photo_paths ? entry.photo_paths.map(photo) : null,
      video_path: video(entry.video_path),
    })),
    journalEntryRevisions: tables.journalEntryRevisions.map((revision) => ({
      ...revision,
      photo_paths: revision.photo_paths
        ? revision.photo_paths.map(photo)
        : null,
      video_path: video(revision.video_path),
    })),
    memories: tables.memories.map((memory) => ({
      ...memory,
      photo_paths: memory.photo_paths ? memory.photo_paths.map(photo) : null,
    })),
  };
}
