import { useState, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Image as ImageIcon, Sparkles, SunMedium } from "lucide-react";

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

// Variant D — "field notebook dashboard". Leads with numbers like an
// analytics tool (metric tiles, sparkline, a real table for tasks), but the
// numbers sit in a warm paper canvas with a big serif headline above them —
// like a research notebook where the data table is precise but the page
// itself is not clinical. Journal/Memories stay fully in the editorial
// register (serif, soft photo blocks) since those are reflective, not
// operational — the contrast is intentional per-section, not uniform.

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

function MonoLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#8b938a]">
      {children}
    </span>
  );
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3.5">
      <MonoLabel>{label}</MonoLabel>
      <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-[var(--ink)]">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <div className="flex items-center gap-1">
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
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium",
              isActive
                ? "border-[var(--green)] text-[var(--ink)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
            )}
          >
            <Icon className="size-3.5" />
            {tab}
          </button>
        );
      })}
    </div>
  );
}

function HomeView() {
  return (
    <div className="space-y-5">
      <h1 className="max-w-xl font-display text-[2.6rem] leading-[1.05] tracking-[-0.04em] text-[var(--ink)]">
        {insightSummary}
      </h1>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="px-4 py-2.5">
                <MonoLabel>Recommendation</MonoLabel>
              </th>
              <th className="px-4 py-2.5">
                <MonoLabel>Signal</MonoLabel>
              </th>
            </tr>
          </thead>
          <tbody>
            {insightRecommendations.map((item) => (
              <tr key={item.title} className="border-b border-[var(--line)] last:border-b-0">
                <td className="px-4 py-3 align-top font-medium text-[var(--ink)]">
                  {item.title}
                </td>
                <td className="px-4 py-3 align-top text-[var(--muted)]">
                  {item.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TodayView() {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-[2.6rem] leading-[1.05] tracking-[-0.04em] text-[var(--ink)]">
        4 things, in order
      </h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Completion" value="74%" hint="of intentions met" />
        <MetricTile label="Streak" value="12d" hint="writing streak" />
        <MetricTile label="Best window" value="AM" hint="91% before noon" />
        <MetricTile label="Wellbeing" value="2/5" hint="tasks this week" />
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="px-4 py-2.5">
                <MonoLabel>Task</MonoLabel>
              </th>
              <th className="px-4 py-2.5">
                <MonoLabel>Space</MonoLabel>
              </th>
              <th className="px-4 py-2.5">
                <MonoLabel>Status</MonoLabel>
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.title} className="border-b border-[var(--line)] last:border-b-0">
                <td className="px-4 py-3 font-medium text-[var(--ink)]">
                  {task.title}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{task.meta}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[0.68rem] font-medium uppercase",
                      task.state === "complete" && "bg-[var(--sage)] text-[var(--green)]",
                      task.state === "current" && "bg-[#f3dfd7] text-[#a4523b]",
                      task.state === "upcoming" && "bg-[#eee9df] text-[var(--muted)]"
                    )}
                  >
                    {task.state}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3.5">
        <MonoLabel>7-day completion</MonoLabel>
        <div className="mt-3 flex h-20 items-end justify-between gap-2">
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
      <article className="rounded-2xl bg-[var(--green)] p-7 text-[var(--paper)]">
        <MonoLabel>
          <span className="text-[#d7e5d8]">Journal note · 07:18</span>
        </MonoLabel>
        <h2 className="mt-4 max-w-md font-display text-[2.3rem] leading-[1.02] tracking-[-0.03em]">
          A slower start
        </h2>
        <p className="mt-5 max-w-md text-sm leading-7 text-[#e1ebe1]">
          "I let the morning arrive before I started asking it to be useful.
          Coffee, open windows, and one clear page."
        </p>
      </article>
      <div className="space-y-1">
        {journalEntries.map((entry) => (
          <div
            key={entry.date}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--paper)]"
          >
            <span className="w-20 shrink-0 font-mono text-xs tabular-nums text-[var(--muted)]">
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

export default function RedesignPreviewVariantD() {
  const [tab, setTab] = useState<TabId>("Home");

  return (
    <div
      className="min-h-screen bg-[var(--canvas)] font-sans text-[var(--ink)]"
      style={previewStyle}
    >
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-[var(--line)] px-1">
          <div className="flex items-center justify-between py-4">
            <p className="font-display text-xl tracking-[-0.02em] text-[var(--ink)]">
              upwards
            </p>
            <span className="text-xs text-[var(--muted)]">
              {spaces.length} spaces · synced just now
            </span>
          </div>
          <TabBar active={tab} onChange={setTab} />
        </header>
        <main className="px-1 py-8">
          {tab === "Home" ? <HomeView /> : null}
          {tab === "Today" ? <TodayView /> : null}
          {tab === "Journal" ? <JournalView /> : null}
          {tab === "Memories" ? <MemoriesView /> : null}
        </main>
      </div>
    </div>
  );
}
