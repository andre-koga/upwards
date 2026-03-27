/**
 * SRP: Self-contained journal card with date navigation, video, text, emoji, bookmark, edit dialog, and hold-to-bookmark.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { Flame, Hash } from "lucide-react";
import { toDateStr } from "@/lib/db";
import { HOLD_ACTION_DELAY_MS } from "@/lib/consts";
import { getJournalVideoPlaybackUrl } from "@/lib/journal-video-storage";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";
import { useJournalEntry } from "../tasks/hooks/use-journal-entry";
import { useJournalMeta } from "../tasks/hooks/use-journal-meta";
import { useJournalDayWeather } from "../tasks/hooks/use-journal-day-weather";
import { useLocationDetection } from "../tasks/hooks/use-location-detection";
import JournalDateHeaderCard from "../tasks/journal-date-header-card";
import JournalVideoSection, {
  type JournalThumbnailSource,
} from "../tasks/journal-video-section";
import JournalTextSection from "../tasks/journal-text-section";
import JournalEditDialog from "../tasks/journal-edit-dialog";
import TasksJournalMetaBar from "../tasks/tasks-journal-meta-bar";
import type { LocationData } from "@/lib/db/types";

interface JournalCardProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  /** Called after loadJournalEntry/loadJournalMeta so parent can wire into sync refresh. */
  loadJournalEntry: ReturnType<typeof useJournalEntry>["loadJournalEntry"];
  loadJournalMeta: ReturnType<typeof useJournalMeta>["loadJournalMeta"];
}

export default function JournalCard({
  currentDate,
  onDateChange,
  loadJournalEntry,
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
  const journal = useJournalEntry(currentDate);
  const dateString = toDateStr(currentDate);

  const videoPlaybackSrc = getJournalVideoPlaybackUrl(journal.draftVideoPath);

  const journalThumbnail: JournalThumbnailSource | null = videoPlaybackSrc
    ? {
        videoSrc: videoPlaybackSrc,
        storedThumbnail: journal.videoThumbnail,
      }
    : null;

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
    </>
  );
}
