import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { db } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  isActiveGroup,
  isActivityArchived,
  sortActivitiesByOrder,
  buildGroupById,
  filterActiveActivities,
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
  /** Active habits for picker / new tracking (current state). */
  const [activities, setActivities] = useState<Activity[]>([]);
  /** All habits including soft-deleted/archived — for historical timeline labels. */
  const [lookupActivities, setLookupActivities] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [lookupGroups, setLookupGroups] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const prevSyncingRef = useRef(false);

  const lookupActivityById = useMemo(
    () => new Map(lookupActivities.map((a) => [a.id, a])),
    [lookupActivities]
  );
  const lookupGroupById = useMemo(
    () => buildGroupById(lookupGroups),
    [lookupGroups]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [allActivities, allGroups, activeGroups] = await Promise.all([
        db.activities.toArray(),
        db.activityGroups.toArray(),
        db.activityGroups.filter((g) => isActiveGroup(g)).sortBy("created_at"),
      ]);
      const groupById = buildGroupById(activeGroups);
      setLookupActivities(sortActivitiesByOrder(allActivities));
      setActivities(
        sortActivitiesByOrder(
          filterActiveActivities(
            allActivities.filter(
              (a) => !a.deleted_at && !isActivityArchived(a)
            ),
            groupById
          )
        )
      );
      setLookupGroups(allGroups);
      setGroups(activeGroups);
    } catch (error) {
      logError("Error loading data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDataInBackground = useCallback(async () => {
    try {
      const [allActivities, allGroups, activeGroups] = await Promise.all([
        db.activities.toArray(),
        db.activityGroups.toArray(),
        db.activityGroups.filter((g) => isActiveGroup(g)).sortBy("created_at"),
      ]);
      const groupById = buildGroupById(activeGroups);
      setLookupActivities(sortActivitiesByOrder(allActivities));
      setActivities(
        sortActivitiesByOrder(
          filterActiveActivities(
            allActivities.filter(
              (a) => !a.deleted_at && !isActivityArchived(a)
            ),
            groupById
          )
        )
      );
      setLookupGroups(allGroups);
      setGroups(activeGroups);
    } catch (error) {
      logError("Error loading data", error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => loadData())
      .catch(() => {
        if (!cancelled) {
          // loadData already logs errors
        }
      });
    return () => {
      cancelled = true;
    };
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
  }, [loadData, loadDataInBackground, loadJournalEntry, loadJournalMeta]);

  const refreshTasksData = useCallback(async () => {
    await loadDataInBackground();
    setRefreshTrigger((t) => t + 1);
  }, [loadDataInBackground]);

  return {
    activities,
    lookupActivities,
    groups,
    lookupGroups,
    lookupActivityById,
    lookupGroupById,
    loading,
    refreshTrigger,
    refreshTasksData,
  };
}
