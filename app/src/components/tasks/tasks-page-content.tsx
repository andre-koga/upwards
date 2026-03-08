import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Settings,
  Heart,
  MapPin,
  MapPinOff,
  Flame,
  Hash,
  RotateCw,
} from "lucide-react";
import { db, toDateStr } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import DailyTasksList from "@/components/tasks/daily-tasks-list";
import { useJournalEntry } from "@/components/tasks/hooks/use-journal-entry";
import JournalYoutubeSection from "@/components/tasks/journal-youtube-section";
import JournalTextSection from "@/components/tasks/journal-text-section";
import DateNavigator from "@/components/tasks/date-navigator";

function getYoutubeEmbedUrl(url: string): string | null {
  if (!url.trim()) return null;
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;
  const long = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (long) return `https://www.youtube.com/embed/${long[1]}`;
  const embed = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
  if (embed) return `https://www.youtube.com/embed/${embed[1]}`;
  return null;
}

function getFirstEmoji(str: string): string {
  if (!str) return "";
  const emojiRegex = /\p{Extended_Pictographic}/u;
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  for (const { segment } of segmenter.segment(str)) {
    if (emojiRegex.test(segment)) return segment;
  }
  return "";
}

export default function TasksPageContent() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [entryDates, setEntryDates] = useState<Set<string>>(new Set());
  const [bookmarkedDates, setBookmarkedDates] = useState<Set<string>>(
    new Set(),
  );
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationInputVal, setLocationInputVal] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isJournalLoaded, setIsJournalLoaded] = useState(false);
  const hasTriedGeoRef = useRef(false);

  const journal = useJournalEntry(currentDate);
  const { loadJournalEntry } = journal;

  const isToday = toDateStr(currentDate) === toDateStr(new Date());

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [loadedActivities, g] = await Promise.all([
        db.activities.filter((a) => !a.is_archived && !a.deleted_at).toArray(),
        db.activityGroups
          .filter((g) => !g.is_archived && !g.deleted_at)
          .sortBy("created_at"),
      ]);

      const a = loadedActivities.sort((left, right) => {
        const leftOrder =
          typeof left.order_index === "number"
            ? left.order_index
            : Number.POSITIVE_INFINITY;
        const rightOrder =
          typeof right.order_index === "number"
            ? right.order_index
            : Number.POSITIVE_INFINITY;

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return (
          new Date(left.created_at).getTime() -
          new Date(right.created_at).getTime()
        );
      });

      setActivities(a);
      setGroups(g);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadJournalMeta = useCallback(async () => {
    try {
      const entries = await db.journalEntries
        .filter((e) => !e.deleted_at)
        .toArray();
      setEntryDates(new Set(entries.map((e) => e.entry_date)));
      setBookmarkedDates(
        new Set(
          entries.filter((e) => e.is_bookmarked).map((e) => e.entry_date),
        ),
      );
    } catch (err) {
      console.error("Error loading journal meta:", err);
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
    // reset geo attempt when date changes so we re-try on today
    hasTriedGeoRef.current = false;
    void loadJournalEntry().finally(() => {
      setIsJournalLoaded(true);
    });
  }, [loadJournalEntry]);

  const detectLocation = useCallback(
    (force = false) => {
      if (!isToday) return;
      if (!navigator.geolocation) return;
      if (isDetectingLocation) return;
      if (!force) {
        if (!isJournalLoaded) return;
        if (journal.draftLocation) return;
        if (hasTriedGeoRef.current) return;
      }

      hasTriedGeoRef.current = true;
      setIsDetectingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            );
            const data = (await res.json()) as {
              address: {
                city?: string;
                town?: string;
                village?: string;
                county?: string;
                state?: string;
                country?: string;
                country_code?: string;
              };
            };
            const city =
              data.address.city ||
              data.address.town ||
              data.address.village ||
              data.address.county ||
              null;
            if (city) {
              const locationData = {
                displayName: city,
                city,
                state: data.address.state ?? null,
                country: data.address.country ?? null,
                countryCode: data.address.country_code ?? null,
                lat: latitude,
                lon: longitude,
              };
              journal.setDraftLocation(locationData);
              journal.draftRef.current.location = locationData;
              journal.saveLocation(locationData);
            }
          } catch (e) {
            console.error("Reverse geocoding failed", e);
          } finally {
            setIsDetectingLocation(false);
          }
        },
        () => {
          setIsDetectingLocation(false);
        },
        { timeout: 10000, maximumAge: 5 * 60 * 1000 },
      );
    },
    [isToday, isDetectingLocation, isJournalLoaded, journal],
  );

  // Auto-detect location for today if not already set
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
    journal.draftYoutubeUrl.trim(),
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
      <div className="flex justify-center -mt-10 relative z-10 pointer-events-none">
        <div className="relative pointer-events-auto">
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
                className="w-20 h-20 text-center text-5xl placeholder:text-xl placeholder:text-muted-foreground rounded-full bg-background shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            ) : (
              <button
                onClick={() => journal.setShowEmojiInput(true)}
                className="text-5xl w-20 h-20 flex items-center justify-center rounded-full bg-background shadow-md"
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
            <span className="text-5xl w-20 h-20 flex items-center justify-center rounded-full bg-background shadow-md">
              {journal.draftEmoji}
            </span>
          ) : (
            <span className="w-20 h-20 flex items-center justify-center rounded-full bg-background shadow-md" />
          )}

          {/* Bookmark badge — top-right of emoji */}
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="max-w-2xl mx-auto space-y-3">
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
                  <span className="font-medium pt-0.5">
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
                            c.toUpperCase(),
                          ),
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
                      className="w-28 px-2 py-1 rounded-full bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <div className="flex items-center bg-background rounded-full pr-1">
                      <button
                        onClick={() => {
                          setLocationInputVal(
                            journal.draftLocation?.displayName ?? "",
                          );
                          setShowLocationInput(true);
                        }}
                        className="flex items-center gap-1 pl-3 py-1 rounded-full bg-background text-xs text-muted-foreground hover:text-foreground transition-colors"
                        title="Set location"
                      >
                        {isDetectingLocation || journal.draftLocation ? (
                          <>
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[80px]">
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
                          className="h-6 w-6 mb-0.5 inline-flex items-center justify-center rounded-full bg-background text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
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
                  <span className="font-crimson text-xl uppercase tracking-widest text-muted-foreground/70 bg-background px-2">
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
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-background text-xs text-muted-foreground transition-colors ${
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
      <Link
        to="/settings"
        className="fixed bottom-6 left-6 z-50 h-10 w-10 border border-border flex items-center justify-center rounded-full bg-background shadow-md text-muted-foreground hover:text-foreground transition-colors"
        title="Settings"
      >
        <Settings className="h-3.5 w-3.5" />
      </Link>

      {/* Date pill — centered */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
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
