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
  normalizeJournalLocationRoute,
} from "@/lib/journal";
import { useAuth } from "@/lib/use-auth";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";
import { getEffectiveToday } from "@/lib/session/day-reset";
import type { UseJournalEntryReturn } from "@/components/journal/hooks/use-journal-entry";
import { useLocationDetection } from "@/components/journal/hooks/use-location-detection";
import JournalVideoSection, {
  type JournalThumbnailSource,
} from "@/components/journal/journal-video-section";
import JournalTextSection from "@/components/journal/journal-text-section";
import JournalEditDialog from "@/components/journal/journal-edit-dialog";
import JournalLocationsDialog from "@/components/journal/journal-locations-dialog";
import JournalLocationMapPicker from "@/components/journal/journal-location-map-picker";
import JournalMetaBar from "@/components/journal/journal-meta-bar";
import JournalPhotoStack from "@/components/journal/journal-photo-stack";
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
  const [placesMapOpen, setPlacesMapOpen] = useState(false);
  const [suppressJournalOpenHitArea, setSuppressJournalOpenHitArea] =
    useState(false);
  const isOnline = useOnlineStatus();
  const [isJournalLoaded, setIsJournalLoaded] = useState(false);
  const suppressNextCardClickRef = useRef(false);
  const journalHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const { isSupabaseConfigured, isAuthed } = useAuth();
  const dateString = toDateString(currentDate);
  const isCurrentDay = dateString === getEffectiveToday();

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
  const knownLocations = normalizeJournalLocationRoute(
    knownLocationRoute
  ).locations;

  const displayLocations = knownLocations;

  const { draftRef, persistedLocationRoute, updateDraft, saveLocationRoute } =
    journal;

  const handleLocationDetected = useCallback(
    (loc: LocationData) => {
      const base =
        draftRef.current.locationRoute.locations.length > 0
          ? draftRef.current.locationRoute
          : persistedLocationRoute;
      const merged = mergeJournalLocationRoute(base, loc);
      if (merged.locations.length === base.locations.length) return;
      updateDraft({ locationRoute: merged });
      saveLocationRoute(merged);
    },
    [draftRef, persistedLocationRoute, updateDraft, saveLocationRoute]
  );

  const { detectLocation } = useLocationDetection({
    isToday: isCurrentDay,
    isJournalLoaded,
    knownLocations,
    onLocationDetected: handleLocationDetected,
  });

  useEffect(() => {
    void loadJournalMeta();
  }, [loadJournalMeta, journal.draftBookmarked]);

  // Initial load for this date. The card is keyed by date in today.tsx, so
  // mount-time state (dialogs closed, not-yet-loaded) needs no reset effect.
  const { loadJournalEntry } = journal;
  useEffect(() => {
    let cancelled = false;
    void loadJournalEntry().finally(() => {
      if (!cancelled) setIsJournalLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loadJournalEntry]);

  useEffect(() => {
    if (!isCurrentDay) return;
    detectLocation();
  }, [detectLocation, isCurrentDay]);

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
              updateDraft({ videoThumbnail: thumb });
              journal.saveDraft();
            }}
          />

          <div className="pointer-events-none relative z-10 mx-auto -mt-10 h-20 w-full max-w-2xl px-4">
            <div className="pointer-events-auto absolute bottom-0 left-4">
              {journal.draftEmoji ? (
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-background text-5xl">
                  {journal.draftEmoji}
                </span>
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-background text-5xl text-muted-foreground">
                  🙂
                </span>
              )}
            </div>
            <div className="pointer-events-auto absolute bottom-1 right-4">
              <JournalPhotoStack photoPaths={journal.draftPhotoPaths} />
            </div>
          </div>

          <div className="mx-auto max-w-2xl space-y-3 px-5">
            <JournalTextSection
              title={journal.draftTitle}
              text={journal.draftText}
              locations={
                displayLocations.length > 0 ? displayLocations : undefined
              }
              onLocationsEditClick={() => handleLocationsOpenChange(true)}
              onPlacesMapClick={
                displayLocations.length > 0
                  ? () => setPlacesMapOpen(true)
                  : undefined
              }
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
          initialPhotoPaths={journal.draftPhotoPaths}
          entryDate={dateString}
          canUploadVideo={isSupabaseConfigured && isAuthed}
          onOpenChange={handleJournalEditOpenChange}
          onSave={({ emoji, title, text, videoPath, photoPaths }) => {
            // Clear the stale thumbnail only when the video actually changes.
            const videoChanged = draftRef.current.videoPath !== videoPath;
            updateDraft({
              emoji,
              title,
              text,
              videoPath,
              photoPaths,
              ...(videoChanged ? { videoThumbnail: null } : {}),
            });
            journal.saveDraft();
          }}
        />
        <JournalLocationsDialog
          open={journalLocationsOpen}
          onOpenChange={handleLocationsOpenChange}
          route={knownLocationRoute}
          canEdit={journal.canEditJournal}
          onSave={(route) => {
            updateDraft({ locationRoute: route });
            saveLocationRoute(route);
          }}
        />
        {displayLocations.length > 0 ? (
          <JournalLocationMapPicker
            locations={displayLocations}
            showPreview={false}
            fullscreenOpen={placesMapOpen}
            onFullscreenOpenChange={setPlacesMapOpen}
          />
        ) : null}

        <JournalMetaBar journal={journal} onEditRequest={openJournalEditor} />
      </div>
    </>
  );
}
