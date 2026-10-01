import { useState } from "react";
import {
  BookOpen,
  Command,
  Compass,
  FolderKanban,
  Leaf,
  type LucideIcon,
  MapPin,
  Palette,
  Search,
  Settings2,
  Sparkles,
  SunMedium,
  Timer,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { paletteGroups } from "./mock-data";
import { Card, CardHeader, Grain, MonoLabel, ShortcutChip } from "./shared";
import { flagshipStyle, glass, type TabId } from "./style";
import { HomeTab } from "./home-tab";
import { TodayTab, WeekWithActions } from "./today-tab";
import { JournalTab } from "./journal-tab";
import { YouTab } from "./you-tab";

// Flagship shell. Four primary destinations only (manifesto §3.2) — Memories
// merged into Journal, Timeline folded into Today. Everything secondary
// (projects, settings, sync, what's new) hangs off the profile menu and ⌘K so
// nothing shipped is invisible. Mobile-first: unprefixed classes are the phone,
// lg: adds the sidebar and the two-column content area.

const NAV: { id: TabId; label: string; icon: LucideIcon; key: string }[] = [
  { id: "Home", label: "Home", icon: Sparkles, key: "⌘1" },
  { id: "Today", label: "Today", icon: SunMedium, key: "⌘2" },
  { id: "Journal", label: "Journal", icon: BookOpen, key: "⌘3" },
  { id: "You", label: "You", icon: Compass, key: "⌘4" },
];

const SECONDARY = [
  { label: "Projects & groups", icon: FolderKanban, hint: "3 · archive" },
  { label: "Appearance", icon: Palette, hint: "System · Light · Dark" },
  { label: "Settings", icon: Settings2, hint: "Language, holidays, AI key" },
];

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--green)] text-[var(--paper)]">
        <Leaf className="size-4" strokeWidth={1.8} />
      </div>
      {!compact ? (
        <p className="font-display text-[1.2rem] tracking-[-0.03em] text-[var(--ink)]">
          upwards
        </p>
      ) : null}
    </div>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const icons: Record<string, LucideIcon> = {
    entry: BookOpen,
    activity: Timer,
    place: MapPin,
    setting: Settings2,
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 p-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Search everything"
    >
      <div
        className={cn(
          "relative w-full max-w-lg overflow-hidden rounded-2xl",
          glass
        )}
      >
        <Grain />
        <div className="relative flex items-center gap-2.5 border-b border-white/40 px-4 py-3">
          <Search className="size-4 shrink-0 text-[var(--muted)]" />
          <span className="flex-1 text-sm text-[var(--faint)]">
            Search entries, activities, places, settings…
          </span>
          <Button
            type="button"
            variant="bare"
            size="iconRoundSm"
            onClick={onClose}
            className="text-[var(--muted)]"
            aria-label="Close search"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="relative max-h-[50vh] overflow-y-auto p-2">
          {paletteGroups.map((g) => (
            <div key={g.label} className="mb-1.5">
              <p className="px-2 py-1">
                <MonoLabel>{g.label}</MonoLabel>
              </p>
              {g.items.map((it) => {
                const Icon = icons[it.icon] ?? BookOpen;
                return (
                  <button
                    key={it.title}
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[var(--paper)]"
                  >
                    <Icon className="size-3.5 shrink-0 text-[var(--muted)]" />
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
                      {it.title}
                    </span>
                    <span className="shrink-0 font-mono text-[0.62rem] text-[var(--faint)]">
                      {it.meta}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="relative border-t border-white/40 px-4 py-2 font-mono text-[0.6rem] text-[var(--faint)]">
          One search across everything — entries, memories, activities,
          sessions, places, settings.
        </p>
      </div>
    </div>
  );
}

function Sidebar({
  active,
  onChange,
  onOpenPalette,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  onOpenPalette: () => void;
}) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--line)] bg-[#f9f6ef] lg:block">
      <div className="sticky top-0 flex h-screen flex-col p-5">
        <Wordmark />
        <nav className="mt-9 space-y-0.5" aria-label="Primary navigation">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active;
            return (
              <Button
                key={item.id}
                type="button"
                variant="bare"
                onClick={() => onChange(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "h-10 w-full justify-start gap-2.5 rounded-lg px-2.5 text-sm",
                  isActive
                    ? "bg-[var(--sage)] font-semibold text-[var(--green)]"
                    : "text-[var(--muted)] hover:bg-[#efe9dd] hover:text-[var(--ink)]"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                <ShortcutChip>{item.key}</ShortcutChip>
              </Button>
            );
          })}
        </nav>

        <div className="mt-7">
          <p className="px-2.5">
            <MonoLabel>Manage</MonoLabel>
          </p>
          <div className="mt-2 space-y-0.5">
            {SECONDARY.map((s) => {
              const Icon = s.icon;
              return (
                <Button
                  key={s.label}
                  type="button"
                  variant="bare"
                  className="h-9 w-full justify-start gap-2.5 rounded-lg px-2.5 text-xs text-[var(--muted)] hover:bg-[#efe9dd] hover:text-[var(--ink)]"
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="flex-1 truncate text-left">{s.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto space-y-2">
          <Button
            type="button"
            variant="bare"
            onClick={onOpenPalette}
            className="h-9 w-full justify-start gap-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2.5 text-xs text-[var(--muted)]"
          >
            <Command className="size-3.5" />
            Search everything
            <ShortcutChip>⌘K</ShortcutChip>
          </Button>
          <div className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-[var(--green)] text-[0.68rem] font-bold text-[var(--paper)]">
              AM
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--ink)]">
                Alex Morgan
              </p>
              <p className="flex items-center gap-1 truncate text-[0.62rem] text-[var(--muted)]">
                <span className="size-1.5 rounded-full bg-[#789b7f]" />
                Synced just now
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MobileTopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center justify-between gap-2 px-4 py-2.5 lg:hidden",
        glass
      )}
    >
      <Grain />
      <div className="relative">
        <Wordmark compact />
      </div>
      <button
        type="button"
        onClick={onOpenPalette}
        className="relative flex flex-1 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--paper)]/60 px-3 py-1.5 text-left"
      >
        <Search className="size-3.5 shrink-0 text-[var(--faint)]" />
        <span className="truncate text-xs text-[var(--faint)]">
          Search everything
        </span>
      </button>
      <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--green)] text-[0.68rem] font-bold text-[var(--paper)]">
        AM
      </div>
    </header>
  );
}

function MobileNav({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
}) {
  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        "fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-[1.4rem] p-1.5 lg:hidden",
        glass
      )}
    >
      <Grain />
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === active;
        return (
          <Button
            key={item.id}
            type="button"
            variant="bare"
            onClick={() => onChange(item.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative h-12 min-w-16 flex-col gap-1 rounded-xl px-3 text-[0.62rem]",
              isActive
                ? "bg-[var(--sage)] font-bold text-[var(--green)]"
                : "text-[var(--muted)]"
            )}
          >
            <Icon className="size-[1.1rem]" />
            {item.label}
          </Button>
        );
      })}
    </nav>
  );
}

