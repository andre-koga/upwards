import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Palmtree,
  Pin,
  Play,
  Plus,
  Square,
  Sparkles,
  Timer,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rhythmBars } from "@/pages/redesign-preview-data";
import {
  anytimeActivities,
  memos,
  timelineSessions,
  timelineTotal,
  todayActivities,
} from "./mock-data";
import {
  AiGlowBadge,
  Card,
  CardHeader,
  MonoLabel,
  ShortcutChip,
  StreakFlame,
} from "./shared";
import { glass } from "./style";

// Today = the instrument register (manifesto §1). Everything operational lives
// here: the five activity kinds the real app supports, streak flames inside the
// controls, start/stop timers, the sessions timeline with derived untimed
// completions, memos, break day, and day navigation. The single AI touch is the
// ordering badge + per-row reason, at tier 3 intensity.

function DayNav() {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="bare"
        size="iconRoundSm"
        className="border border-[var(--line)] bg-[var(--paper)] text-[var(--muted)]"
        aria-label="Previous day"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        type="button"
        variant="bare"
        className="h-8 gap-1.5 rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 text-xs font-semibold text-[var(--green)]"
      >
        <CalendarDays className="size-3.5" />
        Wed, Sep 23
      </Button>
      <Button
        type="button"
        variant="bare"
        size="iconRoundSm"
        className="border border-[var(--line)] bg-[var(--paper)] text-[var(--faint)]"
        aria-label="Next day"
        disabled
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

function fmt(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** The left-hand control differs per activity kind, like the real app. */
function ActivityControl({ a }: { a: (typeof todayActivities)[number] }) {
  if (a.kind === "counter") {
    const done = (a.count ?? 0) >= (a.target ?? 1);
    return (
      <button
        type="button"
        aria-label={`${a.title}: ${a.count} of ${a.target}, tap to increment`}
        className={cn(
          "flex h-7 min-w-[2.75rem] shrink-0 items-center justify-center gap-1 rounded-full border px-2 font-mono text-[0.68rem] font-bold tabular-nums",
          done
            ? "border-[var(--green)] bg-[var(--sage)] text-[var(--green)]"
            : "border-[var(--line)] bg-[var(--canvas)] text-[var(--ink)]"
        )}
      >
        {done ? <StreakFlame count={a.streak} /> : `${a.count}/${a.target}`}
      </button>
    );
  }

  if (a.kind === "never") {
    const clean = (a.slips ?? 0) === 0;
    return (
      <button
        type="button"
        aria-label={
          clean
            ? `${a.title}: no slips, tap to log one`
            : `${a.title}: ${a.slips} slips`
        }
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border",
          clean
            ? "border-[var(--line)] bg-[var(--canvas)]"
            : "border-[#d9a99b] bg-[#f7e3dd] text-[#a4523b]"
        )}
      >
        {clean ? <StreakFlame count={a.streak} /> : <X className="size-3.5" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={
        a.done ? `Completed: ${a.title}` : `Mark ${a.title} complete`
      }
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border",
        a.done
          ? "border-[var(--green)] bg-[var(--sage)]"
          : "border-[#c7cec7] bg-[var(--canvas)] text-transparent"
      )}
    >
      {a.done ? <StreakFlame count={a.streak} /> : <Check className="size-3.5" />}
    </button>
  );
}

