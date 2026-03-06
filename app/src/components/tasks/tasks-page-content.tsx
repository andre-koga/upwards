import { useState, useEffect, useCallback } from "react";
import { db, toDateStr, now as dbNow, newId } from "@/lib/db";
import type { Activity, ActivityGroup, JournalEntry } from "@/lib/db/types";
import DailyTasksList from "@/components/tasks/daily-tasks-list";

export interface JournalFields {
  title: string | null;
  text_content: string | null;
  day_quality: number | null;
  day_emoji: string | null;
  is_bookmarked: boolean;
  youtube_url: string | null;
}

export default function TasksPageContent() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);

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

  const loadJournalEntry = useCallback(async () => {
    const dateStr = toDateStr(currentDate);
    try {
      setJournalLoading(true);
      const entry = await db.journalEntries
        .where("entry_date")
        .equals(dateStr)
        .filter((e) => !e.deleted_at)
        .first();
      setJournalEntry(entry ?? null);
    } catch (error) {
      console.error("Error loading journal entry:", error);
    } finally {
      setJournalLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadJournalEntry();
  }, [loadJournalEntry]);

  const canEditJournal = (() => {
    const todayMidnight = new Date(toDateStr(new Date()) + "T00:00:00");
    const entryMidnight = new Date(toDateStr(currentDate) + "T00:00:00");
    const diffDays = Math.floor(
      (todayMidnight.getTime() - entryMidnight.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return diffDays <= 1;
  })();

  const saveJournalEntry = useCallback(
    async (fields: JournalFields) => {
      const dateStr = toDateStr(currentDate);
      const n = dbNow();
      try {
        const existing = await db.journalEntries
          .where("entry_date")
          .equals(dateStr)
          .filter((e) => !e.deleted_at)
          .first();

        if (existing) {
          await db.journalEntries.update(existing.id, {
            ...fields,
            updated_at: n,
          });
          setJournalEntry({ ...existing, ...fields, updated_at: n });
        } else {
          const entry: JournalEntry = {
            id: newId(),
            entry_date: dateStr,
            ...fields,
            created_at: n,
            updated_at: n,
            synced_at: null,
            deleted_at: null,
          };
          await db.journalEntries.add(entry);
          setJournalEntry(entry);
        }
      } catch (error) {
        console.error("Error saving journal entry:", error);
      }
    },
    [currentDate],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const dayName = currentDate.toLocaleDateString("en-US", { weekday: "long" });
  const dateLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-1">
            {dayName}
          </p>
          <h1 className="text-5xl font-extrabold tracking-tight mb-3">
            {dateLabel}
          </h1>
        </div>
        <DailyTasksList
          activities={activities}
          groups={groups}
          onRefresh={loadData}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          journalEntry={journalEntry}
          journalLoading={journalLoading}
          canEditJournal={canEditJournal}
          onJournalSave={saveJournalEntry}
        />
      </div>
    </div>
  );
}
