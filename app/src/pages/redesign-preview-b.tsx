import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  SunMedium,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  insightRecommendations,
  insightSummary,
  journalEntries,
  memories,
  rhythmBars,
  tabOrder,
  tasks,
  type TabId,
} from "@/pages/redesign-preview-data";

// Variant B — "dense list tool". Diagnosis this is answering: the original
// preview reads as a lifestyle/marketing site (huge serif greeting, soft
// 2rem-radius cards, decorative ring flourishes, generous whitespace). This
// variant keeps the same warm-neutral palette family but swaps every
// structural choice for something closer to a dense productivity tool
// (Linear/Height/Superhuman): sharp 6–8px corners, 1px hairline borders, no
// shadows, small type, tight row heights, monospace metadata, and a
// segmented tab strip instead of a branded vertical rail.

const tabIcons: Record<TabId, LucideIcon> = {
  Home: Sparkles,
  Today: SunMedium,
  Journal: BookOpen,
  Memories: ImageIcon,
};

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-neutral-400">
      {children}
    </span>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="border border-neutral-200 bg-white p-3">
      <Label>{label}</Label>
      <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-neutral-900">
        {value}
      </p>
      <p className="mt-0.5 text-[0.7rem] text-neutral-500">{hint}</p>
    </div>
  );
}

function TabStrip({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <div className="flex items-center gap-1 border border-neutral-200 bg-neutral-50 p-1">
      {tabOrder.map((tab) => {
        const Icon = tabIcons[tab];
        const isActive = tab === active;
        return (
          <Button
            key={tab}
            type="button"
            variant="bare"
            onClick={() => onChange(tab)}
            className={cn(
              "h-7 gap-1.5 rounded-none px-3 text-xs font-medium",
              isActive
                ? "bg-white text-neutral-900 shadow-[inset_0_0_0_1px_theme(colors.neutral.300)]"
                : "text-neutral-500 hover:bg-white/60 hover:text-neutral-700"
            )}
          >
            <Icon className="size-3.5" />
            {tab}
          </Button>
        );
      })}
    </div>
  );
}

function TaskRow({ task }: { task: (typeof tasks)[number] }) {
  const complete = task.state === "complete";
  const current = task.state === "current";
  return (
    <div className="flex items-center gap-2.5 border-b border-neutral-150 px-3 py-2 last:border-b-0 hover:bg-neutral-50">
      <button
        type="button"
        aria-label={complete ? `Completed: ${task.title}` : `Mark ${task.title} complete`}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center border",
          complete
            ? "border-neutral-800 bg-neutral-800 text-white"
            : "border-neutral-300 bg-white text-transparent"
        )}
      >
        {complete ? <Check className="size-2.5" /> : null}
      </button>
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: task.color }}
      />
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-sm text-neutral-800",
          complete && "text-neutral-400 line-through"
        )}
      >
        {task.title}
      </p>
      <span className="shrink-0 font-mono text-[0.68rem] text-neutral-400">
        {task.meta}
      </span>
      {current ? (
        <span className="shrink-0 rounded-sm bg-amber-100 px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase text-amber-700">
          now
        </span>
      ) : null}
    </div>
  );
}

function HomeView() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Completion" value="74%" hint="of intentions met" />
        <StatTile label="Streak" value="12d" hint="writing streak" />
        <StatTile label="Best window" value="AM" hint="91% before noon" />
      </div>
      <div className="border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-150 px-3 py-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-amber-600" />
            <Label>AI insight · refreshed 3h ago</Label>
          </div>
          <Button
            type="button"
            variant="bare"
            size="iconRoundSm"
            className="rounded-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Refresh insight"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
        <p className="px-3 py-3 text-sm leading-6 text-neutral-800">
          {insightSummary}
        </p>
      </div>
      <div className="border border-neutral-200 bg-white">
        <div className="border-b border-neutral-150 px-3 py-2">
          <Label>Worth acting on</Label>
        </div>
        {insightRecommendations.map((item) => (
          <div
            key={item.title}
            className="flex gap-2.5 border-b border-neutral-150 px-3 py-2.5 last:border-b-0"
          >
            <span
              className="mt-1 size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-900">
                {item.title}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-neutral-500">
                {item.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TodayView() {
  return (
    <div className="space-y-3">
      <div className="border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-150 px-3 py-2">
          <Label>Today · 4 items</Label>
          <Button
            type="button"
            variant="bare"
            className="h-6 gap-1 rounded-none px-2 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          >
            <Plus className="size-3" />
            add
          </Button>
        </div>
        {tasks.map((task) => (
          <TaskRow key={task.title} task={task} />
        ))}
      </div>
      <div className="border border-neutral-200 bg-white p-3">
        <Label>This week</Label>
        <div className="mt-3 flex h-16 items-end justify-between gap-1.5">
          {rhythmBars.map((bar) => (
            <div
              key={`${bar.day}-${bar.value}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              <div
                className={cn(
                  "w-full",
                  bar.active ? "bg-neutral-800" : "bg-neutral-200"
                )}
                style={{ height: `${bar.value}%` }}
              />
              <span className="font-mono text-[0.6rem] text-neutral-400">
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
    <div className="border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-150 px-3 py-2">
        <Label>Entries · 12 day streak</Label>
      </div>
      {journalEntries.map((entry) => (
        <div
          key={entry.date}
          className="flex items-center gap-3 border-b border-neutral-150 px-3 py-2.5 last:border-b-0 hover:bg-neutral-50"
        >
          <span className="w-20 shrink-0 font-mono text-[0.68rem] text-neutral-400">
            {entry.date}
          </span>
          <span aria-hidden className="shrink-0">
            {entry.emoji}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm text-neutral-800">
            {entry.snippet}
          </p>
          <ChevronRight className="size-3.5 shrink-0 text-neutral-300" />
        </div>
      ))}
    </div>
  );
}

function MemoriesView() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {memories.map((memory) => (
        <div key={memory.timeLabel} className="border border-neutral-200 bg-white">
          <div
            className="h-16 w-full"
            style={{ backgroundColor: memory.color }}
            aria-hidden
          />
          <div className="p-2.5">
            <Label>{memory.timeLabel}</Label>
            <p className="mt-1 text-xs leading-5 text-neutral-700">
              {memory.snippet}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RedesignPreviewVariantB() {
  const [tab, setTab] = useState<TabId>("Home");

  return (
    <div className="min-h-screen bg-neutral-100 font-sans text-neutral-900">
      <div className="mx-auto max-w-[960px]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold tracking-tight">
              upwards
            </span>
            <TabStrip active={tab} onChange={setTab} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-400">
              <Search className="size-3" />
              <span>Search</span>
              <span className="ml-2 rounded-sm border border-neutral-300 bg-white px-1 font-mono text-[0.6rem]">
                ⌘K
              </span>
            </div>
            <div className="flex size-6 items-center justify-center rounded-sm bg-neutral-800 text-[0.6rem] font-bold text-white">
              AM
            </div>
          </div>
        </header>
        <main className="p-4">
          {tab === "Home" ? <HomeView /> : null}
          {tab === "Today" ? <TodayView /> : null}
          {tab === "Journal" ? <JournalView /> : null}
          {tab === "Memories" ? <MemoriesView /> : null}
        </main>
      </div>
    </div>
  );
}
