import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { formatDateWithOptionalYear, toDateString } from "@/lib/time-utils";
import { Button } from "@/components/ui/button";
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
  const isToday = toDateString(currentDate) === toDateString(today);
  const dateLabel = formatDateWithOptionalYear(currentDate, today);

  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const changeDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    onDateChange(newDate);
  };

  return (
    <div className="flex h-12 items-center gap-1 rounded-full border border-border bg-background px-1 py-1 shadow-lg">
      <Button
        type="button"
        variant="ghost"
        size="iconRoundLg"
        onClick={() => changeDate(-1)}
        aria-label="Previous day"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          className="h-auto whitespace-nowrap rounded-md px-3 py-1.5 text-base font-semibold hover:text-primary"
          onClick={() => setDatePopoverOpen(true)}
        >
          {dateLabel}
        </Button>

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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onDateChange(new Date())}
            className="text-muted-foreground"
            aria-label="Go to today"
            title="Go to today"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="iconRoundLg"
        onClick={() => changeDate(1)}
        disabled={isToday}
        className="disabled:opacity-30"
        aria-label="Next day"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
