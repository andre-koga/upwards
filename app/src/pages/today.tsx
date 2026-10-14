import {
  useState,
  useRef,
  useEffect,
  type TouchEvent,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  toDateString,
  fromDateString,
  todayDateString,
} from "@/lib/time-utils";
import DailyTasksList from "@/components/tasks/daily-tasks-list";
import JournalCard from "@/components/journal/journal-card";
import TodayHeader from "@/components/tasks/today-header";
import TodayQuickActions from "@/components/tasks/today-quick-actions";
import { useTodayPage } from "@/hooks/use-today-page";
import { useDayResetTimer } from "@/hooks/use-day-reset-timer";
import { JOURNAL_JUMP_DATE_KEY } from "@/lib/journal/archive";

function consumeJournalJumpDate(): Date | null {
  try {
    const raw = sessionStorage.getItem(JOURNAL_JUMP_DATE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(JOURNAL_JUMP_DATE_KEY);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const date = fromDateString(raw);
    if (Number.isNaN(date.getTime()) || toDateString(date) !== raw) return null;
    return date;
  } catch {
    return null;
  }
}

export default function TodayPage() {
  const { t } = useTranslation("today");
  const SWIPE_MIN_DISTANCE_PX = 70;
  const SWIPE_DIRECTION_RATIO = 1.35;
  const SWIPE_FEEDBACK_START_PX = 12;
  const SWIPE_FEEDBACK_DIRECTION_RATIO = 1.1;

  const [currentDate, setCurrentDate] = useState(
    () => consumeJournalJumpDate() ?? new Date(`${todayDateString()}T12:00:00`)
  );
  const [swipeFeedback, setSwipeFeedback] = useState<{
    direction: "prev" | "next";
    progress: number;
    blocked: boolean;
  } | null>(null);
  const swipeStartRef = useRef<{
    x: number;
    y: number;
    canSwipe: boolean;
  } | null>(null);

  const [dayResetTick, setDayResetTick] = useState(0);

  // Re-render at midnight so the swipe "today" boundary updates live.
  const handleDayReset = useCallback(() => {
    setDayResetTick((t) => t + 1);
  }, []);
  useDayResetTimer(handleDayReset);

  const goToPreviousDay = useCallback(() => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 1);
      return next;
    });
  }, []);

  // Days stop at today: there is nothing to record tomorrow.
  const goToNextDay = useCallback(() => {
    setCurrentDate((prev) => {
      if (toDateString(prev) === todayDateString()) return prev;
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      return next;
    });
  }, []);

  // Arrow keys step through days, unless something else owns the keyboard.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.isComposing || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "input, textarea, select, [contenteditable='true'], [role='slider'], [role='tab'], [role='menu'], [role='listbox']"
        )
      ) {
        return;
      }
      if (
        document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
      ) {
        return;
      }
      if (event.key === "ArrowLeft") goToPreviousDay();
      else goToNextDay();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToPreviousDay, goToNextDay]);

  const {
    journal,
    entryDates,
    bookmarkedDates,
    loadJournalMeta,
    activities,
    lookupActivities,
    lookupGroups,
    loading,
    dailyTasks,
    refreshTasksData,
  } = useTodayPage(currentDate, dayResetTick);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  const isSwipeIgnoredTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "button, a, input, textarea, select, [role='button'], [role='link'], [contenteditable='true'], [data-no-swipe]"
      )
    );
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      swipeStartRef.current = null;
      setSwipeFeedback(null);
      return;
    }

    const touch = event.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      canSwipe: !isSwipeIgnoredTarget(event.target),
    };

    if (isSwipeIgnoredTarget(event.target)) {
      setSwipeFeedback(null);
    }
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    if (!start?.canSwipe || event.touches.length !== 1) {
      setSwipeFeedback(null);
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < SWIPE_FEEDBACK_START_PX) {
      setSwipeFeedback(null);
      return;
    }

    if (absX < absY * SWIPE_FEEDBACK_DIRECTION_RATIO) {
      setSwipeFeedback(null);
      return;
    }

    const direction = deltaX > 0 ? "prev" : "next";
    const isBlocked =
      direction === "next" && toDateString(currentDate) === todayDateString();

    setSwipeFeedback({
      direction,
      progress: Math.min(absX / SWIPE_MIN_DISTANCE_PX, 1),
      blocked: isBlocked,
    });
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    setSwipeFeedback(null);

    if (!start?.canSwipe || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < SWIPE_MIN_DISTANCE_PX) return;
    if (absX < absY * SWIPE_DIRECTION_RATIO) return;

    if (deltaX > 0) {
      goToPreviousDay();
      return;
    }

    goToNextDay();
  };

  return (
    <div
      className="pb-24"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        swipeStartRef.current = null;
        setSwipeFeedback(null);
      }}
    >
      {swipeFeedback && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-3">
          <div
            className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium shadow-sm backdrop-blur-sm"
            style={{
              transform: `scale(${0.96 + swipeFeedback.progress * 0.04})`,
            }}
          >
            {swipeFeedback.direction === "prev" ? (
              <ChevronLeft className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <span>
              {swipeFeedback.blocked
                ? t("swipe.alreadyToday")
                : swipeFeedback.direction === "prev"
                  ? t("swipe.previousDay")
                  : t("swipe.nextDay")}
            </span>
          </div>
        </div>
      )}

      <TodayHeader
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        onPreviousDay={goToPreviousDay}
        onNextDay={goToNextDay}
        entryDates={entryDates}
        bookmarkedDates={bookmarkedDates}
        loadJournalMeta={loadJournalMeta}
      />

      <div className="space-y-4 py-4 md:space-y-5 md:px-4">
        <JournalCard
          key={toDateString(currentDate)}
          currentDate={currentDate}
          journal={journal}
          loadJournalMeta={loadJournalMeta}
        />

        <DailyTasksList
          activities={activities}
          lookupActivities={lookupActivities}
          lookupGroups={lookupGroups}
          daily={dailyTasks}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          onTasksDataChanged={() => {
            void refreshTasksData();
          }}
        />
      </div>

      <TodayQuickActions
        currentDate={currentDate}
        currentActivityId={dailyTasks.currentActivityId}
        activities={activities}
        getActivityDrawerElapsedMs={dailyTasks.getActivityDrawerElapsedMs}
        onStartActivity={dailyTasks.handleStartActivity}
        onStopActivity={dailyTasks.handleStopActivity}
        onAddManualActivityPeriod={dailyTasks.addManualActivityPeriod}
        onAddQuickMemo={dailyTasks.createOneTimeTask}
        onTasksDataChanged={() => {
          void refreshTasksData();
        }}
      />
    </div>
  );
}
