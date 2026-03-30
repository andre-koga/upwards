import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { toDateString } from "@/lib/time-utils";
import { HOLD_ACTION_DELAY_MS } from "@/lib/constants";
import { getJournalVideoPlaybackUrl } from "@/lib/journal";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";
import type { UseJournalEntryReturn } from "@/components/tasks/hooks/use-journal-entry";
import { useJournalMeta } from "@/components/tasks/hooks/use-journal-meta";
import { useJournalDayWeather } from "@/components/tasks/hooks/use-journal-day-weather";
import { useLocationDetection } from "@/components/tasks/hooks/use-location-detection";
import JournalDateHeaderCard from "@/components/tasks/journal-date-header-card";
import JournalVideoSection, {
  type JournalThumbnailSource,
} from "@/components/tasks/journal-video-section";
import JournalTextSection from "@/components/tasks/journal-text-section";
import JournalEditDialog from "@/components/tasks/journal-edit-dialog";
import TasksJournalMetaBar from "@/components/tasks/tasks-journal-meta-bar";
import type { LocationData } from "@/lib/db/types";

interface JournalCardProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  /** Single hook instance from the page — must not duplicate useJournalEntry inside this card. */
  journal: UseJournalEntryReturn;
  loadJournalMeta: ReturnType<typeof useJournalMeta>["loadJournalMeta"];
}

export default function JournalCard({
  currentDate,
  onDateChange,
  journal,
  loadJournalMeta,
}: JournalCardProps) {
  const [journalEditOpen, setJournalEditOpen] = useState(false);
  const [suppressJournalOpenHitArea, setSuppressJournalOpenHitArea] =
    useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isJournalLoaded, setIsJournalLoaded] = useState(false);
  const suppressNextCardClickRef = useRef(false);
  const journalHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const { isSupabaseConfigured, isAuthed } = useAuth();
  const { entryDates, bookmarkedDates } = useJournalMeta();
  const dateString = toDateString(currentDate);

  const videoPlaybackSrc = getJournalVideoPlaybackUrl(journal.draftVideoPath);

  const journalThumbnail: JournalThumbnailSource | null = videoPlaybackSrc
    ? {
        videoSrc: videoPlaybackSrc,
        storedThumbnail: journal.videoThumbnail,
      }
    : null;

  const location = journal.draftLocation ?? journal.persistedLocation;

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

  const { detectLocation, resetGeoAttempt } = useLocationDetection({
    isToday: journal.canEditJournal,
    isJournalLoaded,
    currentLocation: journal.draftLocation,
    persistedLocation: journal.persistedLocation,
    onLocationDetected: handleLocationDetected,
  });

  useEffect(() => {
    void loadJournalMeta();
  }, [loadJournalMeta]);

  useEffect(() => {
    void loadJournalMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal.draftBookmarked]);

  useEffect(() => {
    setIsJournalLoaded(false);
    setJournalEditOpen(false);
    resetGeoAttempt();
    void journal.loadJournalEntry().finally(() => {
      setIsJournalLoaded(true);
    });
    // journal intentionally omitted — object identity changes every render; loadJournalEntry tracks date.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit journal object
  }, [journal.loadJournalEntry, resetGeoAttempt]);

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

  const clearJournalHoldTimer = () => {
    if (journalHoldTimerRef.current != null) {
      clearTimeout(journalHoldTimerRef.current);
      journalHoldTimerRef.current = null;
    }
  };

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

  // Suppress unused variable lint — weather data will be consumed when the weather UI is wired up
  void journalDayWeather;

  return (
    <>
      <JournalDateHeaderCard
        currentDate={currentDate}
        onDateChange={onDateChange}
        entryDates={entryDates}
        bookmarkedDates={bookmarkedDates}
        onCalendarOpen={loadJournalMeta}
      />

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
          journal.canEditJournal ? (event) => event.preventDefault() : undefined
        }
      >
        <div
          className={cn(
            suppressJournalOpenHitArea && "[&_*]:!pointer-events-none"
          )}
          onClick={journal.canEditJournal ? handleJournalCardClick : undefined}
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
          </div>

          <div className="mx-auto max-w-2xl space-y-3 px-5">
            <JournalTextSection
              title={journal.draftTitle}
              text={journal.draftText}
              location={location ?? undefined}
              journalCompletionStreak={
                journal.isJournalComplete &&
                typeof journal.journalCompletionStreak === "number"
                  ? journal.journalCompletionStreak
                  : null
              }
            />
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
    </>
  );
}
