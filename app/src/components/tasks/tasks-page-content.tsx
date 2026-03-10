import { useState, useEffect, useCallback } from "react";
import { Heart, MapPin, MapPinOff, Flame, Hash, RotateCw } from "lucide-react";
import { db, toDateStr } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  isActiveActivity,
  isActiveGroup,
  sortActivitiesByOrder,
} from "@/lib/activity-utils";
import DailyTasksList from "@/components/tasks/daily-tasks-list";
import { useJournalEntry } from "@/components/tasks/hooks/use-journal-entry";
import { useJournalMeta } from "@/components/tasks/hooks/use-journal-meta";
import { useLocationDetection } from "@/components/tasks/hooks/use-location-detection";
import JournalYoutubeSection from "@/components/tasks/journal-youtube-section";
import JournalTextSection from "@/components/tasks/journal-text-section";
import DateNavigator from "@/components/tasks/date-navigator";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import type { LocationData } from "@/lib/db/types";
import { getYoutubeEmbedUrl } from "@/lib/youtube-utils";
import { getFirstEmoji } from "@/lib/emoji-utils";
import { logError } from "@/lib/error-utils";

export default function TasksPageContent() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationInputVal, setLocationInputVal] = useState("");
  const [isJournalLoaded, setIsJournalLoaded] = useState(false);

  const journal = useJournalEntry(currentDate);
  const { loadJournalEntry } = journal;
  const { entryDates, bookmarkedDates, loadJournalMeta } = useJournalMeta();

  const isToday = toDateStr(currentDate) === toDateStr(new Date());

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
      isToday,
      isJournalLoaded,
      currentLocation: journal.draftLocation,
      onLocationDetected: handleLocationDetected,
    });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [loadedActivities, g] = await Promise.all([
        db.activities.filter((a) => isActiveActivity(a)).toArray(),
        db.activityGroups.filter((g) => isActiveGroup(g)).sortBy("created_at"),
      ]);

      setActivities(sortActivitiesByOrder(loadedActivities));
      setGroups(g);
    } catch (error) {
      logError("Error loading data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadJournalMeta();
  }, [loadJournalMeta]);

  // Keep calendar dots fresh when bookmark on current day changes
  useEffect(() => {
    void loadJournalMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal.draftBookmarked]);

  useEffect(() => {
    setIsJournalLoaded(false);
    resetGeoAttempt();
    void loadJournalEntry().finally(() => {
      setIsJournalLoaded(true);
    });
  }, [loadJournalEntry, resetGeoAttempt]);

  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const embedUrl = getYoutubeEmbedUrl(journal.draftYoutubeUrl);
  const isJournalDraftComplete = Boolean(
    journal.draftEmoji.trim() &&
    journal.draftTitle.trim() &&
    journal.draftText.trim() &&
    journal.draftYoutubeUrl.trim()
  );
  const journalStreakColorClass =
    (journal.journalCompletionStreak ?? 0) === 0
      ? "text-muted-foreground"
      : (journal.journalCompletionStreak ?? 0) <= 5
        ? "text-yellow-500"
        : (journal.journalCompletionStreak ?? 0) <= 25
          ? "text-orange-500"
          : "text-red-500";

  return (
    <div className="pb-32">
      <JournalYoutubeSection
        canEdit={journal.canEditJournal}
        youtubeUrl={journal.draftYoutubeUrl}
        embedUrl={embedUrl}
        onChange={(url) => {
          journal.setDraftYoutubeUrl(url);
          journal.draftRef.current.youtubeUrl = url;
        }}
        onBlur={journal.saveDraft}
      />

      {/* Emoji — centered, overlaps the bottom of the video */}
      <div className="pointer-events-none relative z-10 -mt-10 flex justify-center">
        <div className="pointer-events-auto relative">
          {journal.canEditJournal ? (
            journal.showEmojiInput ? (
              <input
                autoFocus
                type="text"
                value={journal.emojiInput}
                onChange={(e) => {
                  const emoji = getFirstEmoji(e.target.value);
                  journal.setEmojiInput(emoji);
                }}
                onBlur={() => {
                  const emoji = getFirstEmoji(journal.emojiInput);
                  journal.setDraftEmoji(emoji);
                  journal.draftRef.current.emoji = emoji;
                  journal.setShowEmojiInput(false);
                  journal.saveDraft();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape")
                    e.currentTarget.blur();
                }}
                placeholder=""
                className="h-20 w-20 rounded-full bg-background text-center text-5xl shadow-md placeholder:text-xl placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            ) : (
              <button
                onClick={() => journal.setShowEmojiInput(true)}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-background text-5xl shadow-md"
                title="Set day emoji"
              >
                {journal.draftEmoji || (
                  <span className="text-2xl leading-none text-muted-foreground">
                    ＋
                  </span>
                )}
              </button>
            )
          ) : journal.draftEmoji ? (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-background text-5xl shadow-md">
              {journal.draftEmoji}
            </span>
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-background shadow-md" />
          )}

          {/* Bookmark badge — top-right of emoji */}
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="mx-auto max-w-2xl space-y-3">
          <JournalTextSection
            canEdit={journal.canEditJournal}
            title={journal.draftTitle}
            text={journal.draftText}
            onTitleChange={(val) => {
              journal.setDraftTitle(val);
              journal.draftRef.current.title = val;
            }}
            onTextChange={(val) => {
              journal.setDraftText(val);
              journal.draftRef.current.text = val;
            }}
            onBlur={journal.saveDraft}
          />

          <div className="-mt-1 pb-1">
            {journal.isJournalComplete &&
            typeof journal.journalCompletionStreak === "number" &&
            typeof journal.journalEntryNumber === "number" ? (
              <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                <span
                  className={`inline-flex items-center ${journalStreakColorClass}`}
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

          {/* Info bar — sits on the section divider */}
          <div className="py-3">
            <div className="relative border-t border-border">
              <div className="absolute inset-x-0 -top-3.5 grid grid-cols-3 items-center gap-1 px-0">
                {/* Location — left */}
                <div className="flex justify-start">
                  {showLocationInput ? (
                    <input
                      autoFocus
                      value={locationInputVal}
                      onChange={(e) =>
                        setLocationInputVal(
                          e.target.value.replace(/\b\w/g, (c) =>
                            c.toUpperCase()
                          )
                        )
                      }
                      onBlur={() => {
                        const name = locationInputVal.trim();
                        const locationData = name
                          ? {
                              displayName: name,
                              city: name,
                              state: null,
                              country: null,
                              countryCode: null,
                              lat: null,
                              lon: null,
                            }
                          : null;
                        journal.setDraftLocation(locationData);
                        journal.draftRef.current.location = locationData;
                        journal.saveLocation(locationData);
                        setShowLocationInput(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape")
                          e.currentTarget.blur();
                      }}
                      placeholder="City, State"
                      className="w-28 rounded-full border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <div className="flex items-center rounded-full bg-background pr-1">
                      <button
                        onClick={() => {
                          setLocationInputVal(
                            journal.draftLocation?.displayName ?? ""
                          );
                          setShowLocationInput(true);
                        }}
                        className="flex items-center gap-1 rounded-full bg-background py-1 pl-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        title="Set location"
                      >
                        {isDetectingLocation || journal.draftLocation ? (
                          <>
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="max-w-[80px] truncate">
                              {isDetectingLocation
                                ? "Detecting"
                                : journal.draftLocation?.displayName}
                            </span>
                          </>
                        ) : (
                          <>
                            <MapPinOff className="h-3 w-3 shrink-0" />
                            <span>None</span>
                          </>
                        )}
                      </button>

                      {isToday && (
                        <button
                          type="button"
                          onClick={() => detectLocation(true)}
                          disabled={isDetectingLocation}
                          className="mb-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                          title="Retry location detection"
                        >
                          <RotateCw
                            className={`h-3 w-3 ${isDetectingLocation ? "animate-spin" : ""}`}
                          />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Date — center */}
                <div className="flex justify-center">
                  <span className="bg-background px-2 font-crimson text-xl uppercase tracking-widest text-muted-foreground/70">
                    {currentDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                {/* Bookmark — right */}
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      const next = !journal.draftBookmarked;
                      journal.setDraftBookmarked(next);
                      journal.draftRef.current.bookmarked = next;
                      journal.saveBookmark(next);
                    }}
                    className={`flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs text-muted-foreground transition-colors ${
                      journal.draftBookmarked ? "" : "hover:text-foreground"
                    }`}
                    title={
                      journal.draftBookmarked
                        ? "Remove bookmark"
                        : "Bookmark this day"
                    }
                  >
                    <Heart
                      className={`h-3 w-3 ${
                        journal.draftBookmarked ? "text-red-500" : ""
                      }`}
                      fill={journal.draftBookmarked ? "currentColor" : "none"}
                    />
                    {journal.draftBookmarked ? "Saved!" : "Save"}
                  </button>
                </div>
              </div>
              <div className="h-4" />
            </div>
          </div>

          <DailyTasksList
            activities={activities}
            groups={groups}
            currentDate={currentDate}
          />
        </div>
      </div>

      {/* Fixed bottom bar */}
      {/* Settings button — independent fixed anchor */}
      <FloatingBackButton to="/settings" title="Settings" icon="settings" />

      {/* Date pill — centered */}
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
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