function ActivityRow({
  a,
  index,
}: {
  a: (typeof todayActivities)[number];
  index: number;
}) {
  return (
    <div
      className={cn(
        "border-b border-[var(--line)] px-4 py-2.5 last:border-b-0",
        a.running && "bg-[#fff8f4]"
      )}
    >
      <div className="flex items-center gap-2.5">
        <ActivityControl a={a} />
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: a.color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-sm font-medium text-[var(--ink)]",
              a.done && "text-[var(--muted)] line-through"
            )}
          >
            {a.title}
          </p>
          <p className="mt-0.5 truncate font-mono text-[0.66rem] tabular-nums text-[var(--muted)]">
            {a.group}
            {a.trackedMs ? ` · ${fmt(a.trackedMs)}` : ""}
          </p>
        </div>

        {a.pinned ? (
          <Pin
            className="size-3.5 shrink-0 fill-current text-[var(--terracotta)]"
            aria-label="Pinned — the AI won't reorder this"
          />
        ) : null}

        {/* Start/stop timer — the feature the earlier mockup dropped entirely. */}
        <Button
          type="button"
          variant="bare"
          size="iconRoundSm"
          className={cn(
            "shrink-0 border",
            a.running
              ? "border-[var(--terracotta)] bg-[var(--terracotta)] text-white"
              : "border-[var(--line)] bg-[var(--paper)] text-[var(--muted)]"
          )}
          aria-label={a.running ? `Stop timing ${a.title}` : `Start timing ${a.title}`}
        >
          {a.running ? (
            <Square className="size-3 fill-current" />
          ) : (
            <Play className="size-3 fill-current" />
          )}
        </Button>
        <Button
          type="button"
          variant="bare"
          size="iconRoundSm"
          className="shrink-0 text-[var(--faint)]"
          aria-label={`Add time manually to ${a.title}`}
        >
          <Plus className="size-3.5" />
        </Button>
        <ShortcutChip>{index + 1}</ShortcutChip>
      </div>
      {a.aiReason ? (
        <p className="ml-[2.3rem] mt-1 flex items-center gap-1.5 text-[0.66rem] text-[var(--muted)]">
          <Sparkles className="size-3 shrink-0 text-[var(--gold)]" />
          {a.aiReason}
        </p>
      ) : null}
    </div>
  );
}

/** Live running session — glass, because it floats above content. */
function RunningPill() {
  const running = todayActivities.find((a) => a.running);
  if (!running) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl px-4 py-3",
        glass
      )}
    >
      <span
        className="size-2.5 shrink-0 animate-pulse rounded-full"
        style={{ backgroundColor: running.color }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <MonoLabel>{running.group} · running</MonoLabel>
        <p className="truncate text-sm font-semibold text-[var(--ink)]">
          {running.title}
        </p>
      </div>
      <p className="shrink-0 font-mono text-lg font-semibold tabular-nums text-[var(--ink)]">
        {fmt(running.trackedMs ?? 0)}
      </p>
      <Button
        type="button"
        variant="bare"
        className="h-8 shrink-0 rounded-full bg-[var(--terracotta)] px-3 text-xs font-bold text-white"
      >
        Stop
      </Button>
    </div>
  );
}

function Timeline() {
  return (
    <Card flush>
      <CardHeader label="Timeline">
        <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
          {timelineTotal} tracked
        </span>
      </CardHeader>
      {timelineSessions.map((s) => (
        <div
          key={`${s.activity}-${s.label}`}
          className="border-b border-[var(--line)] px-4 py-2.5 last:border-b-0"
        >
          <div className="flex items-center gap-2.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
              {s.activity}
            </p>
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[0.66rem] tabular-nums",
                s.kind === "running"
                  ? "bg-[#f3dfd7] text-[#a4523b]"
                  : "bg-[var(--canvas)] text-[var(--muted)]"
              )}
            >
              {s.kind === "untimed" ? (
                <Clock3 className="size-3" />
              ) : (
                <Timer className="size-3" />
              )}
              {s.label}
            </span>
          </div>
          {s.note ? (
            <p className="ml-[1.1rem] mt-1 text-xs leading-5 text-[var(--muted)]">
              {s.note}
            </p>
          ) : null}
        </div>
      ))}
      <p className="px-4 py-2 text-[0.66rem] text-[var(--faint)]">
        <Clock3 className="mr-1 inline size-3" />
        Untimed rows are completions without a duration. Tap any row to edit,
        reassign, or replay it.
      </p>
    </Card>
  );
}

function Memos() {
  return (
    <Card flush>
      <CardHeader label="Memos">
        <div className="flex items-center gap-1.5">
          <ShortcutChip>N</ShortcutChip>
          <Button
            type="button"
            variant="bare"
            className="h-7 gap-1 rounded-md px-2 text-xs font-semibold text-[var(--green)]"
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </CardHeader>
      {memos.map((m) => (
        <div
          key={m.title}
          className="flex items-center gap-2.5 border-b border-[var(--line)] px-4 py-2.5 last:border-b-0"
        >
          <span
            className={cn(
              "flex size-[1.15rem] shrink-0 items-center justify-center rounded-full border",
              m.done
                ? "border-[var(--green)] bg-[var(--green)] text-white"
                : "border-[#c7cec7]"
            )}
          >
            {m.done ? <Check className="size-3" /> : null}
          </span>
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-sm text-[var(--ink)]",
              m.done && "text-[var(--muted)] line-through"
            )}
          >
            {m.title}
          </p>
          {m.recurring ? (
            <span className="shrink-0 rounded-md bg-[var(--sage)] px-1.5 py-0.5 font-mono text-[0.58rem] uppercase text-[var(--green)]">
              recurring
            </span>
          ) : null}
          {m.due ? (
            <span className="shrink-0 font-mono text-[0.66rem] text-[var(--muted)]">
              {m.due}
            </span>
          ) : null}
          {m.pinned ? (
            <Pin className="size-3 shrink-0 fill-current text-[var(--terracotta)]" />
          ) : null}
        </div>
      ))}
    </Card>
  );
}

