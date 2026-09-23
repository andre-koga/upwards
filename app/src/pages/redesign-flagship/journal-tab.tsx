import { Bookmark, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { journalEntries } from "@/pages/redesign-preview-data";
import { MonoLabel } from "./shared";

// Journal is the reflective register: warm, unhurried, no tabular-nums or
// shortcut chips — this is where the "homey, personal" half of the design
// lives, unmixed. Contrast against Today is the point.

function JournalRow({ entry }: { entry: (typeof journalEntries)[number] }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--canvas)]">
      <span className="w-[4.2rem] shrink-0 text-xs text-[var(--muted)]">
        {entry.date}
      </span>
      <span className="shrink-0 text-base" aria-hidden>
        {entry.emoji}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
        {entry.snippet}
      </p>
      <Bookmark
        className={cn(
          "size-3.5 shrink-0",
          entry.bookmarked
            ? "fill-[var(--terracotta)] text-[var(--terracotta)]"
            : "text-[#c7cec7]"
        )}
        aria-hidden
      />
    </div>
  );
}

export function JournalTab() {
  return (
    <div className="space-y-4">
      <article className="relative overflow-hidden rounded-[1.75rem] bg-[var(--green)] p-6 text-[var(--paper)] sm:p-7">
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full border-[28px] border-white/10"
          aria-hidden
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <MonoLabel tone="onDark">Journal note · 07:18</MonoLabel>
            <Button
              type="button"
              variant="bare"
              size="iconRoundMd"
              className="border border-white/20 bg-white/10 text-[var(--paper)] hover:bg-white/20"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </div>
          <h2 className="mt-4 max-w-md font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-[1.02] tracking-[-0.03em]">
            A slower start
          </h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-[#e1ebe1]">
            "I let the morning arrive before I started asking it to be
            useful. Coffee, open windows, and one clear page."
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-[#d7e5d8]">
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              Living room
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              #presence
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[var(--gold)]" />
              12 day writing streak
            </span>
          </div>
        </div>
      </article>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-1">
        <div className="flex items-center justify-between px-1 py-2.5">
          <MonoLabel>Past entries</MonoLabel>
        </div>
        {journalEntries.map((entry) => (
          <JournalRow key={entry.date} entry={entry} />
        ))}
      </div>
    </div>
  );
}
