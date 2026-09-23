import { useState, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FolderKanban,
  Image as ImageIcon,
  Leaf,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  SunMedium,
  Timer,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: LucideIcon;
}

const primaryNav: NavItem[] = [
  { label: "Home", icon: Sparkles },
  { label: "Today", icon: SunMedium },
  { label: "Journal", icon: BookOpen },
  { label: "Memories", icon: ImageIcon },
];

const utilityNav: NavItem[] = [{ label: "Projects", icon: FolderKanban }];

const tasks = [
  {
    title: "Morning pages",
    meta: "Personal · 20 min",
    state: "complete",
    color: "#789b7f",
  },
  {
    title: "Deep work block",
    meta: "Studio refresh · 9:30–11:30",
    state: "current",
    color: "#c36e52",
  },
  {
    title: "Walk without a phone",
    meta: "Wellbeing · 30 min",
    state: "upcoming",
    color: "#d5a94a",
  },
  {
    title: "Call Mum",
    meta: "Personal · Before 18:00",
    state: "upcoming",
    color: "#8d84a9",
  },
];

const rhythmBars = [
  { day: "M", value: 82, active: false },
  { day: "T", value: 64, active: false },
  { day: "W", value: 91, active: true },
  { day: "T", value: 52, active: false },
  { day: "F", value: 74, active: false },
  { day: "S", value: 38, active: false },
  { day: "S", value: 57, active: false },
];

const spaces = [
  { label: "Studio refresh", count: "4 open", color: "#c36e52" },
  { label: "Personal", count: "2 open", color: "#789b7f" },
  { label: "Wellbeing", count: "1 open", color: "#d5a94a" },
];

const insightSummary =
  "You're most consistent before noon — mornings run at 91% completion versus 58% after 3pm.";

const insightRecommendations = [
  {
    title: "Move deep work earlier",
    detail:
      "Deep work block finishes on time 90% of days when started before 10am, only 40% after — try shifting it 30 minutes earlier.",
    color: "#c36e52",
  },
  {
    title: "Protect the Wednesday streak",
    detail:
      "Your rhythm peaks midweek. Wednesdays have your highest completion rate this month — keep the load light on Thursdays to avoid burnout.",
    color: "#426a5a",
  },
  {
    title: "Wellbeing is slipping",
    detail:
      "Walk without a phone has been skipped 3 of the last 5 days. Pairing it right after lunch has worked well in the past.",
    color: "#d5a94a",
  },
];

const journalEntries = [
  {
    date: "Sep 22, 2026",
    snippet: "Closed the laptop by seven and actually meant it this time.",
    emoji: "🌙",
    bookmarked: true,
  },
  {
    date: "Sep 21, 2026",
    snippet: "Long walk turned into a long call with an old friend.",
    emoji: "☎️",
    bookmarked: false,
  },
  {
    date: "Sep 20, 2026",
    snippet: "Rain all day. Read on the couch instead of forcing a run.",
    emoji: "🌧️",
    bookmarked: false,
  },
  {
    date: "Sep 19, 2026",
    snippet: "Studio refresh finally has a color plan. Feels real now.",
    emoji: "🎨",
    bookmarked: true,
  },
];

const memories = [
  {
    timeLabel: "Around 2019",
    snippet: "The apartment with the bad radiator and the good light.",
    color: "#e1ebe1",
  },
  {
    timeLabel: "When I was six",
    snippet: "Dad taught me to ride a bike in the church parking lot.",
    color: "#f3dfd7",
  },
  {
    timeLabel: "Summer, a few years back",
    snippet: "Three weeks with no plans. Still the best vacation.",
    color: "#f6ecd3",
  },
  {
    timeLabel: "Right after graduating",
    snippet: "Drove across the state with everything I owned in the back seat.",
    color: "#e6e1ee",
  },
];

const previewStyle = {
  "--preview-ink": "#21332c",
  "--preview-muted": "#6e776f",
  "--preview-paper": "#fffdf8",
  "--preview-canvas": "#f5f1ea",
  "--preview-line": "#e5ddd1",
  "--preview-sage": "#e1ebe1",
  "--preview-green": "#426a5a",
} as CSSProperties;