/** Stats never ship alone — manifesto §4.4. */
function WeekWithActions() {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <MonoLabel>This week</MonoLabel>
        <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
          74% avg
        </span>
      </div>
      <div className="mt-3 flex h-16 items-end justify-between gap-2">
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
      <div className="mt-3 border-t border-[var(--line)] pt-3">
        <p className="flex items-start gap-1.5 text-xs leading-5 text-[var(--ink)]">
          <Sparkles className="mt-0.5 size-3 shrink-0 text-[var(--gold)]" />
          Thursday is your weakest day — it follows your strongest. Try moving
          one Thursday task to Wednesday.
        </p>
        <div className="mt-2 flex gap-1.5">
          <Button
            type="button"
            variant="bare"
            className="h-7 rounded-full bg-[var(--sage)] px-2.5 text-[0.68rem] font-semibold text-[var(--green)]"
          >
            Rebalance Thursday
          </Button>
          <Button
            type="button"
            variant="bare"
            className="h-7 rounded-full px-2.5 text-[0.68rem] font-semibold text-[var(--muted)]"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function TodayTab() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <MonoLabel>Wednesday, September 23</MonoLabel>
          <h1 className="mt-1.5 font-display text-[clamp(1.9rem,4vw,2.5rem)] leading-[1] tracking-[-0.03em] text-[var(--ink)]">
            5 things, in order
          </h1>
        </div>
        <DayNav />
      </div>

      <RunningPill />

      <Card flush>
        <CardHeader label={<AiGlowBadge label="Ordered by what works for you" />}>
          <Button
            type="button"
            variant="bare"
            size="iconRoundSm"
            className="text-[var(--muted)]"
            aria-label="Mark today as a break day"
            title="Break day — misses won't break your streaks"
          >
            <Palmtree className="size-4" />
          </Button>
        </CardHeader>
        {todayActivities.map((a, i) => (
          <ActivityRow key={a.title} a={a} index={i} />
        ))}
        <p className="px-4 py-2 text-[0.66rem] text-[var(--faint)]">
          <Pin className="mr-1 inline size-3" />
          Pin a task to hold its spot. Counters, checkboxes and avoid-habits all
          keep their own streak.
        </p>
      </Card>

      <Timeline />
      <Memos />

      <Card flush>
        <CardHeader label="Anytime · no schedule" />
        {anytimeActivities.map((a) => (
          <div
            key={a.title}
            className="flex items-center gap-2.5 border-b border-[var(--line)] px-4 py-2.5 last:border-b-0"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: a.color }}
              aria-hidden
            />
            <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
              {a.title}
            </p>
            <span className="shrink-0 font-mono text-[0.66rem] tabular-nums text-[var(--muted)]">
              {fmt(a.allTimeMs)} all time
            </span>
            <Button
              type="button"
              variant="bare"
              size="iconRoundSm"
              className="shrink-0 border border-[var(--line)] text-[var(--muted)]"
              aria-label={`Start timing ${a.title}`}
            >
              <Play className="size-3 fill-current" />
            </Button>
          </div>
        ))}
      </Card>

      <div className="xl:hidden">
        <WeekWithActions />
      </div>

      <p className="hidden text-[0.66rem] text-[var(--faint)] lg:block">
        <span className="font-mono">j / k</span> move ·{" "}
        <span className="font-mono">x</span> complete ·{" "}
        <span className="font-mono">t</span> start/stop ·{" "}
        <span className="font-mono">p</span> pin ·{" "}
        <span className="font-mono">n</span> new memo ·{" "}
        <span className="font-mono">← →</span> change day
      </p>
    </div>
  );
}

export { WeekWithActions };
