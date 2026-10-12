import { newId, now } from "@/lib/db";
import type { Memory } from "@/lib/db/types";
import { deleteMemoryPhoto } from "@/lib/memory-photo-storage";
import { eraseMemory, saveMemory } from "@/lib/sync/mutate-synced";

export type MemoryValues = Pick<
  Memory,
  "text_content" | "photo_paths" | "time_label"
>;

/** A blank memory, with its id, ready for the edit dialog. */
export function blankMemory(): Memory {
  const timestamp = now();
  return {
    id: newId(),
    text_content: null,
    photo_paths: null,
    time_label: null,
    created_at: timestamp,
    updated_at: timestamp,
    synced_at: null,
    deleted_at: null,
  };
}

export async function saveMemoryValues(
  memory: Memory,
  values: MemoryValues
): Promise<void> {
  await saveMemory(
    { ...memory, ...values, updated_at: now() },
    memory.updated_at
  );
}

/** Memories are trashed, not removed: there is an in-app way back. */
export async function trashMemory(memory: Memory): Promise<void> {
  const timestamp = now();
  await saveMemory(
    { ...memory, deleted_at: timestamp, updated_at: timestamp },
    memory.updated_at
  );
}

export async function restoreMemory(memory: Memory): Promise<void> {
  await saveMemory(
    { ...memory, deleted_at: null, updated_at: now() },
    memory.updated_at
  );
}

/** Deleting from the trash is the one permanent step; photos go with it. */
export async function eraseTrashedMemory(memory: Memory): Promise<void> {
  await Promise.all(
    (memory.photo_paths ?? []).map((path) =>
      deleteMemoryPhoto(path).catch(() => undefined)
    )
  );
  await eraseMemory(memory);
}
