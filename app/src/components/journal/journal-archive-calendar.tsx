import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { JournalEntry } from "@/lib/db/types";
import JournalMarkedCalendar from "@/components/journal/journal-marked-calendar";
import { Button } from "@/components/ui/button";
import { rememberJournalJumpDate } from "@/lib/journal/archive";
import {
  formatWeekdayShortDate,
  fromDateString,
  toDateString,
  todayDateString,
} from "@/lib/time-utils";

interface JournalArchiveCalendarProps {
  /** The days the current search and filters leave in. */
  entries: readonly JournalEntry[];
  /** How a day is shown once picked: the same card the feed uses. */
  renderEntry: (entry: JournalEntry) => ReactNode;
}

/**
 * The Calendar view of the record: a month at a time, with a mark on every day
 * that has something written and a heart on hearted ones. Picking a day reads
 * it right here; a day with nothing offers to open it on Today.
 */
export default function JournalArchiveCalendar({
  entries,
  renderEntry,
}: JournalArchiveCalendarProps) {
  const { t } = useTranslation("journal");
  const navigate = useNavigate();
  const today = todayDateString();

  const byDate = useMemo(
    () => new Map(entries.map((entry) => [entry.entry_date, entry])),
    [entries]
  );
  const entryDates = useMemo(() => new Set(byDate.keys()), [byDate]);
  const bookmarkedDates = useMemo(
    () =>
      new Set(
        entries
          .filter((entry) => entry.is_bookmarked)
          .map((entry) => entry.entry_date)
      ),
    [entries]
  );
  const firstYear = useMemo(() => {
    let earliest = today;
    for (const date of entryDates) if (date < earliest) earliest = date;
    return Math.min(Number(earliest.slice(0, 4)), 2020);
  }, [entryDates, today]);

  // Open on the month of the newest day in view, so the first thing seen is
  // something written rather than an empty month.
  const [month, setMonth] = useState<Date>(() => {
    let newest: string | null = null;
    for (const date of entryDates) if (!newest || date > newest) newest = date;
    return fromDateString(newest ?? today);
  });
  const [selected, setSelected] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);

  // On a phone the picked day lands below the calendar, out of sight. Bring it
  // up once it has rendered, clear of the floating tab bar; reduced motion
  // gets a jump instead of a glide.
  useEffect(() => {
    if (!selected) return;
    detailRef.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [selected]);

  const selectedEntry = selected ? (byDate.get(selected) ?? null) : null;

  const openDay = (date: string) => {
    rememberJournalJumpDate(date);
    navigate("/");
  };

  return (
    <div className="space-y-4">
      <JournalMarkedCalendar
        entryDates={entryDates}
        bookmarkedDates={bookmarkedDates}
        mode="single"
        selected={selected ? fromDateString(selected) : undefined}
        onSelect={(date) => setSelected(date ? toDateString(date) : null)}
        month={month}
        onMonthChange={setMonth}
        disabled={{ after: fromDateString(today) }}
        captionLayout="dropdown"
        startMonth={new Date(firstYear, 0)}
        endMonth={fromDateString(today)}
        fixedWeeks
        className="w-full rounded-xl border border-border [--cell-size:2.75rem] md:[--cell-size:3.25rem]"
      />

      <div
        ref={detailRef}
        aria-live="polite"
        className="scroll-mb-[calc(var(--app-tab-bar-h,0px)+1rem)]"
      >
        {selected === null ? (
          <p className="px-1 text-sm text-muted-foreground">
            {t("archive.calendar.hint")}
          </p>
        ) : selectedEntry ? (
          renderEntry(selectedEntry)
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border p-3">
            <p className="text-sm text-muted-foreground">
              {t("archive.calendar.noEntry", {
                date: `${formatWeekdayShortDate(fromDateString(selected))} ${fromDateString(selected).getFullYear()}`,
              })}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 md:h-8"
              onClick={() => openDay(selected)}
            >
              {t("archive.calendar.openDay")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
