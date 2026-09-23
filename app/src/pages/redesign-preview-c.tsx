import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Check,
  Image as ImageIcon,
  Sparkles,
  SunMedium,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  insightRecommendations,
  insightSummary,
  journalEntries,
  memories,
  rhythmBars,
  spaces,
  tabOrder,
  tasks,
  type TabId,
} from "@/pages/redesign-preview-data";

// Variant C — "command-first". Diagnosis this is answering: the original
// preview relies on generous touch targets and prose copy aimed at mouse/
// touch users, which is part of what reads as "website" rather than "tool" —
// power tools (terminals, IDEs, Superhuman, Raycast) lean on the keyboard as
// the primary input and show that everywhere: shortcut badges next to every
// action, a persistent command bar instead of a search icon, an icon-only
// rail instead of a labeled sidebar, and a status line instead of a header.
// Palette is deliberately closer to grayscale so the one accent color reads
// as signal, not decoration.

const shortcuts: Record<TabId, string> = {
  Home: "G H",
  Today: "G T",
  Journal: "G J",
  Memories: "G M",
};

const tabIcons: Record<TabId, LucideIcon> = {
  Home: Sparkles,
  Today: SunMedium,
  Journal: BookOpen,
  Memories: ImageIcon,
};

function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[3px] border border-neutral-700 bg-neutral-800 px-1 py-0.5 font-mono text-[0.6rem] leading-none text-neutral-400">
      {children}
    </span>
  );
}

function IconRail({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <nav
      aria-label="Primary navigation"
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-neutral-800 bg-neutral-950 py-3"
    >
      {tabOrder.map((tab) => {
        const Icon = tabIcons[tab];
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            title={`${tab} (${shortcuts[tab]})`}
            aria-label={tab}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onChange(tab)}
            className={cn(
              "flex size-9 items-center justify-center rounded-[3px]",
              isActive
                ? "bg-neutral-800 text-emerald-400"
                : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </nav>
  );
}

function CommandBar({ activeLabel }: { activeLabel: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-3 py-2">
      <span className="font-mono text-[0.7rem] text-neutral-500">upwards</span>
      <span className="text-neutral-700">/</span>
      <span className="font-mono text-[0.7rem] text-neutral-300">
        {activeLabel}
      </span>
      <div className="ml-auto flex flex-1 items-center gap-2 rounded-[3px] border border-neutral-800 bg-neutral-900 px-2.5 py-1 sm:max-w-xs">
        <span className="font-mono text-[0.7rem] text-neutral-600">
          Type a command…
        </span>
        <Kbd>⌘K</Kbd>
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between border-t border-neutral-800 bg-neutral-950 px-3 py-1.5 font-mono text-[0.65rem] text-neutral-500">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          synced
        </span>
        <span>alex@personal</span>
      </div>
      <div className="flex items-center gap-3">
        <span>7 recs pending</span>
        <span>v0.9.0-preview</span>
      </div>
    </div>
  );
}

function HomeView() {
  return (
    <div className="space-y-3">
      <div className="border border-neutral-800 bg-neutral-900 p-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-neutral-500">
            insight
          </span>
          <Kbd>R</Kbd>
        </div>
        <p className="mt-2 text-sm leading-6 text-neutral-200">
          {insightSummary}
        </p>
      </div>
      {insightRecommendations.map((item, i) => (
        <div
          key={item.title}
          className="flex items-start justify-between gap-3 border border-neutral-800 bg-neutral-900 px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-100">
              {item.title}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-neutral-500">
              {item.detail}
            </p>
          </div>
          <Kbd>{`⌥${i + 1}`}</Kbd>
        </div>
      ))}
    </div>
  );
}

function TodayView() {
  return (
    <div className="space-y-3">
      <div className="border border-neutral-800 bg-neutral-900">
        {tasks.map((task, i) => {
          const complete = task.state === "complete";
          return (
            <div
              key={task.title}
              className="flex items-center gap-2.5 border-b border-neutral-800 px-3 py-2 last:border-b-0"
            >
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-[3px] border",
                  complete
                    ? "border-emerald-500 bg-emerald-500 text-neutral-950"
                    : "border-neutral-700 text-transparent"
                )}
              >
                {complete ? <Check className="size-2.5" /> : null}
              </span>
              <p
                className={cn(
                  "min-w-0 flex-1 truncate text-sm text-neutral-200",
                  complete && "text-neutral-600 line-through"
                )}
              >
                {task.title}
              </p>
              <span className="shrink-0 font-mono text-[0.65rem] text-neutral-600">
                {task.meta}
              </span>
              <Kbd>{i + 1}</Kbd>
            </div>
          );
        })}
      </div>
      <div className="border border-neutral-800 bg-neutral-900 p-3">
        <div className="flex h-14 items-end justify-between gap-1.5">
          {rhythmBars.map((bar) => (
            <div
              key={`${bar.day}-${bar.value}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <div
                className={cn(
                  "w-full",
                  bar.active ? "bg-emerald-500" : "bg-neutral-700"
                )}
                style={{ height: `${bar.value}%` }}
              />
              <span className="font-mono text-[0.6rem] text-neutral-600">
                {bar.day}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function JournalView() {
  return (
    <div className="border border-neutral-800 bg-neutral-900">
      {journalEntries.map((entry, i) => (
        <div
          key={entry.date}
          className="flex items-center gap-3 border-b border-neutral-800 px-3 py-2.5 last:border-b-0"
        >
          <span className="w-20 shrink-0 font-mono text-[0.65rem] text-neutral-600">
            {entry.date}
          </span>
          <span aria-hidden>{entry.emoji}</span>
          <p className="min-w-0 flex-1 truncate text-sm text-neutral-200">
            {entry.snippet}
          </p>
          <Kbd>{`J ${i + 1}`}</Kbd>
        </div>
      ))}
    </div>
  );
}

function MemoriesView() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {memories.map((memory) => (
        <div key={memory.timeLabel} className="border border-neutral-800 bg-neutral-900">
          <div
            className="h-14 w-full opacity-80"
            style={{ backgroundColor: memory.color }}
            aria-hidden
          />
          <div className="p-2">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-neutral-500">
              {memory.timeLabel}
            </p>
            <p className="mt-1 truncate text-xs text-neutral-300">
              {memory.snippet}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RedesignPreviewVariantC() {
  const [tab, setTab] = useState<TabId>("Home");

  return (
    <div className="flex min-h-screen bg-neutral-950 font-mono text-neutral-200">
      <IconRail active={tab} onChange={setTab} />
      <div className="flex min-w-0 flex-1 flex-col">
        <CommandBar activeLabel={tab} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 font-sans">
          {tab === "Home" ? <HomeView /> : null}
          {tab === "Today" ? <TodayView /> : null}
          {tab === "Journal" ? <JournalView /> : null}
          {tab === "Memories" ? <MemoriesView /> : null}
          <p className="mt-4 font-mono text-[0.65rem] text-neutral-600">
            {spaces.length} spaces active — press{" "}
            <Kbd>P</Kbd> to jump to projects
          </p>
        </main>
        <StatusBar />
      </div>
    </div>
  );
}
