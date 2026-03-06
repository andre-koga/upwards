import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toDateStr } from "@/lib/db";

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

interface DateNavigatorProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
}

export default function DateNavigator({
  currentDate,
  onDateChange,
}: DateNavigatorProps) {
  const today = new Date();
  const isToday = toDateStr(currentDate) === toDateStr(today);

  const YEARS = Array.from(
    { length: today.getFullYear() - 2020 + 1 },
    (_, i) => 2020 + i,
  );

  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [popMonth, setPopMonth] = useState(currentDate.getMonth());
  const [popDay, setPopDay] = useState(currentDate.getDate());
  const [popYear, setPopYear] = useState(currentDate.getFullYear());

  const daysInPopMonth = (() => {
    const maxDay = new Date(popYear, popMonth + 1, 0).getDate();
    const isCurrentMonthYear =
      popYear === today.getFullYear() && popMonth === today.getMonth();
    return isCurrentMonthYear ? Math.min(maxDay, today.getDate()) : maxDay;
  })();

  const handlePopoverOpen = (open: boolean) => {
    if (open) {
      setPopMonth(currentDate.getMonth());
      setPopDay(currentDate.getDate());
      setPopYear(currentDate.getFullYear());
    }
    setDatePopoverOpen(open);
  };

  const applyDateSelection = () => {
    const clampedDay = Math.min(popDay, daysInPopMonth);
    onDateChange(new Date(popYear, popMonth, clampedDay));
    setDatePopoverOpen(false);
  };

  const changeDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    onDateChange(newDate);
  };

  return (
    <div className="flex items-center gap-1 bg-background border border-border rounded-full shadow-lg px-2 py-1.5">
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
          <PopoverContent className="w-64 p-4 space-y-3" align="center">
            <Select
              value={String(popMonth)}
              onValueChange={(v) => {
                const m = Number(v);
                setPopMonth(m);
                setPopDay((d) =>
                  Math.min(d, new Date(popYear, m + 1, 0).getDate()),
                );
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((name, i) => {
                  const disabled =
                    popYear === today.getFullYear() && i > today.getMonth();
                  return (
                    <SelectItem key={i} value={String(i)} disabled={disabled}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select
              value={String(popDay)}
              onValueChange={(v) => setPopDay(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: daysInPopMonth }, (_, i) => i + 1).map(
                  (d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>

            <Select
              value={String(popYear)}
              onValueChange={(v) => {
                const y = Number(v);
                setPopYear(y);
                setPopDay((d) =>
                  Math.min(d, new Date(y, popMonth + 1, 0).getDate()),
                );
              }}
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

            <Button className="w-full" onClick={applyDateSelection}>
              Go
            </Button>
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
