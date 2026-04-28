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
import {
  getJournalVideoPlaybackUrl,
  mergeJournalLocationRoute,
} from "@/lib/journal";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";
import type { UseJournalEntryReturn } from "@/components/journal/hooks/use-journal-entry";
import { useLocationDetection } from "@/components/journal/hooks/use-location-detection";
import JournalVideoSection, {
  type JournalThumbnailSource,
} from "@/components/journal/journal-video-section";
import JournalTextSection from "@/components/journal/journal-text-section";
import JournalEditDialog from "@/components/journal/journal-edit-dialog";
import JournalLocationsDialog from "@/components/journal/journal-locations-dialog";
import JournalMetaBar from "@/components/journal/journal-meta-bar";
import type { LocationData } from "@/lib/db/types";

interface JournalCardProps {
  currentDate: Date;
  /** Single hook instance from the page — must not duplicate useJournalEntry inside this card. */
  journal: UseJournalEntryReturn;
  loadJournalMeta: () => Promise<void>;
}

export default function JournalCard({
  currentDate,
  journal,
  loadJournalMeta,
}: JournalCardProps) {
  const [journalEditOpen, setJournalEditOpen] = useState(false);
  const [journalLocationsOpen, setJournalLocationsOpen] = useState(false);
  const [suppressJournalOpenHitArea, setSuppressJournalOpenHitArea] =
    useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isJournalLoaded, setIsJournalLoaded] = useState(false);
  const suppressNextCardClickRef = useRef(false);
  const journalHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const { isSupabaseConfigured, isAuthed } = useAuth();
  const dateString = toDateString(currentDate);

  const videoPlaybackSrc = getJournalVideoPlaybackUrl(journal.draftVideoPath);

  const journalThumbnail: JournalThumbnailSource | null = videoPlaybackSrc
    ? {
        videoSrc: videoPlaybackSrc,
        storedThumbnail: journal.videoThumbnail,
      }
    : null;

  const knownLocationRoute =
    journal.draftLocations.length > 0
      ? journal.draftLocationRoute
      : journal.persistedLocationRoute;
  const knownLocations = knownLocationRoute.locations;

  const displayLocations = knownLocations;

  const handleLocationDetected = useCallback(
    (loc: LocationData) => {
      const base =
        journal.draftRef.current.locationRoute.locations.length > 0
          ? journal.draftRef.current.locationRoute
          : journal.persistedLocationRoute;
      const merged = mergeJournalLocationRoute(base, loc);
      if (merged.locations.length === base.locations.length) return;
      journal.setDraftLocationRoute(merged);
      journal.draftRef.current.locationRoute = merged;
      journal.saveLocationRoute(merged);
    },
    [journal]
  );

  const { detectLocation, resetGeoAttempt } = useLocationDetection({
    isToday: journal.canEditJournal,
    isJournalLoaded,
    knownLocations,
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

  const handleLocationsOpenChange = (open: boolean) => {
    setJournalLocationsOpen(open);
    if (open) setSuppressJournalOpenHitArea(false);
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

  return (
    <>
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
              locations={
                displayLocations.length > 0 ? displayLocations : undefined
              }
              onLocationsClick={() => handleLocationsOpenChange(true)}
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
        <JournalLocationsDialog
          open={journalLocationsOpen}
          onOpenChange={handleLocationsOpenChange}
          route={knownLocationRoute}
          canEdit
          onSave={(route) => {
            journal.setDraftLocationRoute(route);
            journal.draftRef.current.locationRoute = route;
            journal.saveLocationRoute(route);
          }}
        />

        <JournalMetaBar journal={journal} onEditRequest={openJournalEditor} />
      </div>
    </>
  );
}
