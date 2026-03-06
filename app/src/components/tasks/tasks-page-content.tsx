import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import DailyTasksList from "@/components/tasks/daily-tasks-list";
import { useJournalEntry } from "@/components/tasks/hooks/use-journal-entry";
import JournalYoutubeSection from "@/components/tasks/journal-youtube-section";
import JournalMetaRow from "@/components/tasks/journal-meta-row";
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
    <div className="p-4 pb-28">
      <div className="max-w-2xl mx-auto space-y-4">
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

        <JournalMetaRow
          canEdit={journal.canEditJournal}
          emoji={journal.draftEmoji}
          emojiInput={journal.emojiInput}
          showEmojiInput={journal.showEmojiInput}
          bookmarked={journal.draftBookmarked}
          onEmojiInputChange={journal.setEmojiInput}
          onEmojiCommit={(val) => {
            journal.setDraftEmoji(val);
            journal.draftRef.current.emoji = val;
            journal.saveDraft();
          }}
          onShowEmojiInput={journal.setShowEmojiInput}
          onBookmarkToggle={() => {
            const next = !journal.draftBookmarked;
            journal.setDraftBookmarked(next);
            journal.draftRef.current.bookmarked = next;
            journal.saveDraft();
          }}
        />

        <DateNavigator
          currentDate={currentDate}
          onDateChange={setCurrentDate}
        />

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
  );
}
