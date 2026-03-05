"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RotateCcw,
} from "lucide-react";
import { Tables } from "@/lib/supabase/types";
import { type CalendarMonth, useDayPicker } from "react-day-picker";

type JournalEntry = Tables<"journal_entries">;

interface JournalCalendarProps {
  entries: JournalEntry[];
}

const QUALITY_COLORS: Record<number, string> = {
  1: "bg-red-400",
  2: "bg-orange-400",
  3: "bg-yellow-400",
  4: "bg-green-400",
  5: "bg-blue-400",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const YEARS = Array.from(
  { length: 10 },
  (_, i) => new Date().getFullYear() - 5 + i,
);

function MonthYearCaption({
  calendarMonth,
  onMonthChange,
}: {
  calendarMonth: CalendarMonth;
  onMonthChange: (d: Date) => void;
}) {
  const { nextMonth, previousMonth, goToMonth } = useDayPicker();
  const [open, setOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    calendarMonth.date.getMonth(),
  );
  const [selectedYear, setSelectedYear] = useState(
    calendarMonth.date.getFullYear(),
  );

  const today = new Date();
  const isCurrentMonth =
    calendarMonth.date.getFullYear() === today.getFullYear() &&
    calendarMonth.date.getMonth() === today.getMonth();

  const handleApply = () => {
    const target = new Date(selectedYear, selectedMonth, 1);
    onMonthChange(target);
    goToMonth(target);
    setOpen(false);
  };

  return (
    <div className="flex items-center justify-between w-full px-1">
      {/* Prev button */}
      <button
        onClick={() => previousMonth && goToMonth(previousMonth)}
        disabled={!previousMonth}
        className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-30"
        aria-label="Previous month"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>

      {/* Clickable month/year label + today reset */}
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 font-semibold text-base hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-accent">
              {calendarMonth.date.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
              <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-4 space-y-3" align="center">
            <Select
              value={String(selectedMonth)}
              onValueChange={(v) => setSelectedMonth(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((name, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={handleApply}>
              Go
            </Button>
          </PopoverContent>
        </Popover>

        {/* Reset to today */}
        {!isCurrentMonth && (
          <button
            onClick={() => {
              const today = new Date();
              onMonthChange(today);
              goToMonth(today);
            }}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Go to today"
            title="Go to today"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Next button */}
      <button
        onClick={() => nextMonth && goToMonth(nextMonth)}
        disabled={!nextMonth}
        className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-30"
        aria-label="Next month"
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
}

export default function JournalCalendar({ entries }: JournalCalendarProps) {
  const router = useRouter();
  const [month, setMonth] = useState<Date>(new Date());

  const entryByDate = new Map(entries.map((e) => [e.entry_date, e]));

  const handleDayClick = (day: Date) => {
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, "0");
    const d = String(day.getDate()).padStart(2, "0");
    router.push(`/journal/${y}-${m}-${d}`);
  };

  return (
    <div className="flex flex-col items-center">
      <Calendar
        mode="single"
        month={month}
        onMonthChange={setMonth}
        className="w-full"
        classNames={{
          month_caption: "flex items-center w-full mb-1",
        }}
        components={{
          Nav: () => <></>,
          MonthCaption: ({ calendarMonth }) => (
            <MonthYearCaption
              calendarMonth={calendarMonth}
              onMonthChange={setMonth}
            />
          ),
          DayButton: ({ day, modifiers, ...buttonProps }) => {
            const y = day.date.getFullYear();
            const m = String(day.date.getMonth() + 1).padStart(2, "0");
            const d = String(day.date.getDate()).padStart(2, "0");
            const ds = `${y}-${m}-${d}`;
            const entry = entryByDate.get(ds);
            const dotColor = entry?.day_quality
              ? QUALITY_COLORS[entry.day_quality]
              : null;

            return (
              <button
                {...buttonProps}
                onClick={() => handleDayClick(day.date)}
                className="w-full h-14 flex flex-col items-center justify-center gap-0.5 rounded-lg hover:bg-accent transition-colors"
              >
                <span className="text-sm leading-none">
                  {entry?.day_emoji || day.date.getDate()}
                </span>
                {dotColor && (
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                )}
              </button>
            );
          },
        }}
      />

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-muted-foreground flex-wrap justify-center">
        {Object.entries(QUALITY_COLORS).map(([q, color]) => {
          const labels: Record<string, string> = {
            "1": "Bad",
            "2": "Poor",
            "3": "Okay",
            "4": "Good",
            "5": "Great",
          };
          return (
            <div key={q} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              <span>{labels[q]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
