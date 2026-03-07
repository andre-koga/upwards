import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Heart } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
                className="absolute bottom-0 left-1/2 -translate-x-1/2 fill-red-500 text-red-500 opacity-90 pointer-events-none"
                style={{ width: 10, height: 10 }}
              />
            ) : hasEntry ? (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-current opacity-50 pointer-events-none" />
            ) : null}
          </CalendarDayButton>
        );
      },
    }),
    [entryDates, bookmarkedDates],
  );

  return (
    <div className="flex items-center gap-0.5 bg-background border border-border rounded-full shadow-lg px-1 py-1">
      <button
        onClick={() => changeDate(-1)}
        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1">
        <Popover open={datePopoverOpen} onOpenChange={handlePopoverOpen}>
          <PopoverTrigger asChild>
            <button className="font-semibold text-sm hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-accent">
              {currentDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[calc(100vw-2rem)] max-w-sm p-2 rounded-2xl overflow-hidden"
            align="center"
            sideOffset={16}
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
          </PopoverContent>
        </Popover>

        {!isToday && (
          <button
            onClick={() => onDateChange(new Date())}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors disabled:opacity-30"
        aria-label="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
