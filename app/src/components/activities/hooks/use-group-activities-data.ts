import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import { isHiddenGroupDefaultActivity } from "@/lib/activity-utils";
import { logError } from "@/lib/error-utils";

export function useGroupActivitiesData(group: ActivityGroup) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const data = await db.activities
        .filter(
          (a) =>
            a.group_id === group.id &&
            !a.is_archived &&
            !a.deleted_at &&
            !isHiddenGroupDefaultActivity(a)
        )
        .sortBy("created_at");
      setActivities(data);
    } catch (error) {
      logError("Error loading activities", error);
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  return { activities, loading, loadActivities };
}
