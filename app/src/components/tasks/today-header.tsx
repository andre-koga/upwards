import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { getActiveLocaleTag } from "@/lib/i18n";
import { toDateString, todayDateString } from "@/lib/time-utils";
import { JournalDateCalendarDialog } from "@/components/journal/journal-date-calendar-dialog";
import { Button } from "@/components/ui/button";

interface TodayHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  entryDates: Set<string>;
  bookmarkedDates: Set<string>;
  loadJournalMeta: () => Promise<void>;
}

/**
 * Today's top chrome: day navigation only, in a sticky frosted bar. Previous
 * and next are the button equivalent of the swipe. The page's actions live in
 * the bottom dock (`TodayQuickActions`), within thumb reach.
 */
export default function TodayHeader({
  currentDate,
  onDateChange,
  onPreviousDay,
  onNextDay,
  entryDates,
  bookmarkedDates,
  loadJournalMeta,
}: TodayHeaderProps) {
  const { t } = useTranslation("nav");
  const { t: tToday } = useTranslation("today");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const isSelectedToday = toDateString(currentDate) === todayDateString();
  const shortDate = currentDate.toLocaleDateString(getActiveLocaleTag(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const eyebrow = isSelectedToday
    ? t("tabs.today")
    : String(currentDate.getFullYear());

  return (
    <>
      <header className="sticky top-0 z-[var(--z-chrome)] border-b border-border bg-background/85 backdrop-blur-md">
        <div className="flex h-14 items-center gap-1 px-3 md:px-4">
          <Button
            type="button"
            variant="ghost"
            size="iconRoundLg"
            onClick={onPreviousDay}
            title={tToday("swipe.previousDay")}
            aria-label={tToday("swipe.previousDay")}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Button>

          <h1 className="min-w-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCalendarOpen(true)}
              className="h-11 min-w-0 flex-col items-start justify-center gap-0.5 rounded-xl px-2.5"
            >
              <span className="font-mono text-[0.64rem] uppercase leading-none tracking-[0.14em] text-ink-faint">
                {eyebrow}
              </span>
              <span className="flex items-center gap-1.5 font-display text-xl font-semibold leading-none tracking-[-0.02em]">
                <CalendarDays
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <span className="truncate">{shortDate}</span>
              </span>
              <span className="sr-only">. {t("pickDate")}</span>
            </Button>
          </h1>

          <Button
            type="button"
            variant="ghost"
            size="iconRoundLg"
            onClick={onNextDay}
            disabled={isSelectedToday}
            title={
              isSelectedToday
                ? tToday("swipe.alreadyToday")
                : tToday("swipe.nextDay")
            }
            aria-label={tToday("swipe.nextDay")}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      </header>

      <JournalDateCalendarDialog
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        currentDate={currentDate}
        onSelectDate={onDateChange}
        entryDates={entryDates}
        bookmarkedDates={bookmarkedDates}
        onCalendarOpen={loadJournalMeta}
      />
    </>
  );
}
