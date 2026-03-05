"use client";

import { useState, useEffect, useCallback } from "react";
import { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import DailyTasksList from "@/components/tasks/daily-tasks-list";

type Activity = Tables<"activities">;
type ActivityGroup = Tables<"activity_groups">;

interface TasksPageContentProps {
  userId: string;
}

export default function TasksPageContent({ userId }: TasksPageContentProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [activitiesRes, groupsRes] = await Promise.all([
        supabase
          .from("activities")
          .select("*")
          .eq("user_id", userId)
          .eq("is_archived", false)
          .order("created_at", { ascending: true }),
        supabase
          .from("activity_groups")
          .select("*")
          .eq("user_id", userId)
          .eq("is_archived", false),
      ]);

      if (activitiesRes.error) throw activitiesRes.error;
      if (groupsRes.error) throw groupsRes.error;

      setActivities(activitiesRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

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
          userId={userId}
          activities={activities}
          groups={groups}
          onRefresh={loadData}
        />
      </div>
    </div>
  );
}
