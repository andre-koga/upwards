/**
 * SRP: Renders the tasks page shell, journal sections, and date-scoped task content.
 */
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type TouchEvent,
} from "react";
import { ChevronLeft, ChevronRight, Flame, Hash } from "lucide-react";
import { Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { toDateStr } from "@/lib/db";
import { HOLD_ACTION_DELAY_MS } from "@/lib/consts";
import DailyTasksList from "@/components/tasks/daily-tasks-list";
import { useJournalEntry } from "@/components/tasks/hooks/use-journal-entry";
import { useJournalMeta } from "@/components/tasks/hooks/use-journal-meta";
import { useLocationDetection } from "@/components/tasks/hooks/use-location-detection";
import { useTasksPageData } from "@/components/tasks/hooks/use-tasks-page-data";
import JournalVideoSection, {
  type JournalThumbnailSource,
} from "@/components/tasks/journal-video-section";
import JournalTextSection from "@/components/tasks/journal-text-section";
import JournalEditDialog from "@/components/tasks/journal-edit-dialog";
import DateNavigator from "@/components/tasks/date-navigator";
import TasksJournalMetaBar from "@/components/tasks/tasks-journal-meta-bar";
import type { LocationData } from "@/lib/db/types";
import {
  getYoutubeEmbedUrl,
  getYoutubeVideoIdFromEmbed,
} from "@/lib/youtube-utils";
import { pickRandomHabitQuote } from "@/lib/habit-quotes";
import { useAuth } from "@/lib/use-auth";

function journalStreakColorClass(streak: number): string {
  if (streak === 0) return "text-muted-foreground";
  if (streak <= 5) return "text-yellow-500";
  if (streak <= 25) return "text-orange-500";
  return "text-red-500";
}

export default function TasksPageContent() {
  const SWIPE_MIN_DISTANCE_PX = 70;
  const SWIPE_DIRECTION_RATIO = 1.35;
  const SWIPE_FEEDBACK_START_PX = 12;
  const SWIPE_FEEDBACK_DIRECTION_RATIO = 1.1;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationInputVal, setLocationInputVal] = useState("");
  const [isJournalLoaded, setIsJournalLoaded] = useState(false);
  const [journalEditOpen, setJournalEditOpen] = useState(false);
  const [journalEditSession, setJournalEditSession] = useState(0);
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

  const handleLocationDetected = useCallback(
    (location: LocationData) => {
      journal.setDraftLocation(location);
      journal.draftRef.current.location = location;
      journal.saveLocation(location);
    },
    [journal]
  );

  const { detectLocation, isDetectingLocation, resetGeoAttempt } =
    useLocationDetection({
      isToday: journal.canEditJournal,
      isJournalLoaded,
      currentLocation: journal.draftLocation,
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
    if (!journal.canEditJournal) {
      setShowLocationInput(false);
    }
  }, [journal.canEditJournal]);

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

  const embedUrl = getYoutubeEmbedUrl(journal.draftYoutubeUrl);
  const youtubeIdFromEmbed = embedUrl
    ? getYoutubeVideoIdFromEmbed(embedUrl)
    : null;
  const isJournalDraftComplete = Boolean(
    journal.draftEmoji.trim() &&
    journal.draftTitle.trim() &&
    journal.draftText.trim() &&
    journal.draftYoutubeUrl.trim()
  );
  const streak = journal.journalCompletionStreak ?? 0;
  const journalStreakClass = journalStreakColorClass(streak);

  const journalThumbnail: JournalThumbnailSource | null =
    journal.draftYoutubeUrl.trim().length > 0
      ? {
          videoUrl: journal.draftYoutubeUrl,
          youtubeVideoId: youtubeIdFromEmbed,
          storedThumbnail: journal.videoThumbnail,
        }
      : null;

  const openJournalEditor = () => {
    setJournalEditSession((session) => session + 1);
    setJournalEditOpen(true);
  };

  const clearJournalHoldTimer = () => {
    if (journalHoldTimerRef.current != null) {
      clearTimeout(journalHoldTimerRef.current);
      journalHoldTimerRef.current = null;
    }
  };

  const handleJournalHoldStart = () => {
    if (!journal.canEditJournal) return;
    clearJournalHoldTimer();
    journalHoldTimerRef.current = setTimeout(() => {
      journalHoldTimerRef.current = null;
      openJournalEditor();
    }, HOLD_ACTION_DELAY_MS);
  };

  const handleJournalHoldEnd = () => {
    clearJournalHoldTimer();
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

      <JournalVideoSection
        canEdit={journal.canEditJournal}
        youtubeUrl={journal.draftYoutubeUrl}
        embedUrl={embedUrl}
        entryDate={dateString}
        canUpload={isSupabaseConfigured && isAuthed}
        leftControl={
          <Link
            to="/settings"
            title="Settings"
            aria-label="Open settings"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/90 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5 opacity-80" />
          </Link>
        }
        canPlay={isOnline}
        thumbnail={journalThumbnail}
        onChange={(url) => {
          journal.setDraftYoutubeUrl(url);
          journal.draftRef.current.youtubeUrl = url;
        }}
        onThumbnailGenerated={(thumb) => {
          journal.draftRef.current.videoThumbnail = thumb;
          journal.saveDraft();
        }}
        onBlur={journal.saveDraft}
      />

      <div className="pointer-events-none relative z-10 -mt-10 flex justify-center">
        <div className="pointer-events-auto relative">
          {journal.draftEmoji ? (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-background text-5xl shadow-md">
              {journal.draftEmoji}
            </span>
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-background text-5xl text-muted-foreground/30 shadow-md">
              🙂
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="mx-auto max-w-2xl space-y-3">
          <div
            onPointerDown={
              journal.canEditJournal ? handleJournalHoldStart : undefined
            }
            onPointerUp={
              journal.canEditJournal ? handleJournalHoldEnd : undefined
            }
            onPointerCancel={
              journal.canEditJournal ? handleJournalHoldEnd : undefined
            }
            onContextMenu={
              journal.canEditJournal ? (e) => e.preventDefault() : undefined
            }
            onKeyDown={
              journal.canEditJournal
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openJournalEditor();
                    }
                  }
                : undefined
            }
            role={journal.canEditJournal ? "button" : undefined}
            tabIndex={journal.canEditJournal ? 0 : undefined}
            aria-label={
              journal.canEditJournal ? "Hold to edit journal" : undefined
            }
            className={journal.canEditJournal ? "cursor-pointer" : undefined}
          >
            <JournalTextSection
              title={journal.draftTitle}
              text={journal.draftText}
            />
          </div>

          <JournalEditDialog
            key={journalEditSession}
            open={journalEditOpen}
            canEdit={journal.canEditJournal}
            initialEmoji={journal.draftEmoji}
            initialTitle={journal.draftTitle}
            initialText={journal.draftText}
            onOpenChange={setJournalEditOpen}
            onSave={({ emoji, title, text }) => {
              journal.setDraftEmoji(emoji);
              journal.setDraftTitle(title);
              journal.setDraftText(text);
              journal.draftRef.current.emoji = emoji;
              journal.draftRef.current.title = title;
              journal.draftRef.current.text = text;
              journal.saveDraft();
            }}
          />

          <div className="-mt-1 pb-1">
            {journal.isJournalComplete &&
            typeof journal.journalCompletionStreak === "number" &&
            typeof journal.journalEntryNumber === "number" ? (
              <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                <span
                  className={`inline-flex items-center ${journalStreakClass}`}
                >
                  <Flame className="h-3.5 w-3.5" />
                  <span className="pt-0.5 font-medium">
                    {journal.journalCompletionStreak}
                  </span>
                </span>
                <span className="inline-flex items-center">
                  <Hash className="h-3.5 w-3.5" />
                  <span className="pt-0.5 font-medium">
                    {journal.journalEntryNumber}
                  </span>
                </span>
              </div>
            ) : (
              <p className="text-center text-xs text-muted-foreground/80">
                {isJournalDraftComplete
                  ? "Good job!"
                  : "Keep your journaling streak going!"}
              </p>
            )}
          </div>

          <TasksJournalMetaBar
            currentDate={currentDate}
            journal={journal}
            draftRef={journal.draftRef}
            showLocationInput={showLocationInput}
            setShowLocationInput={setShowLocationInput}
            locationInputVal={locationInputVal}
            setLocationInputVal={setLocationInputVal}
            detectLocation={detectLocation}
            isDetectingLocation={isDetectingLocation}
          />

          <DailyTasksList
            activities={activities}
            groups={groups}
            currentDate={currentDate}
            refreshTrigger={refreshTrigger}
          />

          <blockquote className="pb-12 pt-8 text-center font-crimson text-sm italic leading-relaxed text-muted-foreground/60">
            {quote}
          </blockquote>
        </div>
      </div>

      <div className="fixed bottom-3 left-1/2 z-50 -translate-x-1/2">
        <DateNavigator
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          entryDates={entryDates}
          bookmarkedDates={bookmarkedDates}
          onCalendarOpen={loadJournalMeta}
        />
      </div>
    </div>
  );
}
