"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tables, TablesInsert } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Play, Square, Clock } from "lucide-react";

type Activity = Tables<"activities"> & { color?: string | null };
type TimeEntry = Tables<"time_entries">;

interface TimeTrackerProps {
  userId: string;
  activities: Activity[];
  activeTimerId: string | null;
  onTimerStart: (activityId: string) => void;
  onTimerStop: () => void;
}

export default function TimeTracker({
  userId,
  activities,
  activeTimerId,
  onTimerStart,
  onTimerStop,
}: TimeTrackerProps) {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [recentEntries, setRecentEntries] = useState<
    (TimeEntry & { activity?: Activity })[]
  >([]);

  const supabase = createClient();

  useEffect(() => {
    loadActiveEntry();
    loadRecentEntries();
  }, [userId]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (activeEntry) {
      interval = setInterval(() => {
        const start = new Date(activeEntry.time_start!).getTime();
        const now = new Date().getTime();
        setElapsedTime(Math.floor((now - start) / 1000));
      }, 1000);
    } else {
      setElapsedTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeEntry]);

  const loadActiveEntry = async () => {
    try {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", userId)
        .is("time_end", null)
        .order("time_start", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      setActiveEntry(data);
      if (data) {
        onTimerStart(data.activity_id);
      }
    } catch (error) {
      console.error("Error loading active entry:", error);
    }
  };

  const loadRecentEntries = async () => {
    try {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", userId)
        .not("time_end", "is", null)
        .order("time_start", { ascending: false })
        .limit(5);

      if (error) throw error;

      // Fetch activity details for each entry
      const entriesWithActivities = await Promise.all(
        (data || []).map(async (entry) => {
          const { data: activity } = await supabase
            .from("activities")
            .select("*")
            .eq("id", entry.activity_id)
            .single();

          return { ...entry, activity: activity || undefined };
        }),
      );

      setRecentEntries(entriesWithActivities);
    } catch (error) {
      console.error("Error loading recent entries:", error);
    }
  };

  const startTimer = async (activityId: string) => {
    try {
      // Stop any existing timer first
      if (activeEntry) {
        await stopTimer();
      }

      const insertPayload: TablesInsert<"time_entries"> = {
        user_id: userId,
        activity_id: activityId,
        time_start: new Date().toISOString(),
        time_end: null,
      };

      const { data, error } = await supabase
        .from("time_entries")
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      setActiveEntry(data);
      onTimerStart(activityId);
    } catch (error) {
      console.error("Error starting timer:", error);
    }
  };

  const stopTimer = async () => {
    if (!activeEntry) return;

    try {
      const { error } = await supabase
        .from("time_entries")
        .update({ time_end: new Date().toISOString() })
        .eq("id", activeEntry.id);

      if (error) throw error;

      setActiveEntry(null);
      onTimerStop();
      loadRecentEntries();
    } catch (error) {
      console.error("Error stopping timer:", error);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDuration = (start: string, end: string) => {
    const duration = Math.floor(
      (new Date(end).getTime() - new Date(start).getTime()) / 1000,
    );
    return formatTime(duration);
  };

  const getActivityName = (activityId: string) => {
    const activity = activities.find((a) => a.id === activityId);
    return activity?.name || "Unknown Activity";
  };

  const activeActivity = activeEntry
    ? activities.find((a) => a.id === activeEntry.activity_id)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Time Tracker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeEntry && activeActivity && (
          <div className="p-4 border-2 border-primary rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full animate-pulse"
                  style={{ backgroundColor: activeActivity.color || "#10b981" }}
                />
                <span className="font-medium">{activeActivity.name}</span>
              </div>
              <Button size="sm" onClick={stopTimer} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </div>
            <div className="text-3xl font-bold text-center tabular-nums">
              {formatTime(elapsedTime)}
            </div>
          </div>
        )}

        {!activeEntry && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Start tracking an activity:</p>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No activities available. Create some activities first!
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {activities.map((activity) => (
                  <Button
                    key={activity.id}
                    variant="outline"
                    onClick={() => startTimer(activity.id)}
                    className="justify-start"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: activity.color || "#10b981" }}
                      />
                      <span>{activity.name}</span>
                    </div>
                    <Play className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {recentEntries.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <p className="text-sm font-medium">Recent Entries</p>
            <div className="space-y-2">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-2 border rounded-md text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: entry.activity?.color || "#10b981",
                      }}
                    />
                    <span>{entry.activity?.name || "Unknown"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs">
                      {new Date(entry.time_start!).toLocaleTimeString()}
                    </span>
                    <span className="font-mono">
                      {formatDuration(entry.time_start!, entry.time_end!)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
