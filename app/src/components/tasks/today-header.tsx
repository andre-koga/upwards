import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { getActiveLocaleTag } from "@/lib/i18n";
import {
  fromDateString,
  toDateString,
  todayDateString,
} from "@/lib/time-utils";
import { JournalDateCalendarDialog } from "@/components/journal/journal-date-calendar-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TodayHeaderProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  entryDates: Set<string>;
  bookmarkedDates: Set<string>;
  loadJournalMeta: () => Promise<void>;
  /** A session is running: the running card gets its own row under the date. */
  running?: boolean;
  /** The running-session card; a full-width row under the masthead. */
  children?: ReactNode;
}

/**
 * Today's top chrome. The date is a centred masthead (tap it for the
 * calendar), flanked by previous / next as the button equivalent of the
 * swipe, with a "Today" jump in the corner when looking at another day. While
 * a session runs, the masthead keeps its shape and the running card sits on
 * its own row beneath it.
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

  const locale = getActiveLocaleTag();
  const selected = toDateString(currentDate);
  const today = todayDateString();
  const isSelectedToday = selected === today;
  const yesterday = fromDateString(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = selected === toDateString(yesterday);

  const weekday = currentDate.toLocaleDateString(locale, { weekday: "long" });
  const longDate = currentDate.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    ...(currentDate.getFullYear() !== new Date().getFullYear()
      ? { year: "numeric" }
      : {}),
  });
  const eyebrow = isSelectedToday
    ? t("tabs.today")
    : isYesterday
      ? tToday("header.yesterday")
      : weekday;

  const prevButton = (
    <Button
      type="button"
      variant="ghost"
      size="iconRoundMd"
      onClick={onPreviousDay}
      className="text-muted-foreground"
      title={tToday("swipe.previousDay")}
      aria-label={tToday("swipe.previousDay")}
    >
      <ChevronLeft className="h-5 w-5" aria-hidden />
    </Button>
  );
  const nextButton = (
    <Button
      type="button"
      variant="ghost"
      size="iconRoundMd"
      onClick={onNextDay}
      disabled={isSelectedToday}
      className="text-muted-foreground disabled:bg-transparent disabled:opacity-30"
      title={
        isSelectedToday ? tToday("swipe.alreadyToday") : tToday("swipe.nextDay")
      }
      aria-label={tToday("swipe.nextDay")}
    >
      <ChevronRight className="h-5 w-5" aria-hidden />
    </Button>
  );

  return (
    <>
      {/* A page masthead: the date centred like the top of a diary page, with
          the day-step buttons flanking it and the jump back to today tucked in
          the far corner so nothing pulls the date off centre. */}
      <header
        className={cn(
          "relative flex flex-col justify-center gap-1 px-3",
          running ? "pb-4 pt-3" : "h-[6.25rem]"
        )}
      >
        <div className="flex h-6 items-center justify-center text-[0.8125rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </div>
        {!isSelectedToday ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDateChange(new Date(`${today}T12:00:00`))}
            className="absolute right-3 top-3 h-7 gap-0.5 whitespace-nowrap rounded-full bg-muted/70 px-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground"
            title={tToday("header.goToToday")}
            aria-label={tToday("header.goToToday")}
          >
            {t("tabs.today")}
            <ChevronsRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : null}
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-1">
          <div className="flex justify-start">{prevButton}</div>
          <h1 className="flex min-w-0 justify-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCalendarOpen(true)}
              className="h-auto min-w-0 max-w-full rounded-xl px-3 py-0.5"
            >
              <span className="truncate font-display text-[2.125rem] font-medium leading-[1.15] tracking-[-0.02em]">
                {longDate}
              </span>
              <span className="sr-only">. {t("pickDate")}</span>
            </Button>
          </h1>
          <div className="flex justify-end">{nextButton}</div>
        </div>
        {running ? <div className="px-2 pt-3">{children}</div> : null}
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
