"use client";

import { useState, useEffect, useCallback } from "react";
import { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import ActivityGroupsManager from "@/components/activities/activity-groups-manager";
import ActivitiesManager from "@/components/activities/activities-manager";

type ActivityGroup = Tables<"activity_groups">;
type Activity = Tables<"activities">;

interface ActivitiesPageContentProps {
  userId: string;
}

export default function ActivitiesPageContent({
  userId,
}: ActivitiesPageContentProps) {
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [groupsData, activitiesData] = await Promise.all([
        supabase
          .from("activity_groups")
          .select("*")
          .eq("user_id", userId)
          .eq("is_archived", false)
          .order("created_at", { ascending: true }),
        supabase
          .from("activities")
          .select("*")
          .eq("user_id", userId)
          .eq("is_archived", false)
          .order("created_at", { ascending: true }),
      ]);

      if (groupsData.error) throw groupsData.error;
      if (activitiesData.error) throw activitiesData.error;

      setGroups(groupsData.data || []);
      setActivities(activitiesData.data || []);
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

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Activities</h1>
          <p className="text-muted-foreground">
            Manage your activity groups and activities
          </p>
        </div>
        <div className="space-y-4">
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
          />
        </div>
      </div>
    </div>
  );
}
