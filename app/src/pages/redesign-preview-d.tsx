import { useState } from "react";
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

// Variant D — "data-forward dashboard". Diagnosis this is answering: the
// original preview leads with narrative copy ("Here's what your last week
// is actually telling you...") before any numbers. Analytics tools (Linear
// Insights, Amplitude, Grafana) lead with the numbers and let copy annotate
// them, not the other way round. This variant puts metric tiles and
// sparklines first, renders lists as dense tables instead of illustrated
// cards, and swaps the vertical brand sidebar for a horizontal tab strip —
// closer to a dashboard app than a content page.

const tabIcons: Record<TabId, LucideIcon> = {
  Home: Sparkles,
  Today: SunMedium,
  Journal: BookOpen,
  Memories: ImageIcon,
};

function MetricTile({
  label,
  value,
  delta,
  positive = true,
}: {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
}) {
  return (
    <div className="border border-slate-200 bg-white p-3">
      <p className="text-[0.68rem] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="text-xl font-semibold tabular-nums text-slate-900">
          {value}
        </p>
        <span
          className={cn(
            "text-[0.68rem] font-medium tabular-nums",
            positive ? "text-emerald-600" : "text-rose-600"
          )}
        >
          {delta}
        </span>
      </div>
    </div>
  );
}

function Sparkline() {
  const max = Math.max(...rhythmBars.map((b) => b.value));
  return (
    <div className="flex h-8 items-end gap-1">
      {rhythmBars.map((bar) => (
        <div
          key={`${bar.day}-${bar.value}`}
          className={cn(
            "w-2.5 rounded-t-sm",
            bar.active ? "bg-indigo-500" : "bg-slate-200"
          )}
          style={{ height: `${(bar.value / max) * 100}%` }}
        />
      ))}
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
                ? "border-indigo-600 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Completion" value="74%" delta="+6% wow" />
        <MetricTile label="Writing streak" value="12d" delta="+1d" />
        <MetricTile
          label="Wellbeing tasks"
          value="2/5"
          delta="-3 vs plan"
          positive={false}
        />
        <MetricTile label="AM completion" value="91%" delta="best window" />
      </div>
      <div className="border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Summary
          </p>
          <Sparkline />
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {insightSummary}
        </p>
      </div>
      <div className="border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[0.68rem] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 font-medium">Recommendation</th>
              <th className="px-3 py-2 font-medium">Signal</th>
            </tr>
          </thead>
          <tbody>
            {insightRecommendations.map((item) => (
              <tr key={item.title} className="border-b border-slate-100 last:border-b-0">
                <td className="px-3 py-2.5 align-top font-medium text-slate-900">
                  {item.title}
                </td>
                <td className="px-3 py-2.5 align-top text-slate-500">
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
    <div className="space-y-4">
      <div className="border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[0.68rem] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 font-medium">Task</th>
              <th className="px-3 py-2 font-medium">Space</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.title} className="border-b border-slate-100 last:border-b-0">
                <td className="px-3 py-2.5 font-medium text-slate-900">
                  {task.title}
                </td>
                <td className="px-3 py-2.5 text-slate-500">{task.meta}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[0.68rem] font-medium uppercase",
                      task.state === "complete" &&
                        "bg-emerald-50 text-emerald-700",
                      task.state === "current" &&
                        "bg-amber-50 text-amber-700",
                      task.state === "upcoming" && "bg-slate-100 text-slate-500"
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
      <div className="border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          7-day completion
        </p>
        <div className="mt-3 flex h-20 items-end justify-between gap-2">
          {rhythmBars.map((bar) => (
            <div
              key={`${bar.day}-${bar.value}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
            >
              <span className="text-[0.65rem] tabular-nums text-slate-400">
                {bar.value}
              </span>
              <div
                className={cn(
                  "w-full max-w-6 rounded-sm",
                  bar.active ? "bg-indigo-500" : "bg-slate-200"
                )}
                style={{ height: `${bar.value}%` }}
              />
              <span className="text-[0.65rem] text-slate-400">{bar.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function JournalView() {
  return (
    <div className="border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[0.68rem] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Entry</th>
            <th className="px-3 py-2 font-medium">Bookmarked</th>
          </tr>
        </thead>
        <tbody>
          {journalEntries.map((entry) => (
            <tr key={entry.date} className="border-b border-slate-100 last:border-b-0">
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">
                {entry.date}
              </td>
              <td className="px-3 py-2.5 text-slate-800">
                <span className="mr-1.5" aria-hidden>
                  {entry.emoji}
                </span>
                {entry.snippet}
              </td>
              <td className="px-3 py-2.5 text-slate-400">
                {entry.bookmarked ? "Yes" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemoriesView() {
  return (
    <div className="border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[0.68rem] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {memories.map((memory) => (
            <tr key={memory.timeLabel} className="border-b border-slate-100 last:border-b-0">
              <td className="whitespace-nowrap px-3 py-2.5">
                <span className="flex items-center gap-2 text-slate-700">
                  <span
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: memory.color }}
                    aria-hidden
                  />
                  {memory.timeLabel}
                </span>
              </td>
              <td className="px-3 py-2.5 text-slate-600">{memory.snippet}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RedesignPreviewVariantD() {
  const [tab, setTab] = useState<TabId>("Home");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1000px]">
        <header className="border-b border-slate-200 bg-white px-4">
          <div className="flex items-center justify-between py-3">
            <span className="text-sm font-semibold tracking-tight">
              upwards
            </span>
            <span className="text-xs text-slate-400">
              {spaces.length} spaces · synced just now
            </span>
          </div>
          <TabBar active={tab} onChange={setTab} />
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
