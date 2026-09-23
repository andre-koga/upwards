import { useState } from "react";
import {
  BookOpen,
  Compass,
  Image as ImageIcon,
  Leaf,
  Search,
  Sparkles,
  SunMedium,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShortcutChip } from "./shared";
import { flagshipStyle, type TabId } from "./style";
import { HomeTab } from "./home-tab";
import { TodayTab } from "./today-tab";
import { JournalTab } from "./journal-tab";
import { MemoriesTab } from "./memories-tab";
import { YouTab } from "./you-tab";

// Flagship mockup: one page, mobile-first, that carries the whole product
// premise — Today/Journal/Memories are where the data goes in and stays
// beautifully kept (the part every notes app already does); Home is where
// it gets read back against who you're trying to become (the actual
// differentiator); You is the new surface that gives the AI something to
// aim at. Mobile is the base layout (bottom tab bar, single column,
// touch-sized targets); md/lg layer in the sidebar, the command bar, and
// keyboard-shortcut chips — see docs/architecture/ui-system-and-responsive-
// layout.md on adaptive shell over "wider phone frame".

const NAV: { id: TabId; label: string; icon: LucideIcon; key: string }[] = [
  { id: "Home", label: "Home", icon: Sparkles, key: "⌘1" },
  { id: "Today", label: "Today", icon: SunMedium, key: "⌘2" },
  { id: "Journal", label: "Journal", icon: BookOpen, key: "⌘3" },
  { id: "Memories", label: "Memories", icon: ImageIcon, key: "⌘4" },
  { id: "You", label: "You", icon: Compass, key: "⌘5" },
];

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-xl bg-[var(--green)] text-[var(--paper)]">
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

function Sidebar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--line)] bg-[#f9f6ef] lg:block">
      <div className="sticky top-0 flex h-screen flex-col p-5">
        <Wordmark />
        <nav className="mt-10 space-y-0.5" aria-label="Primary navigation">
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
        <div className="mt-auto rounded-2xl bg-[#efe6d5] p-4">
          <Leaf className="size-4 text-[var(--terracotta)]" />
          <p className="mt-3 font-display text-base leading-tight text-[#4d5b52]">
            Make a little room for the good stuff.
          </p>
        </div>
      </div>
    </aside>
  );
}

function DesktopTopBar() {
  return (
    <header className="hidden items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--paper)]/90 px-8 py-3 backdrop-blur-sm lg:flex">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
        <span className="size-1.5 rounded-full bg-[#789b7f]" />
        Synced just now
      </div>
      <div className="flex max-w-sm flex-1 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-1.5 text-sm text-[var(--muted)]">
        <Search className="size-3.5" />
        Jump to, or ask about, anything…
        <ShortcutChip>⌘K</ShortcutChip>
      </div>
      <div className="flex size-8 items-center justify-center rounded-full bg-[var(--green)] text-xs font-bold text-[var(--paper)]">
        AM
      </div>
    </header>
  );
}

function MobileTopBar() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper)]/95 px-4 py-3 backdrop-blur-sm lg:hidden">
      <Wordmark compact />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="bare"
          size="icon"
          className="text-[var(--muted)] hover:bg-[var(--sage)] hover:text-[var(--ink)]"
          aria-label="Search"
        >
          <Search className="size-[1.05rem]" />
        </Button>
        <div className="flex size-8 items-center justify-center rounded-full bg-[var(--green)] text-xs font-bold text-[var(--paper)]">
          AM
        </div>
      </div>
    </header>
  );
}

function MobileNav({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-[1.4rem] border border-[var(--line)] bg-[var(--paper)]/95 p-1.5 shadow-[0_12px_30px_rgba(92,77,58,0.16)] backdrop-blur-md lg:hidden"
    >
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
              "h-12 min-w-14 flex-col gap-1 rounded-xl px-2 text-[0.6rem]",
              isActive
                ? "bg-[var(--sage)] font-bold text-[var(--green)]"
                : "text-[var(--faint)]"
            )}
          >
            <Icon className="size-[1.05rem]" />
            {item.label}
          </Button>
        );
      })}
    </nav>
  );
}

export default function RedesignFlagshipPage() {
  const [tab, setTab] = useState<TabId>("Home");

  return (
    <div
      className="min-h-screen bg-[var(--canvas)] font-sans text-[var(--ink)]"
      style={flagshipStyle}
    >
      <div className="flex min-h-screen">
        <Sidebar active={tab} onChange={setTab} />
        <div className="min-w-0 flex-1">
          <DesktopTopBar />
          <MobileTopBar />
          <main className="mx-auto max-w-2xl px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
            {tab === "Home" ? (
              <HomeTab onOpenCompass={() => setTab("You")} />
            ) : null}
            {tab === "Today" ? <TodayTab /> : null}
            {tab === "Journal" ? <JournalTab /> : null}
            {tab === "Memories" ? <MemoriesTab /> : null}
            {tab === "You" ? <YouTab /> : null}
          </main>
        </div>
      </div>
      <MobileNav active={tab} onChange={setTab} />
    </div>
  );
}
