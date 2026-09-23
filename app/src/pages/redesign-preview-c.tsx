import { useState, type CSSProperties, type ReactNode } from "react";
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
  tabOrder,
  tasks,
  type TabId,
} from "@/pages/redesign-preview-data";

// Variant C — "quiet command deck". Keeps the keyboard-first idea from the
// prior pass (shortcut badges, a real command bar) but drops the terminal
// palette — this uses the same warm paper/ink/sage/terracotta family as the
// original, generous type, and soft-but-defined corners. The "tool" signal
// comes from precision (monospace numerals, shortcut chips, hairline
// dividers on functional rows) placed *next to* spacious serif headlines and
// soft photo-block memories, not from turning everything gray and dense.

const previewStyle = {
  "--ink": "#21332c",
  "--muted": "#6e776f",
  "--paper": "#fffdf8",
  "--canvas": "#f3efe6",
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

const shortcuts: Record<TabId, string> = {
  Home: "G H",
  Today: "G T",
  Journal: "G J",
  Memories: "G M",
};

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[0.62rem] text-[var(--muted)]">
      {children}
    </span>
  );
}

function MonoLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#8b938a]">
      {children}
    </span>
  );
}

function TopDeck({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--paper)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
        <p className="font-display text-lg tracking-[-0.02em] text-[var(--ink)]">
          upwards
        </p>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 sm:max-w-sm">
          <Sparkles className="size-3.5 text-[var(--muted)]" />
          <span className="text-sm text-[var(--muted)]">
            Jump to, or ask about, anything…
          </span>
          <Chip>⌘K</Chip>
        </div>
      </div>
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex max-w-3xl items-center gap-1 px-5 pb-2"
      >
        {tabOrder.map((tab) => {
          const Icon = tabIcons[tab];
          const isActive = tab === active;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm",
                isActive
                  ? "bg-[var(--sage)] font-semibold text-[var(--green)]"
                  : "text-[var(--muted)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]"
              )}
            >
              <Icon className="size-3.5" />
              {tab}
              <Chip>{shortcuts[tab]}</Chip>
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function HomeView() {
  return (
    <div className="space-y-5">
      <h1 className="max-w-lg font-display text-[2.6rem] leading-[1] tracking-[-0.04em] text-[var(--ink)]">
        {insightSummary}
      </h1>
      <div className="space-y-2">
        {insightRecommendations.map((item, i) => (
          <div
            key={item.title}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {item.title}
                </p>
                <p className="mt-0.5 max-w-md text-xs leading-5 text-[var(--muted)]">
                  {item.detail}
                </p>
              </div>
            </div>
            <Chip>{`⌥${i + 1}`}</Chip>
          </div>
        ))}
      </div>
    </div>
  );
}

function TodayView() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3">
          <MonoLabel>Completion</MonoLabel>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--ink)]">
            74%
          </p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3">
          <MonoLabel>Best window</MonoLabel>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--ink)]">
            AM
          </p>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3">
          <MonoLabel>Streak</MonoLabel>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--ink)]">
            12d
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        {tasks.map((task, i) => {
          const complete = task.state === "complete";
          return (
            <div
              key={task.title}
              className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-2.5 last:border-b-0"
            >
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
              <span className="hidden shrink-0 font-mono text-xs text-[var(--muted)] sm:inline">
                {task.meta}
              </span>
              <Chip>{i + 1}</Chip>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3.5">
        <div className="flex h-16 items-end justify-between gap-2">
          {rhythmBars.map((bar) => (
            <div
              key={`${bar.day}-${bar.value}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            >
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
      <article className="rounded-2xl bg-[var(--green)] p-7 text-[var(--paper)]">
        <h2 className="max-w-md font-display text-[2.2rem] leading-[1.02] tracking-[-0.03em]">
          A slower start
        </h2>
        <p className="mt-4 max-w-md text-sm leading-7 text-[#e1ebe1]">
          "I let the morning arrive before I started asking it to be useful."
        </p>
      </article>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        {journalEntries.map((entry, i) => (
          <div
            key={entry.date}
            className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0"
          >
            <span className="w-20 shrink-0 font-mono text-xs tabular-nums text-[var(--muted)]">
              {entry.date}
            </span>
            <span aria-hidden>{entry.emoji}</span>
            <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
              {entry.snippet}
            </p>
            <Chip>{`J ${i + 1}`}</Chip>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemoriesView() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {memories.map((memory) => (
        <article
          key={memory.timeLabel}
          className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]"
        >
          <div
            className="h-28 w-full"
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
  );
}

export default function RedesignPreviewVariantC() {
  const [tab, setTab] = useState<TabId>("Home");

  return (
    <div
      className="min-h-screen bg-[var(--canvas)] font-sans text-[var(--ink)]"
      style={previewStyle}
    >
      <TopDeck active={tab} onChange={setTab} />
      <main className="mx-auto max-w-3xl px-5 py-8">
        {tab === "Home" ? <HomeView /> : null}
        {tab === "Today" ? <TodayView /> : null}
        {tab === "Journal" ? <JournalView /> : null}
        {tab === "Memories" ? <MemoriesView /> : null}
      </main>
    </div>
  );
}
