import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Heart } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toDateStr } from "@/lib/db";

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

  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(currentDate);

  const handlePopoverOpen = (open: boolean) => {
    if (open) {
      setCalendarMonth(currentDate);
      onCalendarOpen?.();
    }
    setDatePopoverOpen(open);
  };

  const handleDaySelect = (date: Date | undefined) => {
    if (!date) return;
    onDateChange(date);
    setDatePopoverOpen(false);
  };

  const changeDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    onDateChange(newDate);
  };

  const calendarComponents = useMemo(
    () => ({
      DayButton: ({
        day,
        modifiers,
        className,
        ...props
      }: React.ComponentProps<typeof CalendarDayButton>) => {
        const d = day.date;
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const isBookmarked = bookmarkedDates.has(dateStr);
        const hasEntry = entryDates.has(dateStr);
        return (
          <CalendarDayButton
            day={day}
            modifiers={modifiers}
            className={cn("relative", className)}
            {...props}
          >
            {props.children}
            {isBookmarked ? (
              <Heart
                className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 fill-red-500 text-red-500 opacity-90"
                style={{ width: 10, height: 10 }}
              />
            ) : hasEntry ? (
              <span className="pointer-events-none absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-current opacity-50" />
            ) : null}
          </CalendarDayButton>
        );
      },
    }),
    [entryDates, bookmarkedDates]
  );

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-background px-1 py-1 shadow-lg">
      <button
        onClick={() => changeDate(-1)}
        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-accent"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1">
        <Dialog open={datePopoverOpen} onOpenChange={handlePopoverOpen}>
          <button
            className="rounded-md px-2 py-1 text-sm font-semibold transition-colors hover:bg-accent hover:text-primary"
            onClick={() => handlePopoverOpen(true)}
          >
            {currentDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </button>
          <DialogContent
            size="sm"
            className="w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl p-2"
          >
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={handleDaySelect}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              disabled={{ after: today }}
              captionLayout="dropdown"
              startMonth={new Date(2020, 0)}
              endMonth={today}
              fixedWeeks
              className="w-full [--cell-size:3rem]"
              components={calendarComponents}
            />
          </DialogContent>
        </Dialog>

        {!isToday && (
          <button
            onClick={() => onDateChange(new Date())}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Go to today"
            title="Go to today"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <button
        onClick={() => changeDate(1)}
        disabled={isToday}
        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-accent disabled:opacity-30"
        aria-label="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
