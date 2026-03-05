import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/db";
import type { Activity } from "@/lib/db/types";
import TimeTracker from "@/components/timer/time-tracker";

export default function TimerPageContent() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const data = await db.activities
        .filter((a) => !a.is_archived && !a.deleted_at)
        .sortBy("created_at");
      setActivities(data);
    } catch (error) {
      console.error("Error loading activities:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <TimeTracker
        activities={activities}
        activeTimerId={activeTimerId}
        onTimerStart={(id) => setActiveTimerId(id)}
        onTimerStop={() => setActiveTimerId(null)}
      />
    </div>
  );
}
