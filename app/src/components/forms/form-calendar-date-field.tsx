import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { FormControlButton } from "@/components/forms/form-control-button";
import { cn } from "@/lib/utils";
import {
  formatWeekdayShortDate,
  fromDateString,
  toDateString,
} from "@/lib/time-utils";
import { dialogFieldLabelClassName } from "@/components/forms/styles";

export interface FormCalendarDateFieldProps {
  id: string;
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  containerClassName?: string;
  labelClassName?: string;
  buttonClassName?: string;
  message?: ReactNode;
  messageClassName?: string;
}

export function FormCalendarDateField({
  id,
  label,
  value,
  onValueChange,
  min,
  max,
  disabled = false,
  readOnly = false,
  placeholder = "Select date",
  containerClassName,
  labelClassName,
  buttonClassName,
  message,
  messageClassName,
}: FormCalendarDateFieldProps) {
  const [open, setOpen] = useState(false);

  const selectedDate = useMemo(() => {
    if (!value) return undefined;
    return fromDateString(value);
  }, [value]);

  const [calendarMonth, setCalendarMonth] = useState<Date>(
    selectedDate ?? new Date()
  );

  useEffect(() => {
    if (open) {
      setCalendarMonth(selectedDate ?? new Date());
    }
  }, [open, selectedDate]);

  const minDate = useMemo(() => (min ? fromDateString(min) : undefined), [min]);
  const maxDate = useMemo(() => (max ? fromDateString(max) : undefined), [max]);

  const disabledMatcher = useMemo(() => {
    if (!minDate && !maxDate) return undefined;
    return {
      before: minDate,
      after: maxDate,
    };
  }, [minDate, maxDate]);

  const handleSelectDate = (date: Date | undefined) => {
    if (!date || readOnly || disabled) return;
    onValueChange(toDateString(date));
    setOpen(false);
  };

  const labelText = selectedDate
    ? formatWeekdayShortDate(selectedDate)
    : placeholder;

  return (
    <div className={cn("space-y-1", containerClassName)}>
      <Label
        htmlFor={id}
        className={cn(dialogFieldLabelClassName, labelClassName)}
      >
        {label}
      </Label>
      <FormControlButton
        id={id}
        disabled={disabled}
        aria-readonly={readOnly}
        onClick={() => {
          if (readOnly) return;
          setOpen(true);
        }}
        className={cn(
          "h-9 min-h-9 justify-between bg-muted/30 px-3 py-0 text-sm hover:bg-muted/40",
          readOnly && "cursor-default border-dashed bg-muted/30",
          buttonClassName
        )}
      >
        <span className="truncate">{labelText}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground opacity-50" />
      </FormControlButton>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (readOnly || disabled) {
            setOpen(false);
            return;
          }
          setOpen(nextOpen);
        }}
      >
        <DialogContent
          size="sm"
          className="w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl p-2"
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelectDate}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            disabled={disabledMatcher}
            captionLayout="dropdown"
            startMonth={minDate}
            endMonth={maxDate}
            fixedWeeks
            className="w-full [--cell-size:3rem]"
          />
        </DialogContent>
      </Dialog>

      {message ? (
        <p className={cn("text-xs text-muted-foreground", messageClassName)}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
