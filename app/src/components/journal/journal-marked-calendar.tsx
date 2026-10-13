import { useMemo, type ComponentProps } from "react";
import { Heart } from "lucide-react";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toDateString } from "@/lib/time-utils";

type JournalMarkedCalendarProps = ComponentProps<typeof Calendar> & {
  /** Days that have something written: marked with a dot. */
  entryDates?: ReadonlySet<string>;
  /** Hearted days: marked with a heart instead. */
  bookmarkedDates?: ReadonlySet<string>;
};

const NO_DATES: ReadonlySet<string> = new Set();

/**
 * The shared calendar with the journal's day markers, so every place that
 * shows a month of the record marks it the same way.
 */
export default function JournalMarkedCalendar({
  entryDates = NO_DATES,
  bookmarkedDates = NO_DATES,
  components,
  ...props
}: JournalMarkedCalendarProps) {
  const markedComponents = useMemo(
    () => ({
      ...components,
      DayButton: ({
        day,
        modifiers,
        className,
        ...buttonProps
      }: ComponentProps<typeof CalendarDayButton>) => {
        const dateString = toDateString(day.date);
        const isBookmarked = bookmarkedDates.has(dateString);
        const hasEntry = entryDates.has(dateString);
        return (
          <CalendarDayButton
            day={day}
            modifiers={modifiers}
            className={cn("relative", className)}
            {...buttonProps}
          >
            {buttonProps.children}
            {isBookmarked ? (
              <Heart
                className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 fill-red-600 text-red-600"
                style={{ width: 10, height: 10 }}
                aria-hidden
              />
            ) : hasEntry ? (
              <span
                className="pointer-events-none absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-muted-foreground"
                aria-hidden
              />
            ) : null}
          </CalendarDayButton>
        );
      },
    }),
    [components, entryDates, bookmarkedDates]
  );

  return <Calendar components={markedComponents} {...props} />;
}
