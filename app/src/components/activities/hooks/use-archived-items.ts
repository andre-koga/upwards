import { useState, useEffect, useCallback } from "react";
import { db, now } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
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
        const n = now();
        await db.activityGroups.update(id, {
          is_archived: false,
          updated_at: n,
        });
        const activities = await db.activities
          .filter((a) => a.group_id === id && !a.deleted_at)
          .toArray();
        await Promise.all(
          activities.map((a) =>
            db.activities.update(a.id, { is_archived: false, updated_at: n })
          )
        );
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
        const activity = archivedActivities.find((a) => a.id === id);
        if (!activity) return;
        const n = now();
        const group = allGroups.find((g) => g.id === activity.group_id);
        if (group?.is_archived) {
          await db.activityGroups.update(group.id, {
            is_archived: false,
            updated_at: n,
          });
        }
        await db.activities.update(id, { is_archived: false, updated_at: n });
        loadArchivedItems();
      } catch (error) {
        logError("Error unarchiving activity", error);
      }
    },
    [archivedActivities, allGroups, loadArchivedItems]
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
