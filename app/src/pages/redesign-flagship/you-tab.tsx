import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { goals, identityTraits, northStar } from "@/pages/redesign-preview-data";
import { MonoLabel } from "./shared";

// "You" is the new product surface the flagship mockup adds: identity
// traits + a north star statement + goals, so the AI on Home has something
// to aim data *at* rather than just reporting stats. This is meant to feel
// like the calmest, most personal tab — the compass, not a settings form —
// which is why it stays fully in the warm/editorial register with no
// tabular data or shortcut chips.

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
      </div>

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
        <Button
          type="button"
          variant="bare"
          className="mt-4 h-auto p-0 text-xs font-bold text-[var(--green)] underline decoration-[#a9c0ab] underline-offset-4"
        >
          Edit who you're becoming
        </Button>
      </article>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <MonoLabel>Goals</MonoLabel>
          <Button
            type="button"
            variant="bare"
            className="h-7 rounded-md px-2 text-xs font-semibold text-[var(--green)] hover:bg-[var(--sage)]"
          >
            + New goal
          </Button>
        </div>
        <div className="space-y-2.5">
          {goals.map((goal) => (
            <GoalCard key={goal.title} goal={goal} />
          ))}
        </div>
      </div>

      <p className="text-xs leading-5 text-[var(--muted)]">
        The AI reads this alongside your week — insights on Home point back
        to these goals instead of just reporting numbers.
      </p>
    </div>
  );
}