function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-[1.15rem] bg-[#426a5a] text-[#fffdf8] shadow-[0_8px_20px_rgba(66,106,90,0.2)]">
        <Leaf className="size-5" strokeWidth={1.8} />
      </div>
      <div>
        <p className="font-display text-[1.55rem] leading-none tracking-[-0.04em] text-[#21332c]">
          upwards
        </p>
        <p className="mt-1 font-mono text-[0.55rem] uppercase tracking-[0.2em] text-[#6e776f]">
          make room for life
        </p>
      </div>
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <Button
      type="button"
      variant="bare"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group h-11 w-full justify-start rounded-2xl px-3 text-[#6e776f] transition-colors",
        active
          ? "bg-[#e1ebe1] font-semibold text-[#426a5a]"
          : "hover:bg-[#f0ebe9] hover:text-[#21332c]"
      )}
    >
      <Icon
        className={cn(
          "size-[1.05rem]",
          active ? "text-[#426a5a]" : "text-[#8d978f]"
        )}
        strokeWidth={active ? 2.2 : 1.8}
      />
      <span>{item.label}</span>
      {active ? (
        <span
          className="ml-auto size-1.5 rounded-full bg-[#c36e52]"
          aria-hidden
        />
      ) : null}
    </Button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#8b938a]">
      {children}
    </p>
  );
}

function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-[#e5ddd1] pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm text-[#6e776f]">
          <span>Wednesday, September 23, 2026</span>
          <span className="size-1 rounded-full bg-[#c36e52]" aria-hidden />
          <span>08:42</span>
        </div>
        <h1 className="max-w-2xl font-display text-[clamp(2.65rem,5vw,4.6rem)] leading-[0.92] tracking-[-0.06em] text-[#21332c]">
          {title}
        </h1>
        <p className="mt-4 max-w-lg text-[0.98rem] leading-7 text-[#6e776f]">
          {subtitle}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="bare"
          size="iconRoundMd"
          className="border border-[#e5ddd1] bg-[#fffdf8] text-[#6e776f] shadow-sm hover:bg-[#f0ebe5] hover:text-[#21332c]"
          aria-label="Previous day"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-full border-[#e5ddd1] bg-[#fffdf8] px-4 text-xs font-semibold text-[#426a5a] shadow-sm hover:bg-[#f0ebe5]"
        >
          <CalendarDays className="size-3.5" />
          Today
        </Button>
        <Button
          type="button"
          variant="bare"
          size="iconRoundMd"
          className="border border-[#e5ddd1] bg-[#fffdf8] text-[#6e776f] shadow-sm hover:bg-[#f0ebe5] hover:text-[#21332c]"
          aria-label="Next day"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </header>
  );
}

function JournalFeature() {
  return (
    <article className="relative overflow-hidden rounded-[2rem] bg-[#426a5a] p-6 text-[#fffdf8] shadow-[0_18px_45px_rgba(66,106,90,0.18)] sm:p-8">
      <div
        className="absolute -right-20 -top-24 size-64 rounded-full border-[34px] border-[#789b7f]/25"
        aria-hidden
      />
      <div
        className="absolute -bottom-20 right-8 size-44 rounded-full border-[24px] border-[#d5a94a]/20"
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionLabel>Journal note · 07:18</SectionLabel>
            <h2 className="mt-5 max-w-md font-display text-[clamp(2rem,4vw,3.15rem)] leading-[0.98] tracking-[-0.05em]">
              A slower start
            </h2>
          </div>
          <Button
            type="button"
            variant="bare"
            size="iconRoundMd"
            className="border border-[#fffdf8]/20 bg-[#fffdf8]/10 text-[#fffdf8] hover:bg-[#fffdf8]/20"
            aria-label="More journal actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
        <p className="mt-6 max-w-lg text-sm leading-7 text-[#e1ebe1]">
          “I let the morning arrive before I started asking it to be useful.
          Coffee, open windows, and one clear page.”
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-2 text-xs text-[#d7e5d8]">
          <span className="rounded-full bg-[#fffdf8]/10 px-3 py-1.5">
            Living room
          </span>
          <span className="rounded-full bg-[#fffdf8]/10 px-3 py-1.5">
            #presence
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[#d5a94a]" />
            12 day writing streak
          </span>
        </div>
      </div>
    </article>
  );
}

function TaskRow({ task }: { task: (typeof tasks)[number] }) {
  const complete = task.state === "complete";
  const current = task.state === "current";

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors",
        current
          ? "border-[#d9b7a9] bg-[#fff8f4]"
          : "border-transparent bg-[#fffdf8] hover:border-[#e5ddd1]"
      )}
    >
      <Button
        type="button"
        variant="bare"
        size="iconRoundSm"
        className={cn(
          "shrink-0 border",
          complete
            ? "border-[#789b7f] bg-[#789b7f] text-white"
            : "border-[#c7cec7] bg-transparent text-transparent hover:border-[#426a5a]"
        )}
        aria-label={
          complete ? `Completed: ${task.title}` : `Mark ${task.title} complete`
        }
      >
        {complete ? <Check className="size-3.5" /> : null}
      </Button>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: task.color }}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-semibold",
            complete && "text-[#8b938a] line-through"
          )}
        >
          {task.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-[#8b938a]">{task.meta}</p>
      </div>
      {current ? (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#f3dfd7] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[#a4523b]">
          <Timer className="size-3" />
          Now
        </span>
      ) : null}
    </div>
  );
}

