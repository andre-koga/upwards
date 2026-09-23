import { Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { memories, memoryThrowback } from "@/pages/redesign-preview-data";
import { AiGlowBadge, MonoLabel } from "./shared";
import { aiGradient } from "./style";

function MemoryCard({ memory }: { memory: (typeof memories)[number] }) {
  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--paper)]">
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
  );
}

function Throwback() {
  return (
    <article
      className="relative overflow-hidden rounded-[1.5rem] p-6 text-[var(--paper)]"
      style={{ backgroundImage: aiGradient }}
    >
      <div
        className="pointer-events-none absolute -right-14 -top-14 size-52 rounded-full bg-[radial-gradient(circle,_rgba(201,154,63,0.5),_transparent_65%)] blur-2xl"
        aria-hidden
      />
      <div className="relative">
        <AiGlowBadge
          label={`${memoryThrowback.yearsAgo} years ago today`}
          className="bg-white/15 shadow-none backdrop-blur-sm"
        />
        <p className="mt-4 font-display text-xl leading-snug">
          "{memoryThrowback.snippet}"
        </p>
        <div className="mt-4 flex items-center justify-between text-xs text-[#f2ead9]">
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3" />
            Surfaced automatically · {memoryThrowback.date}
          </span>
        </div>
      </div>
    </article>
  );
}

export function MemoriesTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <MonoLabel>Kept for later</MonoLabel>
          <h1 className="mt-1.5 font-display text-[clamp(1.9rem,4vw,2.5rem)] leading-[1] tracking-[-0.03em] text-[var(--ink)]">
            Memories
          </h1>
        </div>
        <Button
          type="button"
          variant="bare"
          className="h-9 shrink-0 rounded-full px-3 text-xs font-semibold text-[var(--green)] hover:bg-[var(--sage)]"
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      <Throwback />

      <div className="grid gap-4 sm:grid-cols-2">
        {memories.map((memory) => (
          <MemoryCard key={memory.timeLabel} memory={memory} />
        ))}
      </div>
    </div>
  );
}
