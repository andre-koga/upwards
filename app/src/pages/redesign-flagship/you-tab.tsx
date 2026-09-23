import { useState } from "react";
import {
  ArrowRight,
  Check,
  MessageCircleQuestion,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  goals,
  identityTraits,
  knowledgeMap,
  nextCheckIn,
  northStar,
  strategies,
} from "@/pages/redesign-preview-data";
import { MonoLabel } from "./shared";
import { aiGradient } from "./style";

// The Compass is the organic, AI-tended surface the user asked for: not a
// profile form filled out once, but a knowledge map the AI actively builds
// via onboarding + periodic check-ins, always open for the user to add to
// on their own terms. Three things carry that idea:
//   1. CheckInCard — a live, dated prompt for the *next* scheduled round of
//      questions, with a countdown, not a settings toggle.
//   2. KnowledgeMap — a timeline of what the AI has actually learned,
//      each entry dated ("2 days ago"), so growth is visible over time.
//   3. AskMeCard — always-available free-text input, so the user isn't
//      stuck waiting for the next scheduled check-in to add something.
// Strategies (verified patterns) are kept visually distinct from goals
// (what they want) and traits (who they are) — three different kinds of
// knowledge, three different card treatments.

function CheckInCard() {
  return (
    <article
      className="relative overflow-hidden rounded-[1.5rem] p-5 text-[var(--paper)] sm:p-6"
      style={{ backgroundImage: aiGradient }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[radial-gradient(circle,_rgba(201,154,63,0.5),_transparent_65%)] blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-8 size-60 rounded-full bg-[radial-gradient(circle,_rgba(141,132,169,0.4),_transparent_65%)] blur-2xl"
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-[#e9cf8f]" />
          <MonoLabel tone="onDark">Getting to know you</MonoLabel>
        </div>
        <p className="mt-3 max-w-sm font-display text-xl leading-snug sm:text-2xl">
          A few questions to deepen your compass, in {nextCheckIn.daysUntil}{" "}
          days.
        </p>
        <p className="mt-2 max-w-sm text-sm text-[#e7e0cf]">
          {nextCheckIn.questionCount} short questions · about{" "}
          {nextCheckIn.estMinutes} minutes. Skip anytime — nothing here is
          required.
        </p>
        <Button
          type="button"
          variant="bare"
          className="mt-4 h-9 rounded-full bg-[#fbf7ee] px-4 text-xs font-semibold text-[#28453a] hover:bg-white"
        >
          Answer now instead
        </Button>
      </div>
    </article>
  );
}

function KnowledgeEntry({
  entry,
  isLast,
}: {
  entry: (typeof knowledgeMap)[number];
  isLast: boolean;
}) {
  return (
    <div className="relative pl-6">
      <span
        className="absolute left-0 top-1 size-2.5 rounded-full border-2 border-[var(--paper)] bg-[var(--green)]"
        aria-hidden
      />
      {!isLast ? (
        <span
          className="absolute left-[4.5px] top-4 bottom-[-1.1rem] w-px bg-[var(--line)]"
          aria-hidden
        />
      ) : null}
      <p className="text-[0.68rem] text-[var(--faint)]">{entry.learnedAgo}</p>
      <p className="mt-1 text-sm font-medium text-[var(--ink)]">
        {entry.question}
      </p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
        "{entry.answer}"
      </p>
    </div>
  );
}

function AskMeCard() {
  const [value, setValue] = useState("");
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
        <MessageCircleQuestion className="size-3.5 text-[var(--green)]" />
        Tell me something, anytime
      </span>
      <div className="mt-2.5 flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="e.g. I've been trying to read more before bed…"
          className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--faint)] focus:outline-none focus:ring-2 focus:ring-[var(--green)]/30"
        />
        <Button
          type="button"
          variant="bare"
          size="iconRoundMd"
          className="shrink-0 bg-[var(--green)] text-[var(--paper)] hover:bg-[var(--green-deep)]"
          aria-label="Send"
        >
          <Send className="size-4" />
        </Button>
      </div>
      <p className="mt-2 text-[0.68rem] text-[var(--faint)]">
        This folds straight into your knowledge map below.
      </p>
    </div>
  );
}

