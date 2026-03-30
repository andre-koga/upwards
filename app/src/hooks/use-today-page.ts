import { useJournalEntry } from "@/components/journal/hooks/use-journal-entry";
import { useJournalMeta } from "@/components/journal/hooks/use-journal-meta";
import { useTasksPageData } from "@/components/tasks/hooks/use-tasks-page-data";
import { useDailyTasks } from "@/components/tasks/hooks/use-daily-tasks";

export function useTodayPage(currentDate: Date) {
  const journal = useJournalEntry(currentDate);
  const { entryDates, bookmarkedDates, loadJournalMeta } = useJournalMeta();

  const { activities, groups, loading, refreshTrigger } = useTasksPageData({
    loadJournalEntry: journal.loadJournalEntry,
    loadJournalMeta,
  });

  const dailyTasks = useDailyTasks({
    activities,
    groups,
    currentDate,
    refreshTrigger,
  });

  return {
    journal,
    entryDates,
    bookmarkedDates,
    loadJournalMeta,
    activities,
    groups,
    loading,
    refreshTrigger,
    dailyTasks,
  };
}
