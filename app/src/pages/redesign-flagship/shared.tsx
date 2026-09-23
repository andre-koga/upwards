import type { ReactNode } from "react";
import { Flame, Image as ImageIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { aiGradient, aiGradientLinear, grainUrl } from "./style";

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

// Grain overlay for glass and gradient surfaces (manifesto §2.5). Decorative
// only — never over text, and always aria-hidden.
export function Grain({ opacity = 0.035 }: { opacity?: number }) {
  return (
    <span
      className="pointer-events-none absolute inset-0 mix-blend-overlay"
      style={{ backgroundImage: grainUrl, opacity }}
      aria-hidden
    />
  );
}

// A content card. Opaque paper + hairline border, per the manifesto: content
// cards are never glass and never a saturated brand fill.
export function Card({
  children,
  className,
  flush = false,
}: {
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--line)] bg-[var(--paper)]",
        !flush && "p-4",
        className
      )}
    >
      {children}
    </section>
  );
}

// Section label + optional trailing action, bound to the container below it so
// lists never read as a disconnected floating box (manifesto §5).
export function CardHeader({
  label,
  children,
}: {
  label: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2.5">
      {typeof label === "string" ? <MonoLabel>{label}</MonoLabel> : label}
      {children}
    </div>
  );
}

// Neutral media placeholder. Explicitly not a pastel block (manifesto §5).
export function MediaPlaceholder({
  className,
  icon,
  tone,
}: {
  className?: string;
  icon?: ReactNode;
  tone?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-[var(--canvas-deep)] text-[var(--faint)]",
        className
      )}
      style={tone ? { backgroundColor: tone } : undefined}
      aria-hidden
    >
      {icon ?? <ImageIcon className="size-4 opacity-60" />}
    </div>
  );
}

// The one recurring "this is AI-touched" signal — tier 3 of the intensity
// scale in the manifesto. Reused everywhere instead of per-surface treatments.
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

// Tier 2: a gradient hairline edge around otherwise-paper content.
export function AiEdge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-2xl p-[1.5px]", className)}
      style={{ backgroundImage: aiGradient }}
    >
      <div className="rounded-[calc(1rem-1.5px)] bg-[var(--paper)]">
        {children}
      </div>
    </div>
  );
}

// A streak flame, rendered inside checkboxes/counters like the real app does.
export function StreakFlame({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-0.5 font-mono text-[0.6rem] font-bold tabular-nums text-[var(--terracotta)]">
      <Flame className="size-2.5 fill-current" />
      {count}
    </span>
  );
}
