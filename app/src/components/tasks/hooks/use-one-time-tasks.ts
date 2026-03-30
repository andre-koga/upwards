import { useState, useCallback } from "react";
import { db, now, newId } from "@/lib/db";
import { todayDateString } from "@/lib/time-utils";
import type { OneTimeTask } from "@/lib/db/types";
import { normalizeMemoTitle } from "@/components/tasks/memo-title";

function sortMemos(tasks: OneTimeTask[]): OneTimeTask[] {
  return [...tasks].sort((a, b) => {
    const aPinned = !!a.is_pinned;
    const bPinned = !!b.is_pinned;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    const aDue = a.due_date ?? "9999-12-31";
    const bDue = b.due_date ?? "9999-12-31";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function useOneTimeTasks(dateString: string) {
  const [oneTimeTasks, setOneTimeTasks] = useState<OneTimeTask[]>([]);

  const loadOneTimeTasks = useCallback(async () => {
    try {
      const today = todayDateString();

      if (dateString === today) {
        const [incompleteTasks, completedTodayTasks] = await Promise.all([
          db.oneTimeTasks
            .filter((task) => !task.deleted_at && !task.is_completed)
            .toArray(),
          db.oneTimeTasks
            .where("date")
            .equals(today)
            .filter((task) => !task.deleted_at && !!task.is_completed)
            .toArray(),
        ]);

        const tasks = sortMemos([...incompleteTasks, ...completedTodayTasks]);
        setOneTimeTasks(tasks);
        return;
      }

      const rawTasks = await db.oneTimeTasks
        .where("date")
        .equals(dateString)
        .filter((task) => !task.deleted_at && !!task.is_completed)
        .toArray();
      const tasks = sortMemos(rawTasks);
      setOneTimeTasks(tasks);
    } catch (error) {
      console.error("Error loading one-time tasks:", error);
    }
  }, [dateString]);

  const createOneTimeTask = useCallback(
    async (
      title: string,
      options?: { due_date?: string | null; is_pinned?: boolean }
    ): Promise<boolean> => {
      const normalizedTitle = normalizeMemoTitle(title);
      if (!normalizedTitle) return false;
      try {
        const n = now();
        const task: OneTimeTask = {
          id: newId(),
          date: null,
          title: normalizedTitle,
          is_completed: false,
          order_index: null,
          is_pinned: options?.is_pinned ?? false,
          due_date: options?.due_date ?? null,
          created_at: n,
          updated_at: n,
          synced_at: null,
          deleted_at: null,
        };
        await db.oneTimeTasks.add(task);
        setOneTimeTasks((prev) => sortMemos([...prev, task]));
        return true;
      } catch (error) {
        console.error("Error creating one-time task:", error);
        return false;
      }
    },
    []
  );

  const toggleOneTimeTask = useCallback(async (task: OneTimeTask) => {
    const newVal = !task.is_completed;
    const completedDate = newVal ? todayDateString() : null;
    setOneTimeTasks((prev) =>
      sortMemos(
        prev.map((t) =>
          t.id === task.id
            ? { ...t, is_completed: newVal, date: completedDate }
            : t
        )
      )
    );
    await db.oneTimeTasks.update(task.id, {
      is_completed: newVal,
      date: completedDate,
      updated_at: now(),
    });
  }, []);

  const deleteOneTimeTask = useCallback(async (taskId: string) => {
    setOneTimeTasks((prev) => prev.filter((t) => t.id !== taskId));
    await db.oneTimeTasks.delete(taskId);
  }, []);

  const updateOneTimeTask = useCallback(
    async (
      taskId: string,
      patch: Partial<Pick<OneTimeTask, "title" | "is_pinned" | "due_date">>
    ): Promise<boolean> => {
      if (patch.title !== undefined && !normalizeMemoTitle(patch.title)) {
        return false;
      }
      try {
        const n = now();
        const updates: Partial<OneTimeTask> = {
          ...patch,
          updated_at: n,
        };
        if (patch.title !== undefined) {
          updates.title = normalizeMemoTitle(patch.title);
        }
        setOneTimeTasks((prev) =>
          sortMemos(
            prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
          )
        );
        await db.oneTimeTasks.update(taskId, updates);
        return true;
      } catch (error) {
        console.error("Error updating one-time task:", error);
        return false;
      }
    },
    []
  );

  return {
    oneTimeTasks,
    loadOneTimeTasks,
    createOneTimeTask,
    toggleOneTimeTask,
    deleteOneTimeTask,
    updateOneTimeTask,
  };
}