function TasksPanel() {
  return (
    <section className="rounded-[2rem] border border-[#e5ddd1] bg-[#fffdf8] p-5 shadow-[0_12px_35px_rgba(92,77,58,0.06)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionLabel>In your orbit</SectionLabel>
          <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.04em] text-[#21332c]">
            Today&apos;s rhythm
          </h2>
        </div>
        <Button
          type="button"
          variant="bare"
          className="h-9 rounded-full px-3 text-xs font-semibold text-[#426a5a] hover:bg-[#e1ebe1]"
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
      <div className="mt-5 space-y-2">
        {tasks.map((task) => (
          <TaskRow key={task.title} task={task} />
        ))}
      </div>
      <Button
        type="button"
        variant="bare"
        className="mt-4 h-9 w-full justify-between rounded-xl px-3 text-xs font-semibold text-[#6e776f] hover:bg-[#f5f1ea] hover:text-[#21332c]"
      >
        View all projects
        <ArrowRight className="size-3.5" />
      </Button>
    </section>
  );
}

function RhythmPanel() {
  return (
    <section className="rounded-[2rem] bg-[#e1ebe1] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionLabel>This week</SectionLabel>
          <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.04em] text-[#21332c]">
            Your rhythm
          </h2>
        </div>
        <Button
          type="button"
          variant="bare"
          size="iconRoundSm"
          className="text-[#6e776f] hover:bg-[#cddfce] hover:text-[#21332c]"
          aria-label="Open insights"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </div>
      <div className="mt-7 flex h-28 items-end justify-between gap-2">
        {rhythmBars.map((bar) => (
          <div
            key={`${bar.day}-${bar.value}`}
            className="flex h-full flex-1 flex-col items-center justify-end gap-2"
          >
            <div className="flex h-full w-full items-end justify-center">
              <div
                className={cn(
                  "w-full max-w-5 rounded-full",
                  bar.active ? "bg-[#426a5a]" : "bg-[#b8cfba]"
                )}
                style={{ height: `${bar.value}%` }}
              />
            </div>
            <span
              className={cn(
                "font-mono text-[0.62rem]",
                bar.active ? "font-bold text-[#426a5a]" : "text-[#8b938a]"
              )}
            >
              {bar.day}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-end justify-between border-t border-[#c8dac9] pt-4">
        <div>
          <p className="text-3xl font-semibold tracking-[-0.06em] text-[#426a5a]">
            74%
          </p>
          <p className="mt-1 text-xs text-[#6e776f]">of your intentions met</p>
        </div>
        <p className="max-w-[9rem] text-right text-xs leading-5 text-[#6e776f]">
          Consistency is a direction, not a score.
        </p>
      </div>
    </section>
  );
}

function SpacesPanel() {
  return (
    <section className="rounded-[2rem] border border-[#e5ddd1] bg-[#fffdf8] p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <SectionLabel>Your spaces</SectionLabel>
        <Button
          type="button"
          variant="bare"
          size="iconRoundSm"
          className="text-[#8b938a] hover:bg-[#f5f1ea] hover:text-[#21332c]"
          aria-label="Manage spaces"
        >
          <Settings2 className="size-3.5" />
        </Button>
      </div>
      <div className="mt-4 space-y-1">
        {spaces.map((space) => (
          <Button
            key={space.label}
            type="button"
            variant="bare"
            className="h-auto w-full justify-start rounded-xl px-2 py-2.5 text-left hover:bg-[#f5f1ea]"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: space.color }}
            />
            <span className="flex-1 text-sm font-medium text-[#4d5b52]">
              {space.label}
            </span>
            <span className="text-xs text-[#9aa199]">{space.count}</span>
          </Button>
        ))}
      </div>
    </section>
  );
}

function HomeHero() {
  return (
    <article className="relative overflow-hidden rounded-[2rem] bg-[#426a5a] p-6 text-[#fffdf8] shadow-[0_18px_45px_rgba(66,106,90,0.18)] sm:p-8">
      <div
        className="absolute -right-20 -top-24 size-64 rounded-full border-[34px] border-[#789b7f]/25"
        aria-hidden
      />
      <div
        className="absolute -bottom-20 right-8 size-44 rounded-full border-[24px] border-[#d5a94a]/20"
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-[#d5a94a]" />
            <SectionLabel>
              <span className="text-[#d7e5d8]">AI insight · Refreshed 3h ago</span>
            </SectionLabel>
          </div>
          <Button
            type="button"
            variant="bare"
            size="iconRoundMd"
            className="border border-[#fffdf8]/20 bg-[#fffdf8]/10 text-[#fffdf8] hover:bg-[#fffdf8]/20"
            aria-label="Refresh insights"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
        <h2 className="mt-5 max-w-lg font-display text-[clamp(1.8rem,3.4vw,2.6rem)] leading-[1.05] tracking-[-0.04em]">
          {insightSummary}
        </h2>
        <div className="mt-8 flex flex-wrap items-center gap-2 text-xs text-[#d7e5d8]">
          <span className="ml-0 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[#d5a94a]" />
            Based on the last 7 days · your key, your model
          </span>
        </div>
      </div>
    </article>
  );
}

function RecommendationsPanel() {
  return (
    <section className="rounded-[2rem] border border-[#e5ddd1] bg-[#fffdf8] p-5 shadow-[0_12px_35px_rgba(92,77,58,0.06)] sm:p-6">
      <SectionLabel>Worth acting on</SectionLabel>
      <div className="mt-4 space-y-3">
        {insightRecommendations.map((item) => (
          <div
            key={item.title}
            className="flex gap-3 rounded-2xl border border-[#e5ddd1] bg-[#fffdf8] p-4"
          >
            <span
              className="mt-1 size-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#21332c]">
                {item.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#6e776f]">
                {item.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="bare"
        className="mt-4 h-9 w-full justify-between rounded-xl px-3 text-xs font-semibold text-[#6e776f] hover:bg-[#f5f1ea] hover:text-[#21332c]"
      >
        Refresh insights
        <RefreshCw className="size-3.5" />
      </Button>
    </section>
  );
}

function JournalEntryRow({ entry }: { entry: (typeof journalEntries)[number] }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 hover:border-[#e5ddd1]">
      <span className="w-16 shrink-0 text-xs font-semibold text-[#8b938a]">
        {entry.date}
      </span>
      <span className="shrink-0 text-base" aria-hidden>
        {entry.emoji}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm text-[#4d5b52]">
        {entry.snippet}
      </p>
      <Bookmark
        className={cn(
          "size-3.5 shrink-0",
          entry.bookmarked
            ? "fill-[#c36e52] text-[#c36e52]"
            : "text-[#c7cec7]"
        )}
        aria-hidden
      />
    </div>
  );
}

function JournalPastEntries() {
  return (
    <section className="rounded-[2rem] border border-[#e5ddd1] bg-[#fffdf8] p-5 shadow-[0_12px_35px_rgba(92,77,58,0.06)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <SectionLabel>Past entries</SectionLabel>
        <span className="text-xs text-[#8b938a]">12 day streak</span>
      </div>
      <div className="mt-3 space-y-1">
        {journalEntries.map((entry) => (
          <JournalEntryRow key={entry.date} entry={entry} />
        ))}
      </div>
    </section>
  );
}

function MemoryPreviewCard({ memory }: { memory: (typeof memories)[number] }) {
  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-[#e5ddd1] bg-[#fffdf8] shadow-[0_12px_35px_rgba(92,77,58,0.06)]">
      <div
        className="h-28 w-full"
        style={{ backgroundColor: memory.color }}
        aria-hidden
      />
      <div className="p-4">
        <SectionLabel>{memory.timeLabel}</SectionLabel>
        <p className="mt-2 text-sm leading-6 text-[#4d5b52]">
          {memory.snippet}
        </p>
      </div>
    </article>
  );
}

function MemoriesGrid() {
  return (
    <section className="rounded-[2rem] border border-[#e5ddd1] bg-[#fffdf8] p-5 shadow-[0_12px_35px_rgba(92,77,58,0.06)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionLabel>Your memories</SectionLabel>
          <h2 className="mt-2 font-display text-[2rem] leading-none tracking-[-0.04em] text-[#21332c]">
            Kept for later
          </h2>
        </div>
        <Button
          type="button"
          variant="bare"
          className="h-9 rounded-full px-3 text-xs font-semibold text-[#426a5a] hover:bg-[#e1ebe1]"
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {memories.map((memory) => (
          <MemoryPreviewCard key={memory.timeLabel} memory={memory} />
        ))}
      </div>
    </section>
  );
}

const pageCopy: Record<string, { title: string; subtitle: string }> = {
  Home: {
    title: "Good morning, Alex",
    subtitle:
      "Here's what your last week is actually telling you, distilled into a few sentences.",
  },
  Today: {
    title: "Good morning, Alex",
    subtitle:
      "A little structure for the things that matter, with enough space for the unexpected.",
  },
  Journal: {
    title: "Your journal",
    subtitle: "A running record, in your own words, one day at a time.",
  },
  Memories: {
    title: "Memories",
    subtitle: "The moments worth keeping, even the ones without a date.",
  },
};

export default function RedesignPreviewPage() {
  const [activeNav, setActiveNav] = useState("Home");
  const copy = pageCopy[activeNav] ?? pageCopy.Today;

  return (
    <div
      className="redesign-preview min-h-screen bg-[#f5f1ea] font-preview text-[#21332c]"
      style={previewStyle}
      data-selectable="true"
    >
      <div className="mx-auto min-h-screen max-w-[1600px] md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#e5ddd1] bg-[#f8f5ef] md:block">
          <div className="sticky top-0 flex h-screen flex-col p-5 lg:p-7">
            <Wordmark />
            <div className="mt-12">
              <SectionLabel>Navigate</SectionLabel>
              <nav className="mt-3 space-y-1" aria-label="Primary navigation">
                {primaryNav.map((item) => (
                  <NavButton
                    key={item.label}
                    item={item}
                    active={activeNav === item.label}
                    onClick={() => setActiveNav(item.label)}
                  />
                ))}
              </nav>
            </div>
            <div className="mt-9">
              <SectionLabel>Organize</SectionLabel>
              <nav className="mt-3 space-y-1" aria-label="Utility navigation">
                {utilityNav.map((item) => (
                  <NavButton
                    key={item.label}
                    item={item}
                    active={activeNav === item.label}
                    onClick={() => setActiveNav(item.label)}
                  />
                ))}
              </nav>
            </div>
            <div className="mt-auto space-y-4">
              <div className="rounded-2xl bg-[#e9e0d3] p-4">
                <Leaf className="size-4 text-[#c36e52]" />
                <p className="mt-3 font-display text-lg leading-tight text-[#4d5b52]">
                  Make a little room for the good stuff.
                </p>
                <Button
                  type="button"
                  variant="bare"
                  className="mt-3 h-auto p-0 text-xs font-bold text-[#426a5a] underline decoration-[#a9c0ab] underline-offset-4"
                >
                  Read the note
                </Button>
              </div>
              <div className="flex items-center gap-3 rounded-2xl px-2 py-2">
                <div className="flex size-9 items-center justify-center rounded-full bg-[#d4e1d5] text-[#426a5a]">
                  <UserRound className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#4d5b52]">
                    Alex Morgan
                  </p>
                  <p className="truncate text-[0.65rem] text-[#8b938a]">
                    Personal space
                  </p>
                </div>
                <MoreHorizontal className="size-4 text-[#8b938a]" />
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-[#e5ddd1]/80 bg-[#f5f1ea]/95 px-4 py-3 backdrop-blur-md md:px-8 lg:px-12">
            <div className="mx-auto flex max-w-[1230px] items-center justify-between gap-3">
              <div className="md:hidden">
                <Wordmark />
              </div>
              <div className="hidden items-center gap-2 text-xs font-semibold text-[#6e776f] md:flex">
                <span className="size-2 rounded-full bg-[#789b7f]" />
                All caught up
                <span className="text-[#b0b5ae]">·</span>
                Synced just now
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant="bare"
                  size="icon"
                  className="text-[#6e776f] hover:bg-[#ebe5dc] hover:text-[#21332c] md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="size-[1.1rem]" />
                </Button>
                <Button
                  type="button"
                  variant="bare"
                  size="icon"
                  className="text-[#6e776f] hover:bg-[#ebe5dc] hover:text-[#21332c]"
                  aria-label="Search"
                >
                  <Search className="size-[1.05rem]" />
                </Button>
                <Button
                  type="button"
                  variant="bare"
                  size="icon"
                  className="text-[#6e776f] hover:bg-[#ebe5dc] hover:text-[#21332c]"
                  aria-label="Help"
                >
                  <CircleHelp className="size-[1.05rem]" />
                </Button>
                <div className="ml-1 flex size-8 items-center justify-center rounded-full bg-[#426a5a] text-[#fffdf8]">
                  <span className="text-xs font-bold">AM</span>
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-[1230px] px-4 pb-24 pt-7 sm:px-6 md:px-8 md:pb-12 md:pt-10 lg:px-12">
            <PageHeader title={copy.title} subtitle={copy.subtitle} />
            <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-w-0 space-y-5">
                {activeNav === "Home" ? (
                  <>
                    <HomeHero />
                    <RecommendationsPanel />
                  </>
                ) : null}
                {activeNav === "Today" ? <TasksPanel /> : null}
                {activeNav === "Journal" ? (
                  <>
                    <JournalFeature />
                    <JournalPastEntries />
                  </>
                ) : null}
                {activeNav === "Memories" ? <MemoriesGrid /> : null}
              </div>
              <aside className="space-y-5">
                {activeNav === "Home" || activeNav === "Today" ? (
                  <RhythmPanel />
                ) : null}
                <SpacesPanel />
                <div className="hidden items-center gap-3 px-2 text-xs leading-5 text-[#8b938a] xl:flex">
                  <Clock3 className="size-4 shrink-0 text-[#c36e52]" />
                  <span>Next reset in 10 hours, 18 minutes</span>
                </div>
              </aside>
            </div>
          </main>

          <nav
            className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-[1.5rem] border border-[#e5ddd1] bg-[#fffdf8]/95 p-2 shadow-[0_12px_30px_rgba(92,77,58,0.14)] backdrop-blur-md md:hidden"
            aria-label="Mobile navigation"
          >
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.label;
              return (
                <Button
                  key={item.label}
                  type="button"
                  variant="bare"
                  onClick={() => setActiveNav(item.label)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "h-12 min-w-16 flex-col gap-1 rounded-xl px-3 text-[0.62rem]",
                    active
                      ? "bg-[#e1ebe1] font-bold text-[#426a5a]"
                      : "text-[#8b938a]"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Button>
              );
            })}
            <Button
              type="button"
              variant="bare"
              className="h-12 min-w-16 flex-col gap-1 rounded-xl px-3 text-[0.62rem] text-[#8b938a]"
            >
              <MoreHorizontal className="size-4" />
              More
            </Button>
          </nav>
        </div>
      </div>
    </div>
  );
}
