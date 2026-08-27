import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { useTranslation } from "react-i18next";
import type { DateRange } from "react-day-picker";
import { Heart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  createCustomDateRange,
  createLastNDaysDateRange,
  createThisMonthDateRange,
  createYearDateRange,
  type JournalArchiveDateRange,
} from "@/lib/journal/archive";
import { fromDateString, toDateString } from "@/lib/time-utils";
import { getEffectiveToday } from "@/lib/session/day-reset";
import { cn } from "@/lib/utils";

export interface JournalArchiveDateFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: JournalArchiveDateRange | null;
  onApply: (range: JournalArchiveDateRange | null) => void;
  availableYears: number[];
  entryDates?: Set<string>;
  bookmarkedDates?: Set<string>;
}

/**
 * Year pills + presets + custom range calendar for archive date filtering.
 */
export default function JournalArchiveDateFilterDialog({
  open,
  onOpenChange,
  value,
  onApply,
  availableYears,
  entryDates = new Set(),
  bookmarkedDates = new Set(),
}: JournalArchiveDateFilterDialogProps) {
  const { t } = useTranslation("journal");
  const today = getEffectiveToday();
  const todayDate = fromDateString(today);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const [calendarMonth, setCalendarMonth] = useState(() =>
    fromDateString(getEffectiveToday())
  );
  const prevOpenRef = useRef(false);

  // Reset the draft range to the committed value each time the dialog opens.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (value) {
        setDraftRange({
          from: fromDateString(value.start),
          to: fromDateString(value.end),
        });
        setCalendarMonth(fromDateString(value.end));
      } else {
        setDraftRange(undefined);
        setCalendarMonth(fromDateString(today));
      }
    }
    prevOpenRef.current = open;
  }, [open, today, value]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const earliestYear = availableYears[availableYears.length - 1] ?? todayDate.getFullYear();
  const startMonth = new Date(earliestYear, 0, 1);

  const calendarComponents = useMemo(
    () => ({
      DayButton: ({
        day,
        modifiers,
        className,
        ...props
      }: ComponentProps<typeof CalendarDayButton>) => {
        const dateStr = toDateString(day.date);
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
                className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 fill-red-600 text-red-600"
                style={{ width: 10, height: 10 }}
              />
            ) : hasEntry ? (
              <span className="pointer-events-none absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-muted-foreground" />
            ) : null}
          </CalendarDayButton>
        );
      },
    }),
    [bookmarkedDates, entryDates]
  );

  const applyRange = (range: JournalArchiveDateRange) => {
    onApply(range);
    onOpenChange(false);
  };

  const handlePreset = (preset: "thisMonth" | "last30" | "last90") => {
    if (preset === "thisMonth") {
      applyRange(createThisMonthDateRange(today));
      return;
    }
    applyRange(createLastNDaysDateRange(today, preset === "last30" ? 30 : 90));
  };

  const handleYear = (year: number) => {
    applyRange(createYearDateRange(year, today));
  };

  const handleCustomSelect = (next: DateRange | undefined) => {
    setDraftRange(next);
    if (next?.from && next?.to) {
      applyRange(
        createCustomDateRange(toDateString(next.from), toDateString(next.to))
      );
    }
  };

  const canClear = Boolean(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        className="w-[calc(100vw-2rem)] max-w-sm gap-3 overflow-hidden rounded-2xl p-3"
      >
        <DialogHeader className="space-y-1 px-1 text-left">
          <DialogTitle className="font-crimson text-xl">
            {t("archive.filters.dates.title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("archive.filters.dates.description")}
          </DialogDescription>
        </DialogHeader>

        {availableYears.length > 0 ? (
          <div className="space-y-1.5 px-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("archive.filters.dates.years")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableYears.map((year) => {
                const selected =
                  value?.preset === "year" && value.year === year;
                return (
                  <Button
                    key={year}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleYear(year)}
                    className={cn(
                      "h-8 rounded-full px-3 text-xs font-medium shadow-none",
                      selected &&
                        "border-primary bg-primary/10 text-primary"
                    )}
                    aria-pressed={selected}
                  >
                    {year}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5 px-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("archive.filters.dates.presets")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["thisMonth", t("archive.filters.dates.thisMonth")],
                ["last30", t("archive.filters.dates.last30")],
                ["last90", t("archive.filters.dates.last90")],
              ] as const
            ).map(([preset, label]) => {
              const selected = value?.preset === preset;
              return (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreset(preset)}
                  className={cn(
                    "h-8 rounded-full px-3 text-xs font-medium shadow-none",
                    selected && "border-primary bg-primary/10 text-primary"
                  )}
                  aria-pressed={selected}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("archive.filters.dates.custom")}
          </p>
          <Calendar
            mode="range"
            selected={draftRange}
            onSelect={handleCustomSelect}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            disabled={{ after: todayDate }}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={todayDate}
            fixedWeeks
            className="w-full [--cell-size:2.5rem]"
            components={calendarComponents}
          />
          <p className="px-1 text-[11px] text-muted-foreground">
            {t("archive.filters.dates.customHint")}
          </p>
        </div>

        {canClear ? (
          <div className="flex justify-end px-1 pb-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                onApply(null);
                onOpenChange(false);
              }}
            >
              {t("archive.filters.dates.clear")}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
