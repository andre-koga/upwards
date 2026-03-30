import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { Heart } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toDateString } from "@/lib/time-utils";

export interface JournalDateCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  entryDates?: Set<string>;
  bookmarkedDates?: Set<string>;
  /** Called when the dialog opens (e.g. refresh journal meta for markers). */
  onCalendarOpen?: () => void;
}

export function JournalDateCalendarDialog({
  open,
  onOpenChange,
  currentDate,
  onSelectDate,
  entryDates = new Set(),
  bookmarkedDates = new Set(),
  onCalendarOpen,
}: JournalDateCalendarDialogProps) {
  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(currentDate);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setCalendarMonth(currentDate);
      onCalendarOpen?.();
    }
    prevOpenRef.current = open;
  }, [open, currentDate, onCalendarOpen]);

  const handleDaySelect = (date: Date | undefined) => {
    if (!date) return;
    onSelectDate(date);
    onOpenChange(false);
  };

  const calendarComponents = useMemo(
    () => ({
      DayButton: ({
        day,
        modifiers,
        className,
        ...props
      }: ComponentProps<typeof CalendarDayButton>) => {
        const d = day.date;
        const dateStr = toDateString(d);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
  );
}
