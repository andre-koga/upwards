import {
  supabase,
  isSupabaseConfigured,
  getCachedUserId,
} from "@/lib/supabase";
import { compressVideo, VideoCompressionError } from "./video-compression";

export class JournalVideoUploadError extends Error {}

const JOURNAL_VIDEO_BUCKET = "journal-videos";

export async function uploadJournalVideo(
  file: File,
  entryDate: string
): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    throw new JournalVideoUploadError(
      "Cloud sync is not configured. Connect Supabase in Settings to upload videos."
    );
  }

  const userId = getCachedUserId();
  if (!userId) {
    throw new JournalVideoUploadError(
      "You need to be signed in to upload videos."
    );
  }

  let compressed: File;
  try {
    compressed = await compressVideo(file);
  } catch (error) {
    if (error instanceof VideoCompressionError) {
      throw new JournalVideoUploadError(error.message);
    }
    throw new JournalVideoUploadError("Failed to process video.");
  }

  const safeName = compressed.name.replace(/[^\w.-]/g, "_").toLowerCase();
  const timestamp = Date.now();
  const path = `${userId}/${entryDate}/${timestamp}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(JOURNAL_VIDEO_BUCKET)
    .upload(path, compressed, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error || !data) {
    throw new JournalVideoUploadError(
      error?.message ?? "Failed to upload video."
    );
  }

  return data.path;
}

export function getJournalVideoPlaybackUrl(videoPath: string): string | null {
  const normalizedPath = toJournalVideoPath(videoPath);
  if (!normalizedPath || !isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data } = supabase.storage
    .from(JOURNAL_VIDEO_BUCKET)
    .getPublicUrl(normalizedPath);

  return data?.publicUrl ?? null;
}

export async function deleteJournalVideoByPath(
  videoPath: string
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const objectPath = toJournalVideoPath(videoPath);
  if (!objectPath) {
    return;
  }

  const userId = getCachedUserId();
  if (!userId) {
    throw new JournalVideoUploadError(
      "You need to be signed in to remove uploaded videos."
    );
  }

  // Safety: only allow deleting objects in this user's namespace.
  if (!objectPath.startsWith(`${userId}/`)) {
    return;
  }

  const { error } = await supabase.storage
    .from(JOURNAL_VIDEO_BUCKET)
    .remove([objectPath]);

  if (error) {
    throw new JournalVideoUploadError(
      error.message ?? "Failed to delete uploaded video."
    );
  }
}

export function toJournalVideoPath(videoPathOrLegacyUrl: string): string {
  const raw = videoPathOrLegacyUrl.trim();
  if (!raw) return "";

  if (!raw.includes("://")) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    const expectedPrefix = `/storage/v1/object/public/${JOURNAL_VIDEO_BUCKET}/`;
    const pathname = parsed.pathname;
    if (!pathname.startsWith(expectedPrefix)) {
      return "";
    }

    const encodedPath = pathname.slice(expectedPrefix.length);
    return decodeURIComponent(encodedPath);
  } catch {
    return "";
  }
}
