import { useState, useCallback } from "react";
import { db, newId, now } from "@/lib/db";
import type { RecurringMemo } from "@/lib/db/types";
import { normalizeMemoTitle } from "@/components/tasks/memo-title";
import { buildRoutineString, type RoutineFormData } from "@/lib/activity/routine-form";
import {
  loadActiveRecurringMemos,
  spawnRecurringMemosForToday,
} from "@/lib/memos/spawn-recurring-memos";

export function useRecurringMemos() {
  const [recurringMemos, setRecurringMemos] = useState<RecurringMemo[]>([]);

  const loadRecurringMemos = useCallback(async () => {
    try {
      const presets = await loadActiveRecurringMemos();
      setRecurringMemos(presets);
    } catch (error) {
      console.error("Error loading recurring memos:", error);
    }
  }, []);

  const createRecurringMemo = useCallback(
    async (
      title: string,
      options: {
        routine: string;
        is_pinned?: boolean;
      }
    ): Promise<boolean> => {
      const normalizedTitle = normalizeMemoTitle(title);
      if (!normalizedTitle) return false;
      try {
        const n = now();
        const preset: RecurringMemo = {
          id: newId(),
          title: normalizedTitle,
          routine: options.routine,
          is_pinned: options.is_pinned ?? false,
          is_enabled: true,
          created_at: n,
          updated_at: n,
          synced_at: null,
          deleted_at: null,
        };
        await db.recurringMemos.add(preset);
        await spawnRecurringMemosForToday();
        await loadRecurringMemos();
        return true;
      } catch (error) {
        console.error("Error creating recurring memo:", error);
        return false;
      }
    },
    [loadRecurringMemos]
  );

  const updateRecurringMemo = useCallback(
    async (
      id: string,
      patch: Partial<Pick<RecurringMemo, "title" | "routine" | "is_pinned" | "is_enabled">>
    ): Promise<boolean> => {
      if (patch.title !== undefined && !normalizeMemoTitle(patch.title)) {
        return false;
      }
      try {
        const n = now();
        const updates: Partial<RecurringMemo> = {
          ...patch,
          updated_at: n,
        };
        if (patch.title !== undefined) {
          updates.title = normalizeMemoTitle(patch.title);
        }
        await db.recurringMemos.update(id, updates);
        await loadRecurringMemos();
        return true;
      } catch (error) {
        console.error("Error updating recurring memo:", error);
        return false;
      }
    },
    [loadRecurringMemos]
  );

  const deleteRecurringMemo = useCallback(
    async (id: string): Promise<void> => {
      const n = now();
      await db.recurringMemos.update(id, { deleted_at: n, updated_at: n });
      await loadRecurringMemos();
    },
    [loadRecurringMemos]
  );

  return {
    recurringMemos,
    loadRecurringMemos,
    createRecurringMemo,
    updateRecurringMemo,
    deleteRecurringMemo,
  };
}

export function routineFormToString(form: RoutineFormData): string {
  return buildRoutineString(form);
}
