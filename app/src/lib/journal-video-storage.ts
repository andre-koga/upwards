/**
 * SRP: Handles upload and storage of journal videos to Supabase.
 */
import {
  supabase,
  isSupabaseConfigured,
  getCachedUserId,
} from "@/lib/supabase";

const JOURNAL_VIDEO_BUCKET = "journal-videos";
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB

export class JournalVideoUploadError extends Error {}

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

  if (file.size > MAX_VIDEO_BYTES) {
    throw new JournalVideoUploadError(
      "Video is too large (max 50MB). Please compress it before uploading."
    );
  }

  const safeName = file.name.replace(/[^\w.-]/g, "_").toLowerCase();
  const timestamp = Date.now();
  const path = `${userId}/${entryDate}/${timestamp}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(JOURNAL_VIDEO_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error || !data) {
    throw new JournalVideoUploadError(
      error?.message ?? "Failed to upload video."
    );
  }

  const { data: publicUrl } = supabase.storage
    .from(JOURNAL_VIDEO_BUCKET)
    .getPublicUrl(data.path);

  if (!publicUrl?.publicUrl) {
    throw new JournalVideoUploadError(
      "Could not generate public URL for uploaded video."
    );
  }

  return publicUrl.publicUrl;
}
