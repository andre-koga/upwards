import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import JournalMarkedCalendar from "@/components/journal/journal-marked-calendar";
import { fromDateString, todayDateString } from "@/lib/time-utils";

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
  const { t } = useTranslation("nav");
  const effectiveToday = fromDateString(todayDateString());
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        className="w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl p-2"
      >
        <DialogTitle className="sr-only">{t("pickDate")}</DialogTitle>
        <JournalMarkedCalendar
          entryDates={entryDates}
          bookmarkedDates={bookmarkedDates}
          mode="single"
          selected={currentDate}
          onSelect={handleDaySelect}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          disabled={{ after: effectiveToday }}
          captionLayout="dropdown"
          startMonth={new Date(2020, 0)}
          endMonth={effectiveToday}
          fixedWeeks
          className="w-full [--cell-size:3rem]"
        />
      </DialogContent>
    </Dialog>
  );
}
