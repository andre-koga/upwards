import { useState, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Check,
  Image as ImageIcon,
  Leaf,
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
  spaces,
  tabOrder,
  tasks,
  type TabId,
} from "@/pages/redesign-preview-data";

// Variant B — "editorial tool". The contrast lives *within* the page, not
// across pages: the reflective content (the greeting, journal, memories)
// keeps the warm serif voice and soft, generous shapes from the original.
// The functional content (today's tasks, the weekly numbers) switches
// register — tighter rows, tabular-nums, hairline rules, quiet monospace
// labels — the way a well-made paper planner still looks handmade but the
// grid inside it is precise. Corners are toned down (0.75–1.25rem, not
// 2rem) everywhere so the whole thing feels considered rather than either
// "soft blob" or "sharp rectangle".

const previewStyle = {
  "--ink": "#21332c",
  "--muted": "#6e776f",
  "--paper": "#fffdf8",
  "--canvas": "#f6f2ea",
  "--line": "#e4dccf",
  "--sage": "#e1ebe1",
  "--green": "#3f6656",
  "--terracotta": "#c36e52",
  "--gold": "#c99a3f",
} as CSSProperties;

const tabIcons: Record<TabId, LucideIcon> = {
  Home: Sparkles,
  Today: SunMedium,
  Journal: BookOpen,
  Memories: ImageIcon,
};

function MonoLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#8b938a]">
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3">
      <MonoLabel>{label}</MonoLabel>
      <p className="mt-1.5 font-mono text-[1.7rem] font-semibold tabular-nums text-[var(--ink)]">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function Sidebar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-[var(--line)] bg-[#f9f6ef] md:block">
      <div className="flex h-full flex-col p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-[var(--green)] text-[var(--paper)]">
            <Leaf className="size-4" strokeWidth={1.8} />
          </div>
          <p className="font-display text-[1.2rem] tracking-[-0.03em] text-[var(--ink)]">
            upwards
          </p>
        </div>
        <nav className="mt-10 space-y-0.5" aria-label="Primary navigation">
          {tabOrder.map((tab) => {
            const Icon = tabIcons[tab];
            const isActive = tab === active;
            return (
              <Button
                key={tab}
                type="button"
                variant="bare"
                onClick={() => onChange(tab)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "h-9 w-full justify-start gap-2.5 rounded-lg px-2.5 text-sm",
                  isActive
                    ? "bg-[var(--sage)] font-semibold text-[var(--green)]"
                    : "text-[var(--muted)] hover:bg-[#efe9dd] hover:text-[var(--ink)]"
                )}
              >
                <Icon className="size-4" />
                {tab}
              </Button>
            );
          })}
        </nav>
        <div className="mt-auto rounded-xl bg-[#efe6d5] p-3.5">
          <p className="font-display text-sm leading-snug text-[#4d5b52]">
            Make a little room for the good stuff.
          </p>
        </div>
      </div>
    </aside>
  );
}

function HomeView() {
  return (
    <div className="space-y-5">
      <div>
        <MonoLabel>Wednesday, September 23</MonoLabel>
        <h1 className="mt-2 max-w-lg font-display text-[2.75rem] leading-[0.98] tracking-[-0.045em] text-[var(--ink)]">
          Good morning, Alex
        </h1>
      </div>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-[var(--gold)]" />
            <MonoLabel>AI insight · 3h ago</MonoLabel>
          </div>
          <Button
            type="button"
            variant="bare"
            size="iconRoundSm"
            className="text-[var(--muted)] hover:bg-[var(--sage)] hover:text-[var(--green)]"
            aria-label="Refresh"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
        <p className="mt-3 max-w-lg font-display text-[1.4rem] leading-[1.25] tracking-[-0.01em] text-[var(--ink)]">
          {insightSummary}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {insightRecommendations.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3.5"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <p className="mt-2 text-sm font-semibold text-[var(--ink)]">
              {item.title}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {item.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: (typeof tasks)[number] }) {
  const complete = task.state === "complete";
  const current = task.state === "current";
  return (
    <div className="flex items-center gap-3 border-b border-[var(--line)] px-1 py-2.5 last:border-b-0">
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          complete
            ? "border-[var(--green)] bg-[var(--green)] text-white"
            : "border-[#c7cec7] text-transparent"
        )}
      >
        {complete ? <Check className="size-2.5" /> : null}
      </span>
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-sm text-[var(--ink)]",
          complete && "text-[var(--muted)] line-through"
        )}
      >
        {task.title}
      </p>
      <span className="shrink-0 font-mono text-[0.68rem] tabular-nums text-[var(--muted)]">
        {task.meta}
      </span>
      {current ? (
        <span className="shrink-0 rounded-sm bg-[#f3dfd7] px-1.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase text-[#a4523b]">
          now
        </span>
      ) : null}
    </div>
  );
}

