import {
  supabase,
  isSupabaseConfigured,
  getCachedUserId,
} from "@/lib/supabase";
import {
  compressPhoto,
  PhotoCompressionError,
} from "@/lib/journal/photo-compression";

export class MemoryPhotoUploadError extends Error {}
const BUCKET = "journal-photos";

export async function uploadMemoryPhoto(
  file: File,
  memoryId: string
): Promise<string> {
  if (!isSupabaseConfigured || !supabase)
    throw new MemoryPhotoUploadError(
      "Cloud sync is not configured. Connect Supabase in Settings to upload photos."
    );
  const userId = getCachedUserId();
  if (!userId)
    throw new MemoryPhotoUploadError(
      "You need to be signed in to upload photos."
    );
  try {
    const compressed = await compressPhoto(file);
    const safeName = compressed.name.replace(/[^\w.-]/g, "_").toLowerCase();
    const path = `${userId}/memories/${memoryId}/${Date.now()}-${safeName}`;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, compressed, { cacheControl: "3600", upsert: false });
    if (!data || error)
      throw new MemoryPhotoUploadError(
        error?.message ?? "Failed to upload photo."
      );
    return data.path;
  } catch (error) {
    if (error instanceof MemoryPhotoUploadError) throw error;
    if (error instanceof PhotoCompressionError)
      throw new MemoryPhotoUploadError(error.message);
    throw new MemoryPhotoUploadError("Failed to process photo.");
  }
}

export async function deleteMemoryPhoto(path: string): Promise<void> {
  const userId = getCachedUserId();
  if (!userId || !supabase || !path.startsWith(`${userId}/memories/`)) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new MemoryPhotoUploadError(error.message);
}

export function getMemoryPhotoUrl(path: string): string | null {
  if (!supabase || !path.trim()) return null;
  return (
    supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl ?? null
  );
}
