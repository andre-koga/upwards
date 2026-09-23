import { ArrowUpRight, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  goals,
  identityTraits,
  insightRecommendations,
  insightSummary,
} from "@/pages/redesign-preview-data";
import { Dot, MonoLabel, ShortcutChip } from "./shared";

// The Home tab is the product's actual pitch: not a pile of static data,
// but that data digested against who the person says they're trying to
// become. The AI card is the only saturated, gradient-heavy surface in the
// whole app — everything else stays warm-neutral paper — so it reads as a
// distinct, "alive" moment rather than one more content card.

function AiHero({ onOpenCompass }: { onOpenCompass: () => void }) {
  return (
    <article
      className="relative overflow-hidden rounded-[1.75rem] p-5 text-[#fbf7ee] shadow-[0_20px_50px_rgba(40,69,58,0.28)] sm:p-7"
      style={{
        backgroundImage:
          "radial-gradient(120% 140% at 0% 0%, #3f6656 0%, #2c5246 32%, #1f3f52 58%, #4a3b63 78%, #a4643f 100%)",
      }}
    >
      {/* Two soft glows, not hard rings — the "beautiful" register applied
          with restraint so it still feels premium rather than decorative. */}
      <div
        className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-[radial-gradient(circle,_rgba(201,154,63,0.55),_transparent_65%)] blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-[radial-gradient(circle,_rgba(141,132,169,0.45),_transparent_65%)] blur-2xl"
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-[#e9cf8f]" />
            <MonoLabel tone="onDark">AI insight · refreshed 3h ago</MonoLabel>
          </div>
          <div className="flex items-center gap-1.5">
            <ShortcutChip>R</ShortcutChip>
            <Button
              type="button"
              variant="bare"
              size="iconRoundMd"
              className="border border-white/20 bg-white/10 text-[#fbf7ee] hover:bg-white/20"
              aria-label="Refresh insight"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>

        <h1 className="mt-5 max-w-lg font-display text-[clamp(1.7rem,4.4vw,2.5rem)] leading-[1.12] tracking-[-0.02em]">
          {insightSummary}
        </h1>

        <button
          type="button"
          onClick={onOpenCompass}
          className="mt-5 flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-left text-xs text-[#f2ead9] backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          <Dot color="#d5a94a" />
          <span>
            Because you said you want to{" "}
            <strong className="font-semibold">
              be a calmer, more present parent
            </strong>
          </span>
          <ArrowUpRight className="size-3.5 shrink-0 opacity-70" />
        </button>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="bare"
            className="h-9 rounded-full bg-[#fbf7ee] px-4 text-xs font-semibold text-[#28453a] hover:bg-white"
          >
            Add to today
          </Button>
          <Button
            type="button"
            variant="bare"
            className="h-9 rounded-full border border-white/25 bg-transparent px-4 text-xs font-semibold text-[#fbf7ee] hover:bg-white/10"
          >
            See why
          </Button>
          <span className="ml-auto hidden text-[0.68rem] text-[#d7cdb8] sm:inline">
            Based on 7 days · your key, your model
          </span>
        </div>
      </div>
    </article>
  );
}

function RecommendationRow({
  item,
}: {
  item: (typeof insightRecommendations)[number];
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--line)] px-4 py-3.5 last:border-b-0">
      <Dot color={item.color} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--ink)]">
          {item.title}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          {item.detail}
        </p>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--sage)] px-2 py-0.5 font-mono text-[0.6rem] text-[var(--green)]">
          → {item.goal}
        </span>
      </div>
      <Button
        type="button"
        variant="bare"
        size="iconRoundSm"
        className="shrink-0 text-[var(--faint)] hover:bg-[var(--sage)] hover:text-[var(--green)]"
        aria-label={`Add "${item.title}" to today`}
      >
        <ArrowUpRight className="size-3.5" />
      </Button>
    </div>
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
    <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3.5 py-3">
      <MonoLabel>{label}</MonoLabel>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--ink)]">
        {value}
      </p>
      <p className="mt-0.5 text-[0.68rem] text-[var(--muted)]">{hint}</p>
    </div>
  );
}

export function HomeTab({ onOpenCompass }: { onOpenCompass: () => void }) {
  const topGoal = goals[0];

  return (
    <div className="space-y-4">
      <AiHero onOpenCompass={onOpenCompass} />

      <div className="grid grid-cols-3 gap-2.5">
        <StatTile label="Completion" value="74%" hint="intentions met" />
        <StatTile label="Best window" value="AM" hint="91% before noon" />
        <StatTile label="Streak" value="12d" hint="writing streak" />
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
          <MonoLabel>Worth acting on</MonoLabel>
        </div>
        {insightRecommendations.map((item) => (
          <RecommendationRow key={item.title} item={item} />
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenCompass}
        className="w-full rounded-xl border border-[var(--line)] bg-[var(--canvas-deep)]/60 px-4 py-3.5 text-left transition-colors hover:bg-[var(--canvas-deep)]"
      >
        <div className="flex items-center justify-between">
          <MonoLabel>Your compass</MonoLabel>
          <ShortcutChip>G Y</ShortcutChip>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {identityTraits.map((trait) => (
            <span
              key={trait}
              className={cn(
                "rounded-full border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 text-xs text-[var(--ink)]"
              )}
            >
              {trait}
            </span>
          ))}
        </div>
        <p className="mt-2.5 text-xs text-[var(--muted)]">
          Top goal: {topGoal.title} — {topGoal.progress}% there
        </p>
      </button>
    </div>
  );
}
