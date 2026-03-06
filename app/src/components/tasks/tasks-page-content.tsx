import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Settings, Bookmark, BookmarkCheck } from "lucide-react";
import { db } from "@/lib/db";
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

  const journal = useJournalEntry(currentDate);
  const { loadJournalEntry } = journal;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [a, g] = await Promise.all([
        db.activities
          .filter((a) => !a.is_archived && !a.deleted_at)
          .sortBy("created_at"),
        db.activityGroups
          .filter((g) => !g.is_archived && !g.deleted_at)
          .sortBy("created_at"),
      ]);
      setActivities(a);
      setGroups(g);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadJournalEntry();
  }, [loadJournalEntry]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const embedUrl = getYoutubeEmbedUrl(journal.draftYoutubeUrl);

  return (
    <div className="pb-20">
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
      <div className="flex justify-center -mt-10 relative z-10">
        <div className="relative">
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
                placeholder="＋"
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
          ) : (
            journal.draftEmoji && (
              <span className="text-5xl w-20 h-20 flex items-center justify-center rounded-full bg-background shadow-md">
                {journal.draftEmoji}
              </span>
            )
          )}

          {/* Bookmark badge — top-right of emoji */}
          {journal.canEditJournal && (
            <button
              onClick={() => {
                const next = !journal.draftBookmarked;
                journal.setDraftBookmarked(next);
                journal.draftRef.current.bookmarked = next;
                journal.saveDraft();
              }}
              className={`absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors ${
                journal.draftBookmarked
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={
                journal.draftBookmarked
                  ? "Remove bookmark"
                  : "Bookmark this day"
              }
            >
              {journal.draftBookmarked ? (
                <BookmarkCheck className="h-3 w-3" />
              ) : (
                <Bookmark className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
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

          <div className="border-t border-border pt-2" />

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
        />
      </div>
    </div>
  );
}
