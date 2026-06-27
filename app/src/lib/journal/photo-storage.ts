import {
  supabase,
  isSupabaseConfigured,
  getCachedUserId,
} from "@/lib/supabase";
import { compressPhoto, PhotoCompressionError } from "./photo-compression";

export class JournalPhotoUploadError extends Error {}

const JOURNAL_PHOTO_BUCKET = "journal-photos";

export async function uploadJournalPhoto(
  file: File,
  entryDate: string
): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    throw new JournalPhotoUploadError(
      "Cloud sync is not configured. Connect Supabase in Settings to upload photos."
    );
  }

  const userId = getCachedUserId();
  if (!userId) {
    throw new JournalPhotoUploadError(
      "You need to be signed in to upload photos."
    );
  }

  let compressed: File;
  try {
    compressed = await compressPhoto(file);
  } catch (error) {
    if (error instanceof PhotoCompressionError) {
      throw new JournalPhotoUploadError(error.message);
    }
    throw new JournalPhotoUploadError("Failed to process photo.");
  }

  const safeName = compressed.name.replace(/[^\w.-]/g, "_").toLowerCase();
  const timestamp = Date.now();
  const path = `${userId}/${entryDate}/${timestamp}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(JOURNAL_PHOTO_BUCKET)
    .upload(path, compressed, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error || !data) {
    throw new JournalPhotoUploadError(
      error?.message ?? "Failed to upload photo."
    );
  }

  return data.path;
}

export async function deleteJournalPhoto(photoPath: string): Promise<void> {
  const path = photoPath.trim();
  if (!path || !isSupabaseConfigured || !supabase) {
    return;
  }

  const userId = getCachedUserId();
  if (!userId || !path.startsWith(`${userId}/`)) {
    return;
  }

  const { error } = await supabase.storage
    .from(JOURNAL_PHOTO_BUCKET)
    .remove([path]);

  if (error) {
    throw new JournalPhotoUploadError(
      error.message ?? "Failed to delete photo."
    );
  }
}

export function getJournalPhotoUrl(photoPath: string): string | null {
  if (!photoPath.trim() || !isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data } = supabase.storage
    .from(JOURNAL_PHOTO_BUCKET)
    .getPublicUrl(photoPath);

  return data?.publicUrl ?? null;
}