function TodayView() {
  return (
    <div className="space-y-5">
      <div>
        <MonoLabel>Today's rhythm</MonoLabel>
        <h1 className="mt-2 font-display text-[2.75rem] leading-[0.98] tracking-[-0.045em] text-[var(--ink)]">
          4 things, in order
        </h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Completion" value="74%" hint="of intentions met" />
        <StatCard label="Best window" value="AM" hint="91% before noon" />
        <StatCard label="Streak" value="12d" hint="writing streak" />
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-1">
        <div className="flex items-center justify-between border-b border-[var(--line)] py-2.5">
          <MonoLabel>4 items</MonoLabel>
          <Button
            type="button"
            variant="bare"
            className="h-7 gap-1 rounded-md px-2 text-xs font-semibold text-[var(--green)] hover:bg-[var(--sage)]"
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
        {tasks.map((task) => (
          <TaskRow key={task.title} task={task} />
        ))}
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3.5">
        <div className="flex h-16 items-end justify-between gap-2">
          {rhythmBars.map((bar) => (
            <div
              key={`${bar.day}-${bar.value}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            >
              <span className="font-mono text-[0.62rem] tabular-nums text-[var(--muted)]">
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
    </div>
  );
}

function JournalView() {
  return (
    <div className="space-y-5">
      <article className="relative overflow-hidden rounded-2xl bg-[var(--green)] p-7 text-[var(--paper)]">
        <MonoLabel>
          <span className="text-[#d7e5d8]">Journal note · 07:18</span>
        </MonoLabel>
        <h2 className="mt-4 max-w-md font-display text-[2.4rem] leading-[1] tracking-[-0.04em]">
          A slower start
        </h2>
        <p className="mt-5 max-w-md text-sm leading-7 text-[#e1ebe1]">
          "I let the morning arrive before I started asking it to be useful.
          Coffee, open windows, and one clear page."
        </p>
      </article>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-1">
        <div className="border-b border-[var(--line)] py-2.5">
          <MonoLabel>Past entries · 12 day streak</MonoLabel>
        </div>
        {journalEntries.map((entry) => (
          <div
            key={entry.date}
            className="flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-b-0"
          >
            <span className="w-20 shrink-0 font-mono text-[0.68rem] tabular-nums text-[var(--muted)]">
              {entry.date}
            </span>
            <span aria-hidden>{entry.emoji}</span>
            <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
              {entry.snippet}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemoriesView() {
  return (
    <div className="space-y-5">
      <div>
        <MonoLabel>Kept for later</MonoLabel>
        <h1 className="mt-2 font-display text-[2.75rem] leading-[0.98] tracking-[-0.045em] text-[var(--ink)]">
          Memories
        </h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {memories.map((memory) => (
          <article
            key={memory.timeLabel}
            className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]"
          >
            <div
              className="h-24 w-full"
              style={{ backgroundColor: memory.color }}
              aria-hidden
            />
            <div className="p-4">
              <MonoLabel>{memory.timeLabel}</MonoLabel>
              <p className="mt-2 text-sm leading-6 text-[#4d5b52]">
                {memory.snippet}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function RedesignPreviewVariantB() {
  const [tab, setTab] = useState<TabId>("Home");

  return (
    <div
      className="min-h-screen bg-[var(--canvas)] font-sans text-[var(--ink)]"
      style={previewStyle}
    >
      <div className="flex min-h-screen">
        <Sidebar active={tab} onChange={setTab} />
        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3 md:px-8">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              <span className="size-1.5 rounded-full bg-[#789b7f]" />
              Synced just now · {spaces.length} spaces
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1.5 text-xs text-[var(--muted)]">
              <Search className="size-3" />
              Search
            </div>
          </header>
          <main className="mx-auto max-w-2xl px-5 py-8 md:px-8">
            {tab === "Home" ? <HomeView /> : null}
            {tab === "Today" ? <TodayView /> : null}
            {tab === "Journal" ? <JournalView /> : null}
            {tab === "Memories" ? <MemoriesView /> : null}
          </main>
        </div>
      </div>
    </div>
  );
}
