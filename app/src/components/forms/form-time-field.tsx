import { useMemo, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  dialogFieldLabelClassName,
  dialogSelectTriggerClassName,
} from "@/components/forms/styles";

const HOURS_12 = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0")
);
const MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0")
);
const SECONDS = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0")
);
const MERIDIEMS = ["AM", "PM"] as const;
type Meridiem = (typeof MERIDIEMS)[number];

function normalizeSegment(
  segment: string | undefined,
  upperBound: number
): string {
  const value = Number.parseInt(segment ?? "", 10);
  if (!Number.isFinite(value) || value < 0 || value > upperBound) {
    return "00";
  }
  return String(value).padStart(2, "0");
}

function splitTime(value: string): [string, string, string] {
  const [hour, minute, second] = value.split(":");
  return [
    normalizeSegment(hour, 23),
    normalizeSegment(minute, 59),
    normalizeSegment(second, 59),
  ];
}

function toTwelveHourDisplay(hours24: string): {
  hour12: string;
  meridiem: Meridiem;
} {
  const hourValue = Number.parseInt(hours24, 10);
  if (!Number.isFinite(hourValue)) {
    return { hour12: "12", meridiem: "AM" };
  }

  const meridiem: Meridiem = hourValue >= 12 ? "PM" : "AM";
  const normalized = hourValue % 12;
  return {
    hour12: String(normalized === 0 ? 12 : normalized).padStart(2, "0"),
    meridiem,
  };
}

function toTwentyFourHour(hour12: string, meridiem: Meridiem): string {
  const parsedHour12 = Number.parseInt(hour12, 10);
  const safeHour12 =
    Number.isFinite(parsedHour12) && parsedHour12 >= 1 && parsedHour12 <= 12
      ? parsedHour12
      : 12;

  if (meridiem === "AM") {
    return String(safeHour12 % 12).padStart(2, "0");
  }

  return String((safeHour12 % 12) + 12).padStart(2, "0");
}

interface FormTimeFieldProps {
  id: string;
  label: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  containerClassName?: string;
  labelClassName?: string;
  triggerClassName?: string;
  message?: ReactNode;
  messageClassName?: string;
}

export function FormTimeField({
  id,
  label,
  value,
  onValueChange,
  disabled = false,
  containerClassName,
  labelClassName,
  triggerClassName,
  message,
  messageClassName,
}: FormTimeFieldProps) {
  const [hours24, minutes, seconds] = useMemo(() => splitTime(value), [value]);
  const { hour12, meridiem } = useMemo(
    () => toTwelveHourDisplay(hours24),
    [hours24]
  );

  const update = (
    next: Partial<{
      hour12: string;
      minutes: string;
      seconds: string;
      meridiem: Meridiem;
    }>
  ) => {
    const nextHour12 = next.hour12 ?? hour12;
    const nextMinutes = next.minutes ?? minutes;
    const nextSeconds = next.seconds ?? seconds;
    const nextMeridiem = next.meridiem ?? meridiem;
    const nextHours24 = toTwentyFourHour(nextHour12, nextMeridiem);
    onValueChange(`${nextHours24}:${nextMinutes}:${nextSeconds}`);
  };

  return (
    <div className={cn("space-y-1", containerClassName)}>
      <Label
        htmlFor={`${id}-hour`}
        className={cn(dialogFieldLabelClassName, labelClassName)}
      >
        {label}
      </Label>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_4.25rem] items-center gap-1.5">
        <Select
          value={hour12}
          onValueChange={(nextHour12) => update({ hour12: nextHour12 })}
          disabled={disabled}
        >
          <SelectTrigger
            id={`${id}-hour`}
            className={cn(
              dialogSelectTriggerClassName,
              "px-2",
              triggerClassName
            )}
          >
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent>
            {HOURS_12.map((hour) => (
              <SelectItem key={hour} value={hour}>
                {hour}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={minutes}
          onValueChange={(nextMinutes) => update({ minutes: nextMinutes })}
          disabled={disabled}
        >
          <SelectTrigger
            id={`${id}-minute`}
            className={cn(
              dialogSelectTriggerClassName,
              "px-2",
              triggerClassName
            )}
          >
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent>
            {MINUTES.map((minute) => (
              <SelectItem key={minute} value={minute}>
                {minute}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={seconds}
          onValueChange={(nextSeconds) => update({ seconds: nextSeconds })}
          disabled={disabled}
        >
          <SelectTrigger
            id={`${id}-second`}
            className={cn(
              dialogSelectTriggerClassName,
              "px-2",
              triggerClassName
            )}
          >
            <SelectValue placeholder="SS" />
          </SelectTrigger>
          <SelectContent>
            {SECONDS.map((second) => (
              <SelectItem key={second} value={second}>
                {second}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={meridiem}
          onValueChange={(nextMeridiem) =>
            update({ meridiem: nextMeridiem as Meridiem })
          }
          disabled={disabled}
        >
          <SelectTrigger
            id={`${id}-meridiem`}
            className={cn(
              dialogSelectTriggerClassName,
              "min-w-[4.25rem] px-2",
              triggerClassName
            )}
          >
            <SelectValue placeholder="AM" />
          </SelectTrigger>
          <SelectContent>
            {MERIDIEMS.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {message ? (
        <p className={cn("text-xs text-muted-foreground", messageClassName)}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
