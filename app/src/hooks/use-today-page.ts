import { useJournalEntry } from "@/components/journal/hooks/use-journal-entry";
import { useJournalMeta } from "@/components/journal/hooks/use-journal-meta";
import { useTasksPageData } from "@/components/tasks/hooks/use-tasks-page-data";
import { useDailyTasks } from "@/components/tasks/hooks/use-daily-tasks";

export function useTodayPage(currentDate: Date) {
  const journal = useJournalEntry(currentDate);
  const { entryDates, bookmarkedDates, loadJournalMeta } = useJournalMeta();

  const {
    activities,
    lookupActivities,
    groups,
    lookupGroups,
    lookupActivityById,
    lookupGroupById,
    activityEventsById,
    groupEventsById,
    loading,
    refreshTrigger,
    refreshTasksData,
  } = useTasksPageData({
    loadJournalEntry: journal.loadJournalEntry,
    loadJournalMeta,
  });

  const dailyTasks = useDailyTasks({
    activities,
    lookupActivities,
    groups,
    lookupGroups,
    lookupActivityById,
    lookupGroupById,
    activityEventsById,
    groupEventsById,
    currentDate,
    refreshTrigger,
  });

  return {
    journal,
    entryDates,
    bookmarkedDates,
    loadJournalMeta,
    activities,
    lookupActivities,
    groups,
    lookupGroups,
    loading,
    refreshTrigger,
    dailyTasks,
    refreshTasksData,
  };
}