/** Desktop-only context rail — the narrow second column (manifesto §6). */
function ContextRail({ tab }: { tab: TabId }) {
  return (
    <aside className="hidden w-80 shrink-0 space-y-4 xl:block">
      {tab === "Today" || tab === "Home" ? <WeekWithActions /> : null}

      <Card flush>
        <CardHeader label="Your spaces">
          <Button
            type="button"
            variant="bare"
            size="iconRoundSm"
            className="text-[var(--faint)]"
            aria-label="Manage spaces"
          >
            <Settings2 className="size-3.5" />
          </Button>
        </CardHeader>
        {[
          { label: "Studio refresh", count: "4 open", color: "#c36e52" },
          { label: "Personal", count: "2 open", color: "#789b7f" },
          { label: "Wellbeing", count: "1 open", color: "#d5a94a" },
        ].map((s) => (
          <button
            key={s.label}
            type="button"
            className="flex w-full items-center gap-2.5 border-b border-[var(--line)] px-4 py-2.5 text-left last:border-b-0 hover:bg-[var(--canvas)]"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span className="flex-1 truncate text-sm text-[var(--ink)]">
              {s.label}
            </span>
            <span className="shrink-0 font-mono text-[0.66rem] text-[var(--muted)]">
              {s.count}
            </span>
          </button>
        ))}
        <p className="px-4 py-2 text-[0.66rem] text-[var(--faint)]">
          Archived groups and activities restore from here.
        </p>
      </Card>

      <Card>
        <MonoLabel>Day window</MonoLabel>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <Timer className="size-3.5 shrink-0" />
          New day at midnight · in 5h 18m
        </p>
        <p className="mt-2 text-[0.66rem] leading-5 text-[var(--faint)]">
          Every day stays editable. Changes to days older than a week ask
          first, and earlier versions of an entry stay restorable.
        </p>
      </Card>
    </aside>
  );
}

export default function RedesignFlagshipPage() {
  const [tab, setTab] = useState<TabId>("Home");
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <div
      className="min-h-screen bg-[var(--canvas)] font-sans text-[var(--ink)]"
      style={flagshipStyle}
    >
      <div className="flex min-h-screen">
        <Sidebar
          active={tab}
          onChange={setTab}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <div className="min-w-0 flex-1">
          <MobileTopBar onOpenPalette={() => setPaletteOpen(true)} />
          <div className="mx-auto flex max-w-[1180px] gap-6 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
            <main className="min-w-0 flex-1">
              {tab === "Home" ? (
                <HomeTab onOpenCompass={() => setTab("You")} />
              ) : null}
              {tab === "Today" ? <TodayTab /> : null}
              {tab === "Journal" ? <JournalTab /> : null}
              {tab === "You" ? <YouTab /> : null}
            </main>
            <ContextRail tab={tab} />
          </div>
        </div>
      </div>
      <MobileNav active={tab} onChange={setTab} />
      {paletteOpen ? (
        <CommandPalette onClose={() => setPaletteOpen(false)} />
      ) : null}
    </div>
  );
}
