/**
 * SRP: Renders the tasks page shell, journal date header, journal sections, date-scoped tasks, and swipe/touch date navigation (calendar via header card).
 */
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
} from "react";
import { ChevronLeft, ChevronRight, Flame, Hash } from "lucide-react";
import { toDateStr } from "@/lib/db";
import { HOLD_ACTION_DELAY_MS } from "@/lib/consts";
import DailyTasksList from "@/components/tasks/daily-tasks-list";
import { useJournalEntry } from "@/components/tasks/hooks/use-journal-entry";
import { useJournalMeta } from "@/components/tasks/hooks/use-journal-meta";
import { useJournalDayWeather } from "@/components/tasks/hooks/use-journal-day-weather";
import { useLocationDetection } from "@/components/tasks/hooks/use-location-detection";
import { useTasksPageData } from "@/components/tasks/hooks/use-tasks-page-data";
import { useDailyTasks } from "@/components/tasks/hooks/use-daily-tasks";
import JournalVideoSection, {
  type JournalThumbnailSource,
} from "@/components/tasks/journal-video-section";
import JournalTextSection from "@/components/tasks/journal-text-section";
import JournalEditDialog from "@/components/tasks/journal-edit-dialog";
import JournalDateHeaderCard from "@/components/tasks/journal-date-header-card";
import TasksJournalMetaBar from "@/components/tasks/tasks-journal-meta-bar";
import type { LocationData } from "@/lib/db/types";
import { getJournalVideoPlaybackUrl } from "@/lib/journal-video-storage";
import { pickRandomHabitQuote } from "@/lib/habit-quotes";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

