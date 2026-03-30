import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { Settings } from "lucide-react";
import { formatDateShort, toDateString } from "@/lib/time-utils";
import { JournalDateCalendarDialog } from "@/components/journal/journal-date-calendar-dialog";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface JournalDateHeaderCardProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  entryDates?: Set<string>;
  bookmarkedDates?: Set<string>;
  onCalendarOpen?: () => void;
}

export default function JournalDateHeaderCard({
  currentDate,
  onDateChange,
  entryDates = new Set(),
  bookmarkedDates = new Set(),
  onCalendarOpen,
}: JournalDateHeaderCardProps) {
  const navigate = useNavigate();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const today = new Date();
  const isSelectedToday = toDateString(currentDate) === toDateString(today);
  const shortDate = formatDateShort(currentDate);

  const openCalendar = () => setCalendarOpen(true);
  const openSettings = () => navigate("/settings");

  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("button")) return;
    openCalendar();
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCalendar();
    }
  };

  return (
    <>
      <div className="absolute z-10 flex w-full justify-between overflow-hidden bg-gradient-to-b from-black/50 to-transparent px-3 pb-4 pt-2">
        <div
          role="button"
          tabIndex={0}
          onClick={handleCardClick}
          onKeyDown={handleCardKeyDown}
          aria-label="Pick a date"
          className="flex flex-grow items-center gap-2"
        >
          <p className="font-crimson font-semibold text-foreground">
            {shortDate}
          </p>
          {isSelectedToday && (
            <span className="rounded-full border border-border bg-muted/40 px-2.5 pt-0.5 text-xs">
              Today
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="smIcon"
          onClick={(e) => {
            e.stopPropagation();
            openSettings();
          }}
          className="text-muted-foreground"
          aria-label="Open settings"
          title="Open settings"
        >
          <Settings />
        </Button>
      </div>

      <JournalDateCalendarDialog
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        currentDate={currentDate}
        onSelectDate={onDateChange}
        entryDates={entryDates}
        bookmarkedDates={bookmarkedDates}
        onCalendarOpen={onCalendarOpen}
      />
    </>
  );
}