function StrategyCard({ item }: { item: (typeof strategies)[number] }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3.5">
      <span
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${item.color}26` }}
      >
        <Check className="size-3.5" style={{ color: item.color }} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--ink)]">
          {item.title}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          {item.detail}
        </p>
      </div>
    </div>
  );
}

function GoalCard({ goal }: { goal: (typeof goals)[number] }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">
            {goal.title}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{goal.detail}</p>
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">
          {goal.progress}%
        </span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--sage)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${goal.progress}%`, backgroundColor: goal.color }}
        />
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-[0.68rem] text-[var(--green)]">
        <Sparkles className="size-3 shrink-0" />
        {goal.aiNote}
      </p>
    </div>
  );
}

export function YouTab() {
  return (
    <div className="space-y-5">
      <div>
        <MonoLabel>Your compass</MonoLabel>
        <h1 className="mt-1.5 max-w-md font-display text-[clamp(1.9rem,4vw,2.5rem)] leading-[1.05] tracking-[-0.03em] text-[var(--ink)]">
          Who you're becoming
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
          This grows as you live — the AI asks, listens, and updates it. It's
          never finished.
        </p>
      </div>

      <CheckInCard />

      <article className="relative overflow-hidden rounded-[1.5rem] bg-[var(--canvas-deep)] p-5">
        <MonoLabel>North star</MonoLabel>
        <p className="mt-2 font-display text-lg leading-snug text-[var(--ink)]">
          "{northStar}"
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {identityTraits.map((trait) => (
            <span
              key={trait}
              className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 text-xs text-[var(--ink)]"
            >
              {trait}
            </span>
          ))}
        </div>
      </article>

      <AskMeCard />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <MonoLabel>Knowledge map</MonoLabel>
          <span className="text-[0.68rem] text-[var(--faint)]">
            {knowledgeMap.length} things learned
          </span>
        </div>
        <div className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
          {knowledgeMap.map((entry, i) => (
            <KnowledgeEntry
              key={entry.question}
              entry={entry}
              isLast={i === knowledgeMap.length - 1}
            />
          ))}
        </div>
      </div>

      <div>
        <MonoLabel>What works for you</MonoLabel>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Verified from your data, not guessed.
        </p>
        <div className="mt-3 space-y-2.5">
          {strategies.map((item) => (
            <StrategyCard key={item.title} item={item} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <MonoLabel>Goals</MonoLabel>
          <Button
            type="button"
            variant="bare"
            className="h-7 gap-1 rounded-md px-2 text-xs font-semibold text-[var(--green)] hover:bg-[var(--sage)]"
          >
            <Plus className="size-3.5" />
            New goal
          </Button>
        </div>
        <div className="space-y-2.5">
          {goals.map((goal) => (
            <GoalCard key={goal.title} goal={goal} />
          ))}
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs leading-5 text-[var(--muted)]">
        <ArrowRight className="size-3.5 shrink-0" />
        Home's insights point back to this — every recommendation names the
        goal it serves.
      </p>

      {/* Secondary surfaces kept visible rather than buried, so the redesign
          doesn't hide shipped functionality (manifesto §3.4). */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <div className="border-b border-[var(--line)] px-4 py-2.5">
          <MonoLabel>Account & data</MonoLabel>
        </div>
        {[
          { label: "Appearance", hint: "System / Light / Dark · 9 palettes" },
          { label: "Language", hint: "English · Português (BR)" },
          { label: "Day reset time", hint: "4:00 AM" },
          { label: "AI insights", hint: "Your key, your model · test connection" },
          { label: "Sync & conflicts", hint: "All synced · review issues" },
          { label: "Backup", hint: "Export / import JSON" },
          { label: "What's new", hint: "2 unread" },
        ].map((row) => (
          <button
            key={row.label}
            type="button"
            className="flex w-full items-center gap-3 border-b border-[var(--line)] px-4 py-2.5 text-left last:border-b-0 hover:bg-[var(--canvas)]"
          >
            <span className="flex-1 truncate text-sm text-[var(--ink)]">
              {row.label}
            </span>
            <span className="shrink-0 truncate text-[0.66rem] text-[var(--muted)]">
              {row.hint}
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-[var(--faint)]" />
          </button>
        ))}
      </div>
    </div>
  );
}