export default function TasksPageContent() {
  const SWIPE_MIN_DISTANCE_PX = 70;
  const SWIPE_DIRECTION_RATIO = 1.35;
  const SWIPE_FEEDBACK_START_PX = 12;
  const SWIPE_FEEDBACK_DIRECTION_RATIO = 1.1;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [isJournalLoaded, setIsJournalLoaded] = useState(false);
  const [journalEditOpen, setJournalEditOpen] = useState(false);
  /** Briefly ignore pointer on the journal “open editor” hit area after close (overlay dismiss ghost click). */
  const [suppressJournalOpenHitArea, setSuppressJournalOpenHitArea] =
    useState(false);
  const [quote] = useState(pickRandomHabitQuote);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [swipeFeedback, setSwipeFeedback] = useState<{
    direction: "prev" | "next";
    progress: number;
    blocked: boolean;
  } | null>(null);
  const journalHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const suppressNextCardClickRef = useRef(false);
  const swipeStartRef = useRef<{
    x: number;
    y: number;
    canSwipe: boolean;
  } | null>(null);

  const { isSupabaseConfigured, isAuthed } = useAuth();

  const journal = useJournalEntry(currentDate);
  const dateString = toDateStr(currentDate);
  const { loadJournalEntry } = journal;
  const { entryDates, bookmarkedDates, loadJournalMeta } = useJournalMeta();

  const { activities, groups, loading, refreshTrigger } = useTasksPageData({
    loadJournalEntry,
    loadJournalMeta,
  });

  const dailyTasks = useDailyTasks({
    activities,
    groups,
    currentDate,
    refreshTrigger,
  });

  const handleLocationDetected = useCallback(
    (location: LocationData) => {
      journal.setDraftLocation(location);
      journal.draftRef.current.location = location;
      journal.saveLocation(location);
    },
    [journal]
  );

  const journalDayWeather = useJournalDayWeather(
    currentDate,
    journal.draftLocation ?? journal.persistedLocation
  );

  const { detectLocation, isDetectingLocation, resetGeoAttempt } =
    useLocationDetection({
      isToday: journal.canEditJournal,
      isJournalLoaded,
      currentLocation: journal.draftLocation,
      persistedLocation: journal.persistedLocation,
      onLocationDetected: handleLocationDetected,
    });

  useEffect(() => {
    loadJournalMeta();
  }, [loadJournalMeta]);

  useEffect(() => {
    void loadJournalMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal.draftBookmarked]);

  useEffect(() => {
    setIsJournalLoaded(false);
    setJournalEditOpen(false);
    resetGeoAttempt();
    void loadJournalEntry().finally(() => {
      setIsJournalLoaded(true);
    });
  }, [loadJournalEntry, resetGeoAttempt]);

  useEffect(() => {
    if (!journal.canEditJournal) return;
    detectLocation();
  }, [detectLocation, journal.canEditJournal]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (journalHoldTimerRef.current != null) {
        clearTimeout(journalHoldTimerRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const videoPlaybackSrc = getJournalVideoPlaybackUrl(journal.draftVideoPath);

  const journalThumbnail: JournalThumbnailSource | null = videoPlaybackSrc
    ? {
        videoSrc: videoPlaybackSrc,
        storedThumbnail: journal.videoThumbnail,
      }
    : null;

  const handleJournalEditOpenChange = (open: boolean) => {
    setJournalEditOpen((prev) => {
      if (prev && !open) {
        setSuppressJournalOpenHitArea(true);
        window.setTimeout(() => setSuppressJournalOpenHitArea(false), 0);
      }
      return open;
    });
    if (open) {
      setSuppressJournalOpenHitArea(false);
    }
  };

  const openJournalEditor = () => {
    handleJournalEditOpenChange(true);
  };

  const clearJournalHoldTimer = () => {
    if (journalHoldTimerRef.current != null) {
      clearTimeout(journalHoldTimerRef.current);
      journalHoldTimerRef.current = null;
    }
  };

  const handleJournalPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!journal.canEditJournal) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearJournalHoldTimer();
    journalHoldTimerRef.current = setTimeout(() => {
      journalHoldTimerRef.current = null;
      suppressNextCardClickRef.current = true;
      const next = !journal.draftBookmarked;
      journal.setDraftBookmarked(next);
      journal.saveBookmark(next);
    }, HOLD_ACTION_DELAY_MS);
  };

  const handleJournalPointerEnd = () => {
    clearJournalHoldTimer();
  };

  const handleJournalCardClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!journal.canEditJournal) return;
    if (suppressNextCardClickRef.current) {
      suppressNextCardClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const el = event.target;
    if (!(el instanceof Element)) return;
    if (
      el.closest(
        "button, a, input, textarea, select, [role='button'], [role='link'], [contenteditable='true'], video"
      )
    ) {
      return;
    }
    openJournalEditor();
  };

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
      direction === "next" && toDateStr(currentDate) === toDateStr(new Date());

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
      const today = new Date();
      if (toDateStr(prev) === toDateStr(today)) return prev;
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  return (
    <div
      className="pb-32"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        swipeStartRef.current = null;
        setSwipeFeedback(null);
      }}
    >
      {swipeFeedback && (
        <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2">
          <div
            className="flex items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm"
            style={{
              opacity: 0.4 + swipeFeedback.progress * 0.6,
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
                ? "Already on today"
                : swipeFeedback.direction === "prev"
                  ? "Previous day"
                  : "Next day"}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col">
        <div className="bg-muted/50">
          <JournalDateHeaderCard
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            entryDates={entryDates}
            bookmarkedDates={bookmarkedDates}
            onCalendarOpen={loadJournalMeta}
          />
        </div>

        <div
          className="mb-2 overflow-hidden"
          onPointerDown={
            journal.canEditJournal ? handleJournalPointerDown : undefined
          }
          onPointerUp={
            journal.canEditJournal ? handleJournalPointerEnd : undefined
          }
          onPointerLeave={
            journal.canEditJournal ? handleJournalPointerEnd : undefined
          }
          onPointerCancel={
            journal.canEditJournal ? handleJournalPointerEnd : undefined
          }
          onContextMenu={
            journal.canEditJournal
              ? (event) => event.preventDefault()
              : undefined
          }
        >
          <div
            className={cn(
              suppressJournalOpenHitArea && "[&_*]:!pointer-events-none"
            )}
            onClick={
              journal.canEditJournal ? handleJournalCardClick : undefined
            }
          >
            <JournalVideoSection
              videoSrc={videoPlaybackSrc ?? ""}
              canPlay={isOnline}
              thumbnail={journalThumbnail}
              onThumbnailGenerated={(thumb) => {
                journal.draftRef.current.videoThumbnail = thumb;
                journal.saveDraft();
              }}
            />

            <div className="pointer-events-none relative z-10 mx-auto -mt-10 flex w-full max-w-2xl items-end justify-between px-4">
              <div className="pointer-events-auto relative">
                {journal.draftEmoji ? (
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-background text-5xl">
                    {journal.draftEmoji}
                  </span>
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-background text-5xl text-muted-foreground/30">
                    🙂
                  </span>
                )}
              </div>

              {journal.isJournalComplete &&
                typeof journal.journalCompletionStreak === "number" &&
                typeof journal.journalEntryNumber === "number" && (
                  <div className="pointer-events-auto mb-2 flex items-end gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center">
                      <Hash className="h-3 w-3" />
                      {journal.journalEntryNumber}
                    </span>
                    <span className="inline-flex items-center">
                      <Flame className="h-3 w-3" />
                      {journal.journalCompletionStreak}
                    </span>
                  </div>
                )}
            </div>

            <div className="mx-auto max-w-2xl space-y-3 px-4">
              <div className="px-1">
                <JournalTextSection
                  title={journal.draftTitle}
                  text={journal.draftText}
                />
              </div>
            </div>
          </div>

          <JournalEditDialog
            open={journalEditOpen}
            canEdit={journal.canEditJournal}
            initialEmoji={journal.draftEmoji}
            initialTitle={journal.draftTitle}
            initialText={journal.draftText}
            initialVideoPath={journal.draftVideoPath}
            entryDate={dateString}
            canUploadVideo={isSupabaseConfigured && isAuthed}
            onOpenChange={handleJournalEditOpenChange}
            onSave={({ emoji, title, text, videoPath }) => {
              journal.setDraftEmoji(emoji);
              journal.setDraftTitle(title);
              journal.setDraftText(text);
              journal.setDraftVideoPath(videoPath);
              journal.draftRef.current.emoji = emoji;
              journal.draftRef.current.title = title;
              journal.draftRef.current.text = text;
              if (journal.draftRef.current.videoPath !== videoPath) {
                journal.draftRef.current.videoThumbnail = null;
              }
              journal.draftRef.current.videoPath = videoPath;
              journal.saveDraft();
            }}
          />

          <TasksJournalMetaBar
            journal={journal}
            onEditRequest={openJournalEditor}
          />
        </div>

        <p className="text-center">...</p>
      </div>

      <div className="p-3">
        <DailyTasksList
          activities={activities}
          groups={groups}
          daily={dailyTasks}
        />

        <blockquote className="pb-12 pt-8 text-center font-crimson text-sm italic leading-relaxed text-muted-foreground/60">
          {quote}
        </blockquote>
      </div>
    </div>
  );
}
