import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import {
  unarchiveActivityById,
  unarchiveGroupById,
} from "@/lib/activity";
import { logError } from "@/lib/error-utils";

export function useArchivedItems() {
  const [archivedGroups, setArchivedGroups] = useState<ActivityGroup[]>([]);
  const [archivedActivities, setArchivedActivities] = useState<Activity[]>([]);
  const [allGroups, setAllGroups] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadArchivedItems = useCallback(async () => {
    try {
      setLoading(true);
      const [archivedG, archivedA, allG] = await Promise.all([
        db.activityGroups
          .filter((g) => !!g.is_archived && !g.deleted_at)
          .sortBy("created_at"),
        db.activities
          .filter((a) => !!a.is_archived && !a.deleted_at)
          .sortBy("created_at"),
        db.activityGroups.filter((g) => !g.deleted_at).sortBy("created_at"),
      ]);
      setArchivedGroups(archivedG);
      setArchivedActivities(archivedA);
      setAllGroups(allG);
    } catch (error) {
      logError("Error loading archived items", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArchivedItems();
  }, [loadArchivedItems]);

  const handleUnarchiveGroup = useCallback(
    async (id: string) => {
      try {
        await unarchiveGroupById(id);
        loadArchivedItems();
      } catch (error) {
        logError("Error unarchiving group", error);
      }
    },
    [loadArchivedItems]
  );

  const handleUnarchiveActivity = useCallback(
    async (id: string) => {
      try {
        await unarchiveActivityById(id);
        loadArchivedItems();
      } catch (error) {
        logError("Error unarchiving activity", error);
      }
    },
    [loadArchivedItems]
  );

  return {
    archivedGroups,
    archivedActivities,
    allGroups,
    loading,
    loadArchivedItems,
    handleUnarchiveGroup,
    handleUnarchiveActivity,
  };
}
