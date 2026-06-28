import { db, newId, now } from "@/lib/db";
import type { RecurringMemo } from "@/lib/db/types";
import { isRoutineDueOnDate } from "@/lib/activity/utils";
import { getEffectiveToday } from "@/lib/session/day-reset";
import { fromDateString } from "@/lib/time-utils";
import { normalizeMemoTitle } from "@/components/tasks/memo-title";

async function hasInstanceForToday(
  recurringMemoId: string,
  today: string
): Promise<boolean> {
  const existing = await db.oneTimeTasks
    .filter(
      (task) =>
        task.recurring_memo_id === recurringMemoId && task.due_date === today
    )
    .first();
  return existing !== undefined;
}

async function spawnRecurringMemosForTodayInternal(
  today: string
): Promise<number> {
  const presets = await db.recurringMemos
    .filter((preset) => !preset.deleted_at && preset.is_enabled !== false)
    .toArray();

  const todayDate = fromDateString(today);
  let spawned = 0;

  for (const preset of presets) {
    if (preset.routine === "anytime" || preset.routine === "never") {
      continue;
    }

    if (
      !isRoutineDueOnDate(
        { routine: preset.routine, created_at: preset.created_at },
        todayDate
      )
    ) {
      continue;
    }

    if (await hasInstanceForToday(preset.id, today)) {
      continue;
    }

    const title = normalizeMemoTitle(preset.title);
    if (!title) continue;

    const n = now();
    await db.oneTimeTasks.add({
      id: newId(),
      date: null,
      title,
      is_completed: false,
      order_index: null,
      is_pinned: preset.is_pinned ?? false,
      due_date: today,
      group_id: null,
      is_archived: false,
      recurring_memo_id: preset.id,
      created_at: n,
      updated_at: n,
      synced_at: null,
      deleted_at: null,
    });
    spawned += 1;
  }

  return spawned;
}

let spawnInFlight: Promise<number> | null = null;

export async function spawnRecurringMemosForToday(
  today = getEffectiveToday()
): Promise<number> {
  if (spawnInFlight) {
    return spawnInFlight;
  }

  spawnInFlight = spawnRecurringMemosForTodayInternal(today).finally(() => {
    spawnInFlight = null;
  });

  return spawnInFlight;
}

export async function loadActiveRecurringMemos(): Promise<RecurringMemo[]> {
  const presets = await db.recurringMemos
    .filter((preset) => !preset.deleted_at)
    .toArray();
  return presets.sort((a, b) => a.title.localeCompare(b.title));
}
