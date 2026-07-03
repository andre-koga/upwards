import { useState, useRef, type TouchEvent, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, FlaskConical, ScrollText, Users } from "lucide-react";
import { toDateString } from "@/lib/time-utils";
import DailyTasksList from "@/components/tasks/daily-tasks-list";
import JournalCard from "@/components/journal/journal-card";
import { pickRandomHabitQuote } from "@/lib/habit-quotes";
import { useTodayPage } from "@/hooks/use-today-page";
import { DailyRecapDialog } from "@/components/recap/daily-recap-dialog";
import { FriendRecapDialog } from "@/components/notifications/friend-recap-dialog";
import { getDailyRecap } from "@/lib/recap/get-daily-recap";
import type { InboxNotification } from "@/lib/notifications/use-notifications";
import { Button } from "@/components/ui/button";
import { getEffectiveToday } from "@/lib/session/day-reset";
import { useDayResetTimer } from "@/hooks/use-day-reset-timer";
import { getActivityDisplayName } from "@/lib/activity";

const IS_DEV = import.meta.env.DEV;

export default function TodayPage() {
  const { t } = useTranslation("today");
  const SWIPE_MIN_DISTANCE_PX = 70;
  const SWIPE_DIRECTION_RATIO = 1.35;
  const SWIPE_FEEDBACK_START_PX = 12;
  const SWIPE_FEEDBACK_DIRECTION_RATIO = 1.1;

  const [currentDate, setCurrentDate] = useState(
    () => new Date(`${getEffectiveToday()}T12:00:00`)
  );
  const [quote] = useState(pickRandomHabitQuote);
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
  const [devRecapOpen, setDevRecapOpen] = useState(false);
  const [devFriendRecap, setDevFriendRecap] = useState<InboxNotification | null>(null);
  const [pastRecapOpen, setPastRecapOpen] = useState(false);

  const [dayResetTick, setDayResetTick] = useState(0);

  // Re-render when the day resets so todayStr and isPastDay update live.
  const [, setResetTick] = useState(0);
  const handleDayReset = useCallback(() => {
    setResetTick((t) => t + 1);
    setDayResetTick((t) => t + 1);
  }, []);
  useDayResetTimer(handleDayReset);

  const todayStr = getEffectiveToday();
  const currentDateStr = toDateString(currentDate);
  const isPastDay = currentDateStr < todayStr;

  const {
    journal,
    entryDates,
    bookmarkedDates,
    loadJournalMeta,
    activities,
    lookupActivities,
    groups,
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
      direction === "next" &&
      toDateString(currentDate) === getEffectiveToday();

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
      setCurrentDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() - 1);
        return next;
      });
      return;
    }

    setCurrentDate((prev) => {
      if (toDateString(prev) === getEffectiveToday()) return prev;
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  return (
    <div
      className="pb-36"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        swipeStartRef.current = null;
        setSwipeFeedback(null);
      }}
    >
      {swipeFeedback && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3">
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

      <JournalCard
        currentDate={currentDate}
        journal={journal}
        loadJournalMeta={loadJournalMeta}
      />

      {IS_DEV && (
        <>
          <div className="flex justify-center gap-2 px-4 pb-1 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full border-dashed border-muted-foreground/40 text-xs text-muted-foreground"
              onClick={() => setDevRecapOpen(true)}
            >
              <FlaskConical className="h-3.5 w-3.5" />
              Dev: recap dialog
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full border-dashed border-muted-foreground/40 text-xs text-muted-foreground"
              onClick={async () => {
                const recap = await getDailyRecap(currentDateStr, 0);
                const mock: InboxNotification = {
                  id: "dev-friend-recap",
                  kind: "daily_summary",
                  actorId: "dev",
                  actorUsername: "you",
                  actorDisplayName: "You (friend view)",
                  activityName: null,
                  createdAt: new Date().toISOString(),
                  actionStatus: null,
                  summaryDate: currentDateStr,
                  summaryCaption: null,
                  summaryCompletedCount: recap.completed.length,
                  summaryTotalCount: recap.completed.length + recap.missed.length,
                  summaryTotalTrackedMs: recap.totalTrackedMs,
                  summaryCompletions: [
                    ...recap.completed.map((c) => ({
                      activityName: getActivityDisplayName(c.activity, c.group),
                      streak: c.streak,
                      routine: c.activity.routine ?? null,
                      completed: true,
                    })),
                    ...recap.missed.map((m) => ({
                      activityName: getActivityDisplayName(m.activity, m.group),
                      streak: 0,
                      routine: m.activity.routine ?? null,
                      completed: false,
                    })),
                  ],
                };
                setDevFriendRecap(mock);
              }}
            >
              <Users className="h-3.5 w-3.5" />
              Dev: friend recap
            </Button>
          </div>
          <DailyRecapDialog
            open={devRecapOpen}
            recapDate={currentDateStr}
            loginStreak={7}
            onDismiss={() => setDevRecapOpen(false)}
          />
          {devFriendRecap && (
            <FriendRecapDialog
              open={devFriendRecap !== null}
              onOpenChange={(next) => { if (!next) setDevFriendRecap(null); }}
              n={devFriendRecap}
            />
          )}
        </>
      )}

      {isPastDay && (
        <>
          <div className="flex justify-center px-4 pb-1 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full text-xs"
              onClick={() => setPastRecapOpen(true)}
            >
              <ScrollText className="h-3.5 w-3.5" />
              {t("viewDayRecap")}
            </Button>
          </div>
          <DailyRecapDialog
            open={pastRecapOpen}
            recapDate={currentDateStr}
            loginStreak={0}
            onDismiss={() => setPastRecapOpen(false)}
          />
        </>
      )}

      <div className="p-3">
        <DailyTasksList
          activities={activities}
          lookupActivities={lookupActivities}
          groups={groups}
          lookupGroups={lookupGroups}
          daily={dailyTasks}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          entryDates={entryDates}
          bookmarkedDates={bookmarkedDates}
          loadJournalMeta={loadJournalMeta}
          onTasksDataChanged={() => {
            void refreshTasksData();
          }}
        />

        <blockquote className="pb-12 pt-8 text-center font-crimson text-sm italic leading-relaxed text-muted-foreground">
          {quote}
        </blockquote>
      </div>
    </div>
  );
}
