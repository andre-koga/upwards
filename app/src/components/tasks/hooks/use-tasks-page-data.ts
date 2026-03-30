import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  isActiveActivity,
  isActiveGroup,
  sortActivitiesByOrder,
} from "@/lib/activity";
import { logError } from "@/lib/error-utils";
import { syncEngine } from "@/lib/sync";

export interface UseTasksPageDataOptions {
  loadJournalEntry: (opts?: { background?: boolean }) => Promise<void>;
  loadJournalMeta: () => Promise<void>;
}

export function useTasksPageData({
  loadJournalEntry,
  loadJournalMeta,
}: UseTasksPageDataOptions) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const prevSyncingRef = useRef(false);

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

  const loadDataInBackground = useCallback(async () => {
    try {
      const [loadedActivities, g] = await Promise.all([
        db.activities.filter((a) => isActiveActivity(a)).toArray(),
        db.activityGroups.filter((g) => isActiveGroup(g)).sortBy("created_at"),
      ]);
      setActivities(sortActivitiesByOrder(loadedActivities));
      setGroups(g);
    } catch (error) {
      logError("Error loading data", error);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      const wasSyncing = prevSyncingRef.current;
      prevSyncingRef.current = state.isSyncing;
      if (wasSyncing && !state.isSyncing) {
        void (async () => {
          await loadDataInBackground();
          await loadJournalEntry({ background: true });
          await loadJournalMeta();
          setRefreshTrigger((t) => t + 1);
        })();
      }
    });
    return unsubscribe;
  }, [loadDataInBackground, loadJournalEntry, loadJournalMeta]);

  return {
    activities,
    groups,
    loading,
    refreshTrigger,
  };
}
