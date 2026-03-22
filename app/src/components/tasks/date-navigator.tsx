/**
 * SRP: Compact prev/next day controls with a control that opens the journal date calendar dialog.
 */
import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { toDateStr } from "@/lib/db";
import { JournalDateCalendarDialog } from "@/components/tasks/journal-date-calendar-dialog";

interface DateNavigatorProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  entryDates?: Set<string>;
  bookmarkedDates?: Set<string>;
  onCalendarOpen?: () => void;
}

export default function DateNavigator({
  currentDate,
  onDateChange,
  entryDates = new Set(),
  bookmarkedDates = new Set(),
  onCalendarOpen,
}: DateNavigatorProps) {
  const today = new Date();
  const isToday = toDateStr(currentDate) === toDateStr(today);
  const isCurrentYear = currentDate.getFullYear() === today.getFullYear();
  const dateLabel = isCurrentYear
    ? currentDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : currentDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const changeDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    onDateChange(newDate);
  };

  return (
    <div className="flex h-12 items-center gap-1 rounded-full border border-border bg-background px-1 py-1 shadow-lg">
      <button
        onClick={() => changeDate(-1)}
        className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-1.5">
        <button
          className="whitespace-nowrap rounded-md px-3 py-1.5 text-base font-semibold transition-colors hover:bg-accent hover:text-primary"
          onClick={() => setDatePopoverOpen(true)}
        >
          {dateLabel}
        </button>

        <JournalDateCalendarDialog
          open={datePopoverOpen}
          onOpenChange={setDatePopoverOpen}
          currentDate={currentDate}
          onSelectDate={onDateChange}
          entryDates={entryDates}
          bookmarkedDates={bookmarkedDates}
          onCalendarOpen={onCalendarOpen}
        />

        {!isToday && (
          <button
            onClick={() => onDateChange(new Date())}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Go to today"
            title="Go to today"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>

      <button
        onClick={() => changeDate(1)}
        disabled={isToday}
        className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent disabled:opacity-30"
        aria-label="Next day"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
