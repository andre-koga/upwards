"use client";

import { useState, useEffect, useCallback } from "react";
import { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import TimeTracker from "@/components/timer/time-tracker";

type Activity = Tables<"activities">;

interface TimerPageContentProps {
  userId: string;
}

export default function TimerPageContent({ userId }: TimerPageContentProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error("Error loading activities:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleTimerStart = (activityId: string) => {
    setActiveTimerId(activityId);
  };

  const handleTimerStop = () => {
    setActiveTimerId(null);
  };

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
        userId={userId}
        activities={activities}
        activeTimerId={activeTimerId}
        onTimerStart={handleTimerStart}
        onTimerStop={handleTimerStop}
      />
    </div>
  );
}
