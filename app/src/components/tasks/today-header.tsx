import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getActiveLocaleTag } from "@/lib/i18n";
import { toDateString, todayDateString } from "@/lib/time-utils";
import { cn } from "@/lib/utils";
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
  /** A session is running: the date control tightens and moves aside for it. */
  running?: boolean;
  /** The running-session card; fills the row beside the date control. */
  children?: ReactNode;
}

/**
 * Today's top chrome, one row: day navigation, and the running session when
 * there is one. With nothing running the date control sits centered; with a
 * session it tightens and moves to the start so the card gets the rest. Previous
 * and next are the button equivalent of the swipe. The page wraps this in one
 * sticky frosted container.
 */
export default function TodayHeader({
  currentDate,
  onDateChange,
  onPreviousDay,
  onNextDay,
  entryDates,
  bookmarkedDates,
  loadJournalMeta,
  running = false,
  children,
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
      <header>
        <div
          className={cn(
            "flex h-14 items-center gap-2 px-2 md:px-4",
            running ? "justify-start" : "justify-center"
          )}
        >
          <div className="flex shrink-0 items-center">
            <Button
              type="button"
              variant="ghost"
              size="iconRoundMd"
              onClick={onPreviousDay}
              title={tToday("swipe.previousDay")}
              aria-label={tToday("swipe.previousDay")}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </Button>

            <h1 className="flex min-w-0 items-center">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCalendarOpen(true)}
                className={cn(
                  "min-w-0 flex-col items-center justify-center rounded-xl px-2.5",
                  running ? "h-9 py-0" : "h-auto gap-1 py-2"
                )}
              >
                {running ? null : (
                  <span className="font-mono text-[0.6rem] uppercase leading-[1] tracking-[0.14em] text-ink-faint">
                    {eyebrow}
                  </span>
                )}
                <span
                  className={cn(
                    "font-display font-semibold tracking-[-0.02em]",
                    running ? "text-base leading-none" : "text-lg leading-[1.1]"
                  )}
                >
                  {shortDate}
                </span>
                <span className="sr-only">. {t("pickDate")}</span>
              </Button>
            </h1>

            <Button
              type="button"
              variant="ghost"
              size="iconRoundMd"
              onClick={onNextDay}
              disabled={isSelectedToday}
              className="disabled:border-transparent disabled:bg-transparent disabled:opacity-35"
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

          {children}
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
