/**
 * SRP: Renders the tasks page shell, journal sections, and date-scoped task content.
 */
import { useState, useEffect, useCallback } from "react";
import { Flame, Hash, Pencil } from "lucide-react";
import { toDateStr } from "@/lib/db";
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
import { FloatingBackButton } from "@/components/ui/floating-back-button";
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationInputVal, setLocationInputVal] = useState("");
  const [isJournalLoaded, setIsJournalLoaded] = useState(false);
  const [journalEditOpen, setJournalEditOpen] = useState(false);
  const [journalEditSession, setJournalEditSession] = useState(0);
  const [quote] = useState(pickRandomHabitQuote);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

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

  return (
    <div className="pb-32">
      <JournalVideoSection
        canEdit={journal.canEditJournal}
        youtubeUrl={journal.draftYoutubeUrl}
        embedUrl={embedUrl}
        entryDate={dateString}
        canUpload={isSupabaseConfigured && isAuthed}
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
          <JournalTextSection
            title={journal.draftTitle}
            text={journal.draftText}
          />

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

          {journal.canEditJournal && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setJournalEditSession((session) => session + 1);
                  setJournalEditOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                title="Edit journal"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            </div>
          )}

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

      <FloatingBackButton to="/settings" title="Settings" icon="settings" />

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
