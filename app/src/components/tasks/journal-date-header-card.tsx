/**
 * SRP: Prominent selected-date display above the journal: opens calendar from the card or icon, shows location and day task/time summaries in prose.
 */
import { useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  CalendarDays,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  MapPin,
  MapPinOff,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { formatDurationProse } from "@/lib/activity-utils";
import { toDateStr } from "@/lib/db";
import type { LocationData } from "@/lib/db/types";
import {
  wmoCodeToVisual,
  type WeatherVisualKind,
} from "@/lib/open-meteo-weather";
import { cn } from "@/lib/utils";
import { JournalDateCalendarDialog } from "@/components/tasks/journal-date-calendar-dialog";
import type { JournalDayWeatherState } from "@/components/tasks/hooks/use-journal-day-weather";
import { useNavigate } from "react-router-dom";

function weatherIconFor(kind: WeatherVisualKind): LucideIcon {
  switch (kind) {
    case "clear":
      return Sun;
    case "partlyCloudy":
      return CloudSun;
    case "cloud":
      return Cloud;
    case "fog":
      return CloudFog;
    case "rain":
      return CloudRain;
    case "snow":
      return CloudSnow;
    case "storm":
      return CloudLightning;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

interface JournalDateHeaderCardProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  entryDates?: Set<string>;
  bookmarkedDates?: Set<string>;
  onCalendarOpen?: () => void;
  canEditJournal: boolean;
  isDetectingLocation: boolean;
  draftLocation: LocationData | null;
  loading: boolean;
  dailyActivitiesCount: number;
  isBreakDay: boolean;
  completedCount: number;
  nonNeverCount: number;
  totalTimeSpentMs: number;
  dayWeather: JournalDayWeatherState;
}

export default function JournalDateHeaderCard({
  currentDate,
  onDateChange,
  entryDates = new Set(),
  bookmarkedDates = new Set(),
  onCalendarOpen,
  canEditJournal,
  isDetectingLocation,
  draftLocation,
  loading,
  dailyActivitiesCount,
  isBreakDay,
  completedCount,
  nonNeverCount,
  totalTimeSpentMs,
  dayWeather,
}: JournalDateHeaderCardProps) {
  const navigate = useNavigate();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const today = new Date();
  const isSelectedToday = toDateStr(currentDate) === toDateStr(today);

  const monthYear = currentDate.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  const dayNum = currentDate.getDate();

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

  const tasksSummary = loading
    ? "…"
    : isBreakDay
      ? "Break day"
      : dailyActivitiesCount === 0
        ? "No tasks this day"
        : (() => {
            const total = nonNeverCount;
            const taskWord = total === 1 ? "task" : "tasks";
            return `${completedCount}/${total} ${taskWord} completed`;
          })();

  const timeSummary = loading
    ? "…"
    : (() => {
        const prose = formatDurationProse(totalTimeSpentMs);
        if (prose === "No time tracked") {
          return "No time tracked";
        }
        return `${prose} tracked`;
      })();

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-card to-muted/20 shadow-md sm:px-6",
          "ring-1 ring-border/40"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />

        <div
          role="button"
          tabIndex={0}
          onClick={handleCardClick}
          onKeyDown={handleCardKeyDown}
          aria-label="Pick a date"
          className="relative cursor-pointer rounded-lg outline-none transition-colors hover:bg-muted/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="flex items-center gap-5 text-left sm:gap-8">
            <div className="flex shrink-0 flex-col items-center bg-muted pb-8 pl-6 pr-5 pt-6">
              <p className="font-crimson text-6xl font-semibold tabular-nums leading-[0.95] text-foreground sm:text-6xl">
                {dayNum}
              </p>
              <p className="font-crimson leading-snug text-muted-foreground sm:text-base">
                {monthYear}
              </p>
              {isSelectedToday && (
                <span className="mt-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 text-[10px] font-medium tracking-wide text-primary">
                  Today
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-3 pt-2 sm:pt-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
                  {(canEditJournal && isDetectingLocation) || draftLocation ? (
                    <>
                      <MapPin className="h-3 w-3 shrink-0 opacity-80" />
                      <span className="font-crimson leading-snug">
                        {canEditJournal && isDetectingLocation
                          ? "Loading…"
                          : (draftLocation?.displayName ?? "—")}
                      </span>
                    </>
                  ) : (
                    <>
                      <MapPinOff className="h-3 w-3 shrink-0 opacity-70" />
                      <span className="font-crimson italic leading-snug opacity-90">
                        No location
                      </span>
                    </>
                  )}
                </div>
                {dayWeather.status !== "unavailable" && (
                  <div
                    className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"
                    title="Weather data by Open-Meteo"
                  >
                    {dayWeather.status === "loading" && (
                      <p className="flex items-center font-crimson leading-snug">
                        <Cloud className="h-3 w-3 shrink-0 animate-pulse opacity-80" />
                        <span className="ml-1">…</span>
                      </p>
                    )}
                    {dayWeather.status === "error" && (
                      <span className="font-crimson leading-snug">—</span>
                    )}
                    {dayWeather.status === "ok" &&
                      (() => {
                        const Icon = weatherIconFor(
                          wmoCodeToVisual(dayWeather.data.wmoCode)
                        );
                        return (
                          <p className="flex items-center font-crimson leading-snug">
                            <Icon className="h-3 w-3 shrink-0 opacity-80" />
                            <span className="ml-1">
                              {Math.round(dayWeather.data.temperatureF)}°F
                            </span>
                          </p>
                        );
                      })()}
                  </div>
                )}
              </div>

              <div className="pb-1 font-crimson text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                <p>{tasksSummary}</p>
                <p>{timeSummary}</p>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openSettings();
          }}
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-70"
          aria-label="Open settings"
          title="Open settings"
        >
          <Settings className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openCalendar();
          }}
          className="absolute bottom-3 right-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-70"
          aria-label="Pick a date"
          title="Pick a date"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
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
