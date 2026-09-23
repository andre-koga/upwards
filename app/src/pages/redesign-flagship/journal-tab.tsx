import { useState } from "react";
import {
  Bookmark,
  Heart,
  Image as ImageIcon,
  MapPin,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { journalPrompts } from "@/pages/redesign-preview-data";
import {
  calendarDays,
  galleryMonths,
  mapPins,
  recordEntries,
  recordFilters,
  recordViewModes,
  type RecordViewMode,
} from "./mock-data";
import {
  AiEdge,
  AiGlowBadge,
  Card,
  CardHeader,
  MediaPlaceholder,
  MonoLabel,
} from "./shared";
import { glass } from "./style";

// Journal = the merged record. Memories are not a separate destination: a
// memory is an entry whose date precision is "approximate" (manifesto §3.1).
// Four view modes cover looking back (§3.3): Feed, Calendar, Map, Gallery.
// Editorial register throughout — this is the warm half of the product.

function ViewModeTabs({
  mode,
  onChange,
}: {
  mode: RecordViewMode;
  onChange: (m: RecordViewMode) => void;
}) {
  return (
    <div
      className={cn("inline-flex items-center gap-0.5 rounded-full p-1", glass)}
      role="tablist"
      aria-label="Browse mode"
    >
      {recordViewModes.map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={m === mode}
          onClick={() => onChange(m)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            m === mode
              ? "bg-[var(--green)] text-[var(--paper)]"
              : "text-[var(--muted)] hover:text-[var(--ink)]"
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function SearchAndFilters() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2">
        <Search className="size-3.5 shrink-0 text-[var(--faint)]" />
        <span className="flex-1 text-sm text-[var(--faint)]">
          Search words, places, dates, holidays…
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {recordFilters.map((f) => (
          <button
            key={f}
            type="button"
            className="rounded-full border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
          >
            {f}
          </button>
        ))}
        <span className="ml-1 text-[0.66rem] text-[var(--faint)]">
          tap once to require · twice to exclude
        </span>
      </div>
    </div>
  );
}

/** AI prompts for when the user doesn't know what to write — tier 2. */
function StuckPrompts() {
  return (
    <AiEdge>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
            <Sparkles className="size-3.5 text-[var(--terracotta)]" />
            Not sure what to write?
          </span>
          <Button
            type="button"
            variant="bare"
            size="iconRoundSm"
            className="text-[var(--faint)]"
            aria-label="Shuffle prompts"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
        <div className="mt-2.5 space-y-1">
          {journalPrompts.map((p) => (
            <button
              key={p}
              type="button"
              className="w-full rounded-lg px-2.5 py-2 text-left text-sm leading-5 text-[var(--muted)] hover:bg-[var(--canvas)] hover:text-[var(--ink)]"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </AiEdge>
  );
}

/** Today's entry: emoji, title, text, video, photo pile, places, streak. */
function TodayEntry() {
  const e = recordEntries[0];
  return (
    <Card className="overflow-hidden p-0">
      <div className="relative">
        <MediaPlaceholder
          className="h-40 w-full"
          icon={
            <div className="flex flex-col items-center gap-1.5 text-[var(--muted)]">
              <Play className="size-7 fill-current opacity-70" />
              <span className="font-mono text-[0.62rem] uppercase tracking-wider">
                10s video
              </span>
            </div>
          }
        />
        <span className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-full bg-[var(--paper)] text-lg shadow-sm">
          {e.emoji}
        </span>
        {/* Photo pile — the real app's "tossed stack". */}
        <div className="absolute bottom-3 right-3 flex items-center">
          {[0, 1, 2].map((i) => (
            <MediaPlaceholder
              key={i}
              className={cn(
                "size-11 rounded-lg border-2 border-[var(--paper)] shadow-sm",
                i > 0 && "-ml-4"
              )}
              icon={<ImageIcon className="size-3.5 opacity-50" />}
            />
          ))}
          <span className="ml-1.5 rounded-full bg-[var(--paper)]/90 px-1.5 py-0.5 font-mono text-[0.6rem] text-[var(--ink)]">
            {e.photos}
          </span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <MonoLabel>
              Entry #{e.entryNumber} · {e.dateLabel}
            </MonoLabel>
            <h2 className="mt-1.5 font-display text-2xl leading-tight tracking-[-0.02em] text-[var(--ink)]">
              {e.title}
            </h2>
          </div>
          <Button
            type="button"
            variant="bare"
            size="iconRoundMd"
            className="shrink-0 border border-[var(--line)] text-[var(--terracotta)]"
            aria-label="Remove bookmark"
            aria-pressed
          >
            <Heart className="size-4 fill-current" />
          </Button>
        </div>
        <p className="mt-2.5 text-sm leading-7 text-[var(--muted)]">
          {e.snippet}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {e.places.map((p) => (
            <button
              key={p}
              type="button"
              className="flex items-center gap-1 rounded-full bg-[var(--canvas)] px-2.5 py-1 text-xs text-[var(--muted)]"
            >
              <MapPin className="size-3" />
              {p}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[0.66rem] text-[var(--terracotta)]">
            12 day streak
          </span>
        </div>
      </div>
    </Card>
  );
}

/** AI-curated resurfacing of an old entry — tier 2 gradient edge. */
function Throwback() {
  return (
    <AiEdge>
      <div className="flex items-start gap-3 p-4">
        <MediaPlaceholder
          className="size-16 shrink-0 rounded-lg"
          tone="#d9cfc0"
          icon={<ImageIcon className="size-4 opacity-50" />}
        />
        <div className="min-w-0 flex-1">
          <AiGlowBadge label="3 years ago today" />
          <p className="mt-2 font-display text-lg leading-snug text-[var(--ink)]">
            Signed the studio lease
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Terrified and thrilled in equal parts. Surfaced automatically ·
            Sep 23, 2023
          </p>
        </div>
      </div>
    </AiEdge>
  );
}

function FeedView() {
  return (
    <div className="space-y-4">
      <SearchAndFilters />
      <TodayEntry />
      <StuckPrompts />
      <Throwback />
      <Card flush>
        <CardHeader label="Earlier">
          <span className="text-[0.66rem] text-[var(--faint)]">
            exact + approximate dates, one record
          </span>
        </CardHeader>
        {recordEntries.slice(1).map((e) => (
          <article
            key={e.id}
            className="flex items-start gap-3 border-b border-[var(--line)] px-4 py-3 last:border-b-0 hover:bg-[var(--canvas)]"
          >
            <div className="w-11 shrink-0 text-center">
              {e.precision === "exact" ? (
                <>
                  <p className="font-display text-xl leading-none text-[var(--ink)]">
                    {e.dayNum}
                  </p>
                  <p className="mt-0.5 font-mono text-[0.58rem] uppercase text-[var(--faint)]">
                    {e.weekday}
                  </p>
                </>
              ) : (
                <span
                  className="mx-auto flex size-8 items-center justify-center rounded-full bg-[var(--canvas-deep)] text-sm"
                  title="Approximate date"
                >
                  {e.emoji}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-[var(--ink)]">
                  {e.title}
                </p>
                {e.precision === "approximate" ? (
                  <span className="shrink-0 rounded bg-[var(--canvas-deep)] px-1.5 py-0.5 font-mono text-[0.56rem] uppercase text-[var(--muted)]">
                    ~{e.dateLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                {e.snippet}
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-[var(--faint)]">
                {e.photos > 0 ? (
                  <span className="flex items-center gap-1 font-mono text-[0.6rem]">
                    <ImageIcon className="size-3" />
                    {e.photos}
                  </span>
                ) : null}
                {e.hasVideo ? <Video className="size-3" /> : null}
                {e.places.length > 0 ? (
                  <span className="flex items-center gap-1 font-mono text-[0.6rem]">
                    <MapPin className="size-3" />
                    {e.places.length}
                  </span>
                ) : null}
              </div>
            </div>
            {e.bookmarked ? (
              <Bookmark className="size-3.5 shrink-0 fill-current text-[var(--terracotta)]" />
            ) : null}
          </article>
        ))}
      </Card>
    </div>
  );
}

function CalendarView() {
  return (
    <div className="space-y-4">
      <SearchAndFilters />
      <Card>
        <div className="flex items-center justify-between">
          <MonoLabel>September 2026</MonoLabel>
          <span className="text-[0.66rem] text-[var(--faint)]">
            15 of 23 days written
          </span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="text-center font-mono text-[0.6rem] uppercase text-[var(--faint)]"
            >
              {d}
            </span>
          ))}
          {calendarDays.map((d) => (
            <button
              key={d.day}
              type="button"
              disabled={d.future}
              aria-label={`September ${d.day}${d.written ? ", has an entry" : ""}${d.bookmarked ? ", bookmarked" : ""}`}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-xs",
                d.future
                  ? "border-transparent text-[var(--faint)]/50"
                  : d.written
                    ? "border-[var(--line)] bg-[var(--sage)] font-semibold text-[var(--green)]"
                    : "border-[var(--line)] bg-[var(--canvas)] text-[var(--muted)]"
              )}
            >
              {d.day}
              {d.bookmarked ? (
                <Heart className="absolute bottom-1 size-2 fill-current text-[var(--terracotta)]" />
              ) : d.written ? (
                <span className="absolute bottom-1.5 size-1 rounded-full bg-[var(--green)]" />
              ) : null}
            </button>
          ))}
        </div>
        <p className="mt-3 border-t border-[var(--line)] pt-2.5 text-[0.66rem] text-[var(--faint)]">
          Filled = written · dot = entry · heart = bookmarked. Tap any day to
          open it.
        </p>
      </Card>
    </div>
  );
}

function MapView() {
  return (
    <div className="space-y-4">
      <SearchAndFilters />
      <Card className="overflow-hidden p-0">
        <div className="relative h-72 bg-[var(--canvas-deep)]">
          <MediaPlaceholder
            className="absolute inset-0"
            icon={
              <span className="font-mono text-[0.62rem] uppercase tracking-wider text-[var(--muted)]">
                world map
              </span>
            }
          />
          {mapPins.map((p) => (
            <button
              key={p.label}
              type="button"
              aria-label={`${p.label}, ${p.count} days`}
              className="absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--green)] font-mono text-[0.62rem] font-bold text-[var(--paper)] shadow-md"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              {p.count}
            </button>
          ))}
        </div>
        <p className="px-4 py-2.5 text-[0.66rem] text-[var(--faint)]">
          Pins cluster as you zoom out. Tap a cluster to filter the feed to
          those days.
        </p>
      </Card>
    </div>
  );
}

function GalleryView() {
  return (
    <div className="space-y-4">
      <SearchAndFilters />
      {galleryMonths.map((m) => (
        <div key={m.month}>
          <MonoLabel>{m.month}</MonoLabel>
          <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {m.items.map((it) => (
              <button
                key={it.id}
                type="button"
                className="relative aspect-square overflow-hidden rounded-lg"
                aria-label={it.kind === "video" ? "Open video" : "Open photo"}
              >
                <MediaPlaceholder
                  className="size-full"
                  tone={it.tone}
                  icon={
                    it.kind === "video" ? (
                      <Play className="size-4 fill-current opacity-70" />
                    ) : (
                      <ImageIcon className="size-4 opacity-50" />
                    )
                  }
                />
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[0.66rem] text-[var(--faint)]">
        Every photo and video you've captured, by month — the one view the app
        didn't have before.
      </p>
    </div>
  );
}

export function JournalTab() {
  const [mode, setMode] = useState<RecordViewMode>("Feed");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <MonoLabel>Your record · 184 entries</MonoLabel>
          <h1 className="mt-1.5 font-display text-[clamp(1.9rem,4vw,2.5rem)] leading-[1] tracking-[-0.03em] text-[var(--ink)]">
            Journal
          </h1>
        </div>
        <ViewModeTabs mode={mode} onChange={setMode} />
      </div>
      {mode === "Feed" ? <FeedView /> : null}
      {mode === "Calendar" ? <CalendarView /> : null}
      {mode === "Map" ? <MapView /> : null}
      {mode === "Gallery" ? <GalleryView /> : null}
    </div>
  );
}
