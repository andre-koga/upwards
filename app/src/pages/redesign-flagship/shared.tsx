import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { aiGradientLinear } from "./style";

// Shared visual primitives for the flagship mockup
// (app/src/pages/redesign-flagship/*). Single source for the small chip/
// label components so every tab reads as one coherent product instead of
// five separately-styled screens. Non-component constants (palette, tab
// id type) live in ./style.ts instead, so this file can stay
// component-only for React Fast Refresh.
//
// Design premise: warm, editorial "paper" surface for anything reflective
// (greeting, journal, memories, identity) — big serif type, soft shapes,
// room to breathe. Anything operational (tasks, stats, the AI's reasoning)
// gets a concrete, tool-like treatment layered on *top* of that same paper:
// tabular numerals, monospace micro-labels, hairline rules, keyboard-shortcut
// chips. The AI insight card is the one place allowed to go bolder —
// gradient + color — because it's the product's actual differentiator and
// should look unmistakably alive, not like another content card.

export function MonoLabel({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "onDark";
}) {
  return (
    <span
      className={cn(
        "font-mono text-[0.64rem] font-semibold uppercase tracking-[0.14em]",
        tone === "onDark" ? "text-[#cfe0d3]" : "text-[#8b938a]"
      )}
    >
      {children}
    </span>
  );
}

export function ShortcutChip({ children }: { children: ReactNode }) {
  return (
    <span className="hidden shrink-0 rounded-md border border-[var(--line)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[0.6rem] leading-none text-[var(--faint)] lg:inline-block">
      {children}
    </span>
  );
}

export function Dot({ color }: { color: string }) {
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

// The one recurring "this is AI-touched" signal — a small gradient-ringed
// sparkle used as a badge next to anything the AI personalized: a reordered
// task, an AI-written journal prompt, a curated memory throwback. Reused
// everywhere instead of inventing a new treatment per surface, so the
// "splash of color" reads as one consistent language.
export function AiGlowBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-medium text-white shadow-sm",
        className
      )}
      style={{ backgroundImage: aiGradientLinear }}
    >
      <Sparkles className="size-3" />
      {label}
    </span>
  );
}
