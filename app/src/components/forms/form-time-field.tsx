import { useMemo, useRef, useState, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormDialogActions } from "@/components/forms/form-dialog-actions";
import { cn } from "@/lib/utils";
import {
  dialogFieldLabelClassName,
  dialogFormControlButtonClassName,
} from "@/components/forms/styles";

type Meridiem = "AM" | "PM";
type TimeDialUnit = "hour" | "minute" | "second";
type TimeDraft = {
  hour12: string;
  minutes: string;
  seconds: string;
  meridiem: Meridiem;
};

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

function formatTimeDisplay({
  hour12,
  minutes,
  seconds,
  meridiem,
}: TimeDraft): string {
  return `${hour12}:${minutes}:${seconds} ${meridiem}`;
}

function polarPoint(center: number, radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

function clampToTwoDigit(value: number, max: number): string {
  const safe = Math.min(Math.max(value, 0), max);
  return String(safe).padStart(2, "0");
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
  const [open, setOpen] = useState(false);
  const [activeUnit, setActiveUnit] = useState<TimeDialUnit>("hour");
  const [draft, setDraft] = useState<TimeDraft>({
    hour12,
    minutes,
    seconds,
    meridiem,
  });
  const [dragging, setDragging] = useState(false);
  const dialRef = useRef<SVGSVGElement | null>(null);

  const updateFromDraft = (
    next: Partial<{
      hour12: string;
      minutes: string;
      seconds: string;
      meridiem: Meridiem;
    }>
  ) => {
    setDraft((prev) => ({
      hour12: next.hour12 ?? prev.hour12,
      minutes: next.minutes ?? prev.minutes,
      seconds: next.seconds ?? prev.seconds,
      meridiem: next.meridiem ?? prev.meridiem,
    }));
  };

  const currentDialValue = useMemo(() => {
    if (activeUnit === "hour") {
      return Number.parseInt(draft.hour12, 10) % 12;
    }
    if (activeUnit === "minute") {
      return Number.parseInt(draft.minutes, 10);
    }
    return Number.parseInt(draft.seconds, 10);
  }, [activeUnit, draft.hour12, draft.minutes, draft.seconds]);

  const handAngle = useMemo(() => {
    if (activeUnit === "hour") {
      return (Number.isFinite(currentDialValue) ? currentDialValue : 0) * 30;
    }
    return (Number.isFinite(currentDialValue) ? currentDialValue : 0) * 6;
  }, [activeUnit, currentDialValue]);

  const commitDraft = () => {
    const nextHours24 = toTwentyFourHour(draft.hour12, draft.meridiem);
    onValueChange(`${nextHours24}:${draft.minutes}:${draft.seconds}`);
    setOpen(false);
  };

  const advanceToNextUnit = () => {
    setActiveUnit((current) => {
      if (current === "hour") return "minute";
      if (current === "minute") return "second";
      return "second";
    });
  };

  const updateFromPointer = (clientX: number, clientY: number) => {
    const dial = dialRef.current;
    if (!dial) return;
    const rect = dial.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    let degrees = (Math.atan2(deltaY, deltaX) * 180) / Math.PI + 90;
    if (degrees < 0) degrees += 360;

    if (activeUnit === "hour") {
      const snapped = Math.round(degrees / 30) % 12;
      const hourValue = snapped === 0 ? 12 : snapped;
      updateFromDraft({ hour12: clampToTwoDigit(hourValue, 12) });
      return;
    }

    const snapped = Math.round(degrees / 6) % 60;
    const value = clampToTwoDigit(snapped, 59);
    if (activeUnit === "minute") {
      updateFromDraft({ minutes: value });
      return;
    }
    updateFromDraft({ seconds: value });
  };

  const center = 120;
  const radius = 92;
  const handLength = 62;
  const handEnd = polarPoint(center, handLength, handAngle);
  const handTip = polarPoint(center, radius, handAngle);

  return (
    <div className={cn("space-y-1", containerClassName)}>
      <Label
        htmlFor={`${id}-time`}
        className={cn(dialogFieldLabelClassName, labelClassName)}
      >
        {label}
      </Label>
      <Button
        id={`${id}-time`}
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setDraft({ hour12, minutes, seconds, meridiem });
          setActiveUnit("hour");
          setOpen(true);
        }}
        className={cn(
          dialogFormControlButtonClassName,
          "justify-between font-mono",
          triggerClassName
        )}
      >
        <span>{formatTimeDisplay({ hour12, minutes, seconds, meridiem })}</span>
      </Button>
      {message ? (
        <p className={cn("text-xs text-muted-foreground", messageClassName)}>
          {message}
        </p>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setDraft({ hour12, minutes, seconds, meridiem });
            setActiveUnit("hour");
          }
          setOpen(nextOpen);
          if (!nextOpen) setDragging(false);
        }}
      >
        <DialogContent
          size="sm"
          data-no-swipe
          overlayClassName="z-[85] bg-black/35 backdrop-blur-0"
          className="z-[90] rounded-2xl p-4"
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
          onTouchCancel={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              Drag the dial or tap values to edit time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="mx-auto w-full rounded-full bg-muted/35">
              <svg
                ref={dialRef}
                viewBox="0 0 240 240"
                data-no-swipe
                className="h-full w-full touch-none select-none"
                onPointerDown={(event) => {
                  setDragging(true);
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateFromPointer(event.clientX, event.clientY);
                }}
                onPointerMove={(event) => {
                  if (!dragging) return;
                  updateFromPointer(event.clientX, event.clientY);
                }}
                onPointerUp={(event) => {
                  setDragging(false);
                  advanceToNextUnit();
                  try {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  } catch {
                    /* ignore capture release errors */
                  }
                }}
                onPointerCancel={() => {
                  setDragging(false);
                }}
              >
                <circle
                  cx={center}
                  cy={center}
                  r={radius + 8}
                  fill="hsl(var(--card))"
                />
                {(activeUnit === "hour"
                  ? Array.from({ length: 12 }, (_, index) => index)
                  : Array.from({ length: 60 }, (_, index) => index)
                ).map((index) => {
                  const angle = activeUnit === "hour" ? index * 30 : index * 6;
                  const longTick = activeUnit === "hour" || index % 5 === 0;
                  const inner = polarPoint(
                    center,
                    longTick ? radius - 14 : radius - 10,
                    angle
                  );
                  const outer = polarPoint(center, radius, angle);
                  return (
                    <line
                      key={`tick-${activeUnit}-${index}`}
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                      stroke="hsl(var(--muted-foreground))"
                      strokeOpacity={longTick ? 0.65 : 0.3}
                      strokeWidth={longTick ? 2 : 1}
                    />
                  );
                })}
                {(activeUnit === "hour"
                  ? Array.from({ length: 12 }, (_, index) => index)
                  : Array.from({ length: 12 }, (_, index) => index * 5)
                ).map((valueLabel) => {
                  const angle =
                    activeUnit === "hour" ? valueLabel * 30 : valueLabel * 6;
                  const point = polarPoint(center, radius - 28, angle);
                  const label =
                    activeUnit === "hour"
                      ? String(valueLabel === 0 ? 12 : valueLabel)
                      : String(valueLabel).padStart(2, "0");
                  return (
                    <text
                      key={`label-${activeUnit}-${valueLabel}`}
                      x={point.x}
                      y={point.y + 4}
                      textAnchor="middle"
                      className="fill-foreground text-[11px] font-medium"
                    >
                      {label}
                    </text>
                  );
                })}
                <line
                  x1={center}
                  y1={center}
                  x2={handEnd.x}
                  y2={handEnd.y}
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                <circle
                  cx={handTip.x}
                  cy={handTip.y}
                  r={7}
                  fill="hsl(var(--primary))"
                />
                <circle
                  cx={center}
                  cy={center}
                  r={5}
                  fill="hsl(var(--primary))"
                />
              </svg>
            </div>

            <div className="grid grid-cols-4 gap-1.5 pt-2">
              <Button
                type="button"
                variant={activeUnit === "hour" ? "default" : "outline"}
                className="font-mono"
                onClick={() => setActiveUnit("hour")}
              >
                {draft.hour12}
              </Button>
              <Button
                type="button"
                variant={activeUnit === "minute" ? "default" : "outline"}
                className="font-mono"
                onClick={() => setActiveUnit("minute")}
              >
                {draft.minutes}
              </Button>
              <Button
                type="button"
                variant={activeUnit === "second" ? "default" : "outline"}
                className="font-mono"
                onClick={() => setActiveUnit("second")}
              >
                {draft.seconds}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="font-semibold"
                onClick={() =>
                  updateFromDraft({
                    meridiem: draft.meridiem === "AM" ? "PM" : "AM",
                  })
                }
              >
                {draft.meridiem}
              </Button>
            </div>

            <FormDialogActions
              onConfirm={commitDraft}
              secondaryAction={{
                label: "Cancel",
                onClick: () => setOpen(false),
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
