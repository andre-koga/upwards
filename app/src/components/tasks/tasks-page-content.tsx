import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import DailyTasksList from "@/components/tasks/daily-tasks-list";

export default function TasksPageContent() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const dateLabel = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  const encouragements = [
    "Every small step counts — make today yours.",
    "A new day, a fresh chance. Let's do this.",
    "You showed up. Now let's finish strong.",
    "Today is yours to shape. One task at a time.",
    "Progress over perfection — keep going.",
  ];
  const encouragement = encouragements[now.getDate() % encouragements.length];

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-1">
            {dateLabel}
          </p>
          <h1 className="text-5xl font-extrabold tracking-tight mb-3">
            {dayName}
          </h1>
          <p className="text-muted-foreground text-base italic">
            {encouragement}
          </p>
        </div>
        <DailyTasksList
          activities={activities}
          groups={groups}
          onRefresh={loadData}
        />
      </div>
    </div>
  );
}
