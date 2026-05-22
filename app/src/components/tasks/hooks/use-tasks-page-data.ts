import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { db } from "@/lib/db";
import type {
  Activity,
  ActivityGroup,
  ActivityStatusEvent,
  GroupStatusEvent,
} from "@/lib/db/types";
import {
  isActiveGroup,
  sortActivitiesByOrder,
  buildGroupById,
  filterActiveActivities,
  buildActivityEventsByEntityId,
  buildGroupEventsByEntityId,
  loadAllActivityStatusEvents,
  loadAllGroupStatusEvents,
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
  /** All habits including soft-deleted/completed — for historical timeline labels. */
  const [lookupActivities, setLookupActivities] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [lookupGroups, setLookupGroups] = useState<ActivityGroup[]>([]);
  const [activityStatusEvents, setActivityStatusEvents] = useState<
    ActivityStatusEvent[]
  >([]);
  const [groupStatusEvents, setGroupStatusEvents] = useState<GroupStatusEvent[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const prevSyncingRef = useRef(false);
  const prevLocalDataVersionRef = useRef(syncEngine.getState().localDataVersion);

  const activityEventsById = useMemo(
    () => buildActivityEventsByEntityId(activityStatusEvents),
    [activityStatusEvents]
  );
  const groupEventsById = useMemo(
    () => buildGroupEventsByEntityId(groupStatusEvents),
    [groupStatusEvents]
  );
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
      const [
        allActivities,
        allGroups,
        activeGroups,
        actEvents,
        grpEvents,
      ] = await Promise.all([
        db.activities.toArray(),
        db.activityGroups.toArray(),
        db.activityGroups.filter((g) => isActiveGroup(g)).sortBy("created_at"),
        loadAllActivityStatusEvents(),
        loadAllGroupStatusEvents(),
      ]);
      const groupById = buildGroupById(activeGroups);
      setLookupActivities(sortActivitiesByOrder(allActivities));
      setActivities(
        sortActivitiesByOrder(
          filterActiveActivities(
            allActivities.filter((a) => !a.deleted_at && !a.completed_at),
            groupById
          )
        )
      );
      setLookupGroups(allGroups);
      setGroups(activeGroups);
      setActivityStatusEvents(actEvents);
      setGroupStatusEvents(grpEvents);
    } catch (error) {
      logError("Error loading data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDataInBackground = useCallback(async () => {
    try {
      const [
        allActivities,
        allGroups,
        activeGroups,
        actEvents,
        grpEvents,
      ] = await Promise.all([
        db.activities.toArray(),
        db.activityGroups.toArray(),
        db.activityGroups.filter((g) => isActiveGroup(g)).sortBy("created_at"),
        loadAllActivityStatusEvents(),
        loadAllGroupStatusEvents(),
      ]);
      const groupById = buildGroupById(activeGroups);
      setLookupActivities(sortActivitiesByOrder(allActivities));
      setActivities(
        sortActivitiesByOrder(
          filterActiveActivities(
            allActivities.filter((a) => !a.deleted_at && !a.completed_at),
            groupById
          )
        )
      );
      setLookupGroups(allGroups);
      setGroups(activeGroups);
      setActivityStatusEvents(actEvents);
      setGroupStatusEvents(grpEvents);
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

      if (state.localDataVersion !== prevLocalDataVersionRef.current) {
        prevLocalDataVersionRef.current = state.localDataVersion;
        void (async () => {
          await loadData();
          await loadJournalEntry({ background: true });
          await loadJournalMeta();
          setRefreshTrigger((t) => t + 1);
        })();
        return;
      }

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
    activityEventsById,
    groupEventsById,
    lookupActivityById,
    lookupGroupById,
    loading,
    refreshTrigger,
    refreshTasksData,
  };
}
