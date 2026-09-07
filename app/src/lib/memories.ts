import type { Memory } from "@/lib/db/types";

export const MEMORY_TEXT_LIMIT = 300;
export const MEMORY_PHOTO_LIMIT = 8;

export function memoryHasContent(
  memory: Pick<Memory, "text_content" | "photo_paths">
): boolean {
  return Boolean(memory.text_content?.trim() || memory.photo_paths?.length);
}

/** Active memories, newest first. */
export function sortMemories(memories: Memory[]): Memory[] {
  return memories
    .filter((memory) => !memory.deleted_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
