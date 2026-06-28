import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OneTimeTask, RecurringMemo } from "@/lib/db/types";

const storage = new Map<string, string>();

function mockLocalStorage() {
  globalThis.localStorage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    key(index: number) {
      return [...storage.keys()][index] ?? null;
    },
  } as Storage;
}

const recurringMemos: RecurringMemo[] = [];
const oneTimeTasks: OneTimeTask[] = [];

let idCounter = 0;

vi.mock("@/lib/db", () => ({
  db: {
    recurringMemos: {
      filter: (predicate: (preset: RecurringMemo) => boolean) => ({
        toArray: async () => recurringMemos.filter(predicate),
      }),
    },
    oneTimeTasks: {
      filter: (predicate: (task: OneTimeTask) => boolean) => ({
        first: async () => oneTimeTasks.find(predicate),
        toArray: async () => oneTimeTasks.filter(predicate),
      }),
      add: async (task: OneTimeTask) => {
        oneTimeTasks.push(task);
      },
    },
  },
  newId: () => `task-${++idCounter}`,
  now: () => "2026-06-28T12:00:00.000Z",
}));

import { spawnRecurringMemosForToday } from "./spawn-recurring-memos";

function addPreset(
  partial: Partial<RecurringMemo> & Pick<RecurringMemo, "title" | "routine">
): RecurringMemo {
  const preset: RecurringMemo = {
    id: partial.id ?? `preset-${recurringMemos.length + 1}`,
    title: partial.title,
    routine: partial.routine,
    is_pinned: partial.is_pinned ?? false,
    is_enabled: partial.is_enabled ?? true,
    created_at: partial.created_at ?? "2026-06-28T12:00:00.000Z",
    updated_at: partial.updated_at ?? "2026-06-28T12:00:00.000Z",
    synced_at: null,
    deleted_at: partial.deleted_at ?? null,
  };
  recurringMemos.push(preset);
  return preset;
}

describe("spawnRecurringMemosForToday", () => {
  beforeEach(() => {
    storage.clear();
    mockLocalStorage();
    recurringMemos.length = 0;
    oneTimeTasks.length = 0;
    idCounter = 0;
  });

  it("spawns on anchor day and every 2nd day for custom:2:days", async () => {
    const preset = addPreset({
      id: "meds",
      title: "meds",
      routine: "custom:2:days",
      created_at: "2026-06-28T12:00:00.000Z",
    });

    expect(await spawnRecurringMemosForToday("2026-06-28")).toBe(1);
    expect(oneTimeTasks).toHaveLength(1);
    expect(oneTimeTasks[0]).toMatchObject({
      title: "meds",
      due_date: "2026-06-28",
      recurring_memo_id: preset.id,
    });

    expect(await spawnRecurringMemosForToday("2026-06-29")).toBe(0);
    expect(await spawnRecurringMemosForToday("2026-06-30")).toBe(1);
    expect(oneTimeTasks).toHaveLength(2);
    expect(oneTimeTasks[1].due_date).toBe("2026-06-30");
  });

  it("does not duplicate when called twice on the same day", async () => {
    addPreset({
      title: "meds",
      routine: "daily",
      created_at: "2026-06-28T12:00:00.000Z",
    });

    expect(await spawnRecurringMemosForToday("2026-06-30")).toBe(1);
    expect(await spawnRecurringMemosForToday("2026-06-30")).toBe(0);
    expect(oneTimeTasks).toHaveLength(1);
  });

  it("does not respawn if user soft-deleted today's instance", async () => {
    const preset = addPreset({
      id: "meds",
      title: "meds",
      routine: "daily",
      created_at: "2026-06-28T12:00:00.000Z",
    });

    expect(await spawnRecurringMemosForToday("2026-06-30")).toBe(1);
    oneTimeTasks[0] = {
      ...oneTimeTasks[0],
      deleted_at: "2026-06-30T15:00:00.000Z",
    };

    expect(await spawnRecurringMemosForToday("2026-06-30")).toBe(0);
    expect(
      oneTimeTasks.filter((task) => task.recurring_memo_id === preset.id)
    ).toHaveLength(1);
  });

  it("does not backfill missed due days", async () => {
    addPreset({
      title: "meds",
      routine: "daily",
      created_at: "2026-06-20T12:00:00.000Z",
    });

    expect(await spawnRecurringMemosForToday("2026-06-30")).toBe(1);
    expect(oneTimeTasks).toHaveLength(1);
    expect(oneTimeTasks[0].due_date).toBe("2026-06-30");
  });

  it("skips disabled presets", async () => {
    addPreset({
      title: "meds",
      routine: "daily",
      is_enabled: false,
      created_at: "2026-06-28T12:00:00.000Z",
    });

    expect(await spawnRecurringMemosForToday("2026-06-30")).toBe(0);
  });

  it("does not duplicate when spawn runs concurrently", async () => {
    addPreset({
      title: "meds",
      routine: "daily",
      created_at: "2026-06-28T12:00:00.000Z",
    });

    const results = await Promise.all([
      spawnRecurringMemosForToday("2026-06-30"),
      spawnRecurringMemosForToday("2026-06-30"),
    ]);

    expect(oneTimeTasks).toHaveLength(1);
    expect(results).toEqual([1, 1]);
  });
});
