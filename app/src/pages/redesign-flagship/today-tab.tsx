import { Check, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rhythmBars, tasks } from "@/pages/redesign-preview-data";
import { MonoLabel, ShortcutChip } from "./shared";

// Today stays the "concrete" register throughout: tabular numerals,
// hairline rows, number-key shortcuts — this is the operational surface,
// not the reflective one.

function TaskRow({
  task,
  index,
}: {
  task: (typeof tasks)[number];
  index: number;
}) {
  const complete = task.state === "complete";
  const current = task.state === "current";
  return (
    <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0">
      <button
        type="button"
        aria-label={
          complete ? `Completed: ${task.title}` : `Mark ${task.title} complete`
        }
        className={cn(
          "flex size-[1.15rem] shrink-0 items-center justify-center rounded-full border",
          complete
            ? "border-[var(--green)] bg-[var(--green)] text-white"
            : "border-[#c7cec7] text-transparent"
        )}
      >
        {complete ? <Check className="size-3" /> : null}
      </button>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: task.color }}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium text-[var(--ink)]",
            complete && "text-[var(--muted)] line-through"
          )}
        >
          {task.title}
        </p>
        <p className="mt-0.5 truncate font-mono text-[0.68rem] tabular-nums text-[var(--muted)]">
          {task.meta}
        </p>
      </div>
      {current ? (
        <span className="shrink-0 rounded-md bg-[#f3dfd7] px-1.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase text-[#a4523b]">
          now
        </span>
      ) : null}
      <ShortcutChip>{index + 1}</ShortcutChip>
    </div>
  );
}

export function TodayTab() {
  return (
    <div className="space-y-4">
      <div>
        <MonoLabel>Wednesday, September 23</MonoLabel>
        <h1 className="mt-1.5 font-display text-[clamp(1.9rem,4vw,2.5rem)] leading-[1] tracking-[-0.03em] text-[var(--ink)]">
          4 things, in order
        </h1>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
          <MonoLabel>Today · 4 items</MonoLabel>
          <div className="flex items-center gap-1.5">
            <ShortcutChip>N</ShortcutChip>
            <Button
              type="button"
              variant="bare"
              className="h-7 gap-1 rounded-md px-2 text-xs font-semibold text-[var(--green)] hover:bg-[var(--sage)]"
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        </div>
        {tasks.map((task, i) => (
          <TaskRow key={task.title} task={task} index={i} />
        ))}
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3.5">
        <div className="flex items-center justify-between">
          <MonoLabel>This week</MonoLabel>
          <p className="font-mono text-xs tabular-nums text-[var(--muted)]">
            74% avg
          </p>
        </div>
        <div className="mt-3 flex h-20 items-end justify-between gap-2">
          {rhythmBars.map((bar) => (
            <div
              key={`${bar.day}-${bar.value}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            >
              <span className="font-mono text-[0.62rem] tabular-nums text-[var(--faint)]">
                {bar.value}
              </span>
              <div
                className={cn(
                  "w-full max-w-6 rounded-t-sm",
                  bar.active ? "bg-[var(--green)]" : "bg-[#d7e0d8]"
                )}
                style={{ height: `${bar.value}%` }}
              />
              <span className="font-mono text-[0.62rem] text-[var(--muted)]">
                {bar.day}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="hidden text-[0.68rem] text-[var(--faint)] lg:block">
        <span className="font-mono">j / k</span> to move ·{" "}
        <span className="font-mono">x</span> to complete ·{" "}
        <span className="font-mono">n</span> to add
      </p>
    </div>
  );
}
