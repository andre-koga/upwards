"use client";

import { useState, useEffect, useCallback } from "react";
import { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import ActivityGroupsManager from "@/components/activities/activity-groups-manager";
import ActivitiesManager from "@/components/activities/activities-manager";
import DailyTasksList from "@/components/tasks/daily-tasks-list";
import TimeTracker from "@/components/timer/time-tracker";

type ActivityGroup = Tables<"activity_groups">;
type Activity = Tables<"activities">;

interface HabitTrackerDashboardProps {
  userId: string;
}

export default function HabitTrackerDashboard({
  userId,
}: HabitTrackerDashboardProps) {
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  // Map of groupId to group for quick lookup
  const groupMap = Object.fromEntries(groups.map((g) => [g.id, g]));
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load groups
      const { data: groupsData, error: groupsError } = await supabase
        .from("activity_groups")
        .select("*")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("created_at", { ascending: true });

      if (groupsError) throw groupsError;
      setGroups(groupsData || []);

      // Load activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("created_at", { ascending: true });

      if (activitiesError) throw activitiesError;
      setActivities(activitiesData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTimerStart = (activityId: string) => {
    setActiveTimerId(activityId);
  };

  const handleTimerStop = () => {
    setActiveTimerId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading your habit tracker...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">OKHabit Tracker</h1>
        <p className="text-muted-foreground">
          Track your habits, manage your time, and build better routines
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <ActivityGroupsManager
            userId={userId}
            groups={groups}
            onGroupsChange={loadData}
          />
          <ActivitiesManager
            userId={userId}
            groups={groups}
            activities={activities}
            onActivitiesChange={loadData}
            onStartTimer={handleTimerStart}
            activeTimerId={activeTimerId}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <TimeTracker
            userId={userId}
            activities={activities.map((a) => ({
              ...a,
              color: groupMap[a.group_id]?.color || undefined,
            }))}
            activeTimerId={activeTimerId}
            onTimerStart={handleTimerStart}
            onTimerStop={handleTimerStop}
          />
          <DailyTasksList
            userId={userId}
            activities={activities}
            groups={groups}
            onRefresh={loadData}
          />
        </div>
      </div>
    </div>
  );
}
