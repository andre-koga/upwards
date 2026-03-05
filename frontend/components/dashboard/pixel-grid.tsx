"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tables } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Sun, Moon, Square } from "lucide-react";

type Activity = Tables<"activities">;
type DailyEntry = Tables<"daily_entries">;
type ActivityPeriod = Tables<"activity_periods">;
type ActivityGroup = Tables<"activity_groups">;

interface MinuteData {
  activity_id: string;
  color: string;
}

interface PixelGridProps {
  userId: string;
}

export default function PixelGrid({ userId }: PixelGridProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAwake, setIsAwake] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [dailyEntry, setDailyEntry] = useState<DailyEntry | null>(null);
  const [activityPeriods, setActivityPeriods] = useState<
    (ActivityPeriod & { color: string })[]
  >([]);
  const [currentPeriod, setCurrentPeriod] = useState<ActivityPeriod | null>(
    null,
  );
  const [currentTime, setCurrentTime] = useState(new Date());
  const [typicalWakeTime, setTypicalWakeTime] = useState("07:00:00");
  const [typicalSleepTime, setTypicalSleepTime] = useState("23:00:00");

  const supabase = createClient();

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load activities and daily entry
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await loadUserPreferences();
      await loadGroups();
      await loadActivities();
      await loadTodayEntry();
      setIsLoading(false);
    };
    loadData();
  }, [userId]);

  // Reload periods when groups change
  useEffect(() => {
    if (dailyEntry) {
      loadActivityPeriods(dailyEntry.id);
    }
  }, [groups, dailyEntry]);
  const loadUserPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("typical_wake_time, typical_sleep_time")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error loading user preferences:", error);
        return;
      }

      if (data) {
        setTypicalWakeTime(data.typical_wake_time ?? "07:00:00");
        setTypicalSleepTime(data.typical_sleep_time ?? "23:00:00");
      }
    } catch (error) {
      // Silently use defaults if preferences can't be loaded
      console.log("Using default wake/sleep times for new user");
    }
  };
  const loadGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("activity_groups")
        .select("*")
        .eq("user_id", userId)
        .order("name");

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error("Error loading groups:", error);
    }
  };

  const loadActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("name");

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error("Error loading activities:", error);
    }
  };

  const loadTodayEntry = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("daily_entries")
        .select("*")
        .eq("user_id", userId)
        .gte("date", today.toISOString())
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDailyEntry(data);
        setIsAwake(data.is_awake || false);

        // Load current activity if awake
        if (data.current_activity_id) {
          const { data: activity } = await supabase
            .from("activities")
            .select("*")
            .eq("id", data.current_activity_id)
            .eq("is_archived", false)
            .maybeSingle();

          if (activity) {
            setCurrentActivity(activity);
          } else {
            // Current activity is archived, clear it
            await supabase
              .from("daily_entries")
              .update({ current_activity_id: null })
              .eq("id", data.id);
            setCurrentActivity(null);
          }
        }
      }
    } catch (error) {
      console.error("Error loading today's entry:", error);
    }
  };

  const loadActivityPeriods = async (dailyEntryId: string) => {
    try {
      const { data, error } = await supabase
        .from("activity_periods")
        .select(
          `
          *,
          activities!inner(group_id)
        `,
        )
        .eq("daily_entry_id", dailyEntryId)
        .order("start_time");

      if (error) throw error;

      const periodsWithColor = (data || []).map((period: any) => {
        const group = groups.find((g) => g.id === period.activities.group_id);
        return {
          ...period,
          color: group?.color || "#cccccc",
        };
      });

      setActivityPeriods(periodsWithColor);

      // Find the current open period (end_time is null)
      const openPeriod = periodsWithColor.find((p) => !p.end_time);
      setCurrentPeriod(openPeriod || null);
    } catch (error) {
      console.error("Error loading activity periods:", error);
    }
  };

  const getGroupColor = (activity: Activity): string => {
    const group = groups.find((g) => g.id === activity.group_id);
    return group?.color || "#cccccc";
  };

  const stopCurrentActivity = async () => {
    if (!dailyEntry || !currentPeriod) return;

    try {
      const now = new Date();

      // Close the current activity period
      const { error: periodError } = await supabase
        .from("activity_periods")
        .update({ end_time: now.toISOString() })
        .eq("id", currentPeriod.id);

      if (periodError) throw periodError;

      // Clear current activity on daily entry
      const { error } = await supabase
        .from("daily_entries")
        .update({ current_activity_id: null })
        .eq("id", dailyEntry.id);

      if (error) throw error;

      setCurrentActivity(null);
      setCurrentPeriod(null);
      await loadActivityPeriods(dailyEntry.id);
    } catch (error) {
      console.error("Error stopping activity:", error);
    }
  };

  const handleWakeUp = async () => {
    try {
      const now = new Date();

      // Create today's entry with no activity set
      const { data: newEntry, error: entryError } = await supabase
        .from("daily_entries")
        .insert({
          user_id: userId,
          date: now.toISOString(),
          wake_time: now.toISOString(),
          is_awake: true,
          current_activity_id: null,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      setDailyEntry(newEntry);
      setIsAwake(true);
      setCurrentActivity(null);
      setCurrentPeriod(null);
    } catch (error) {
      console.error("Error waking up:", error);
    }
  };

  const handleGoToSleep = async () => {
    if (!dailyEntry) return;

    try {
      const now = new Date();

      // Close the current activity period if one exists
      if (currentPeriod) {
        const { error: periodError } = await supabase
          .from("activity_periods")
          .update({ end_time: now.toISOString() })
          .eq("id", currentPeriod.id);

        if (periodError) throw periodError;
      }

      // Update daily entry
      const { error } = await supabase
        .from("daily_entries")
        .update({
          sleep_time: now.toISOString(),
          is_awake: false,
          current_activity_id: null,
        })
        .eq("id", dailyEntry.id);

      if (error) throw error;

      setIsAwake(false);
      setCurrentActivity(null);
      setCurrentPeriod(null);
      await loadActivityPeriods(dailyEntry.id);

      // Open journal page in new tab
      const today = new Date().toISOString().split("T")[0];
      window.open(`/journal/${today}`, "_blank");
    } catch (error) {
      console.error("Error going to sleep:", error);
    }
  };

  const switchActivity = async (activity: Activity) => {
    if (!dailyEntry || !isAwake) return;
    if (activity.id === currentActivity?.id) return; // Same activity

    try {
      const now = new Date();

      // Close the current period if one exists
      if (currentPeriod) {
        const { error: closeError } = await supabase
          .from("activity_periods")
          .update({ end_time: now.toISOString() })
          .eq("id", currentPeriod.id);

        if (closeError) throw closeError;
      }

      // Create new period
      const { data: newPeriod, error: periodError } = await supabase
        .from("activity_periods")
        .insert({
          user_id: userId,
          daily_entry_id: dailyEntry.id,
          activity_id: activity.id,
          start_time: now.toISOString(),
          end_time: null,
        })
        .select()
        .single();

      if (periodError) throw periodError;

      // Update current activity
      const { error } = await supabase
        .from("daily_entries")
        .update({ current_activity_id: activity.id })
        .eq("id", dailyEntry.id);

      if (error) throw error;

      setCurrentActivity(activity);
      setCurrentPeriod(newPeriod);
      await loadActivityPeriods(dailyEntry.id);
    } catch (error) {
      console.error("Error switching activity:", error);
    }
  };

  // Calculate which activity (if any) was active at a specific time
  // If multiple activities exist in the minute, show the one with majority coverage
  const getActivityAtTime = (
    hour: number,
    minute: number,
  ): MinuteData | null => {
    if (!dailyEntry?.wake_time) return null;

    // Define the minute boundaries
    const minuteStart = new Date(dailyEntry.date!);
    minuteStart.setHours(hour, minute, 0, 0);
    const minuteEnd = new Date(minuteStart);
    minuteEnd.setMinutes(minuteEnd.getMinutes() + 1);

    const minuteStartTime = minuteStart.getTime();
    const minuteEndTime = minuteEnd.getTime();

    // Check if this time is within wake/sleep bounds
    const wakeTime = new Date(dailyEntry.wake_time).getTime();
    const sleepTime = dailyEntry.sleep_time
      ? new Date(dailyEntry.sleep_time).getTime()
      : Date.now();

    if (minuteStartTime < wakeTime || minuteStartTime > sleepTime) {
      return null;
    }

    // Find all periods that overlap with this minute and calculate their duration
    const overlappingActivities: {
      activity_id: string;
      color: string;
      duration: number;
    }[] = [];

    for (const period of activityPeriods) {
      const periodStart = new Date(period.start_time).getTime();
      const periodEnd = period.end_time
        ? new Date(period.end_time).getTime()
        : Date.now();

      // Check if period overlaps with this minute
      if (periodEnd > minuteStartTime && periodStart < minuteEndTime) {
        // Calculate overlap duration
        const overlapStart = Math.max(periodStart, minuteStartTime);
        const overlapEnd = Math.min(periodEnd, minuteEndTime);
        const overlapDuration = overlapEnd - overlapStart;

        overlappingActivities.push({
          activity_id: period.activity_id,
          color: period.color || "#cccccc",
          duration: overlapDuration,
        });
      }
    }

    // Return the activity with the longest duration in this minute
    if (overlappingActivities.length > 0) {
      const majorityActivity = overlappingActivities.reduce((prev, current) =>
        current.duration > prev.duration ? current : prev,
      );
      return {
        activity_id: majorityActivity.activity_id,
        color: majorityActivity.color,
      };
    }

    return null;
  };

  // Get color for a specific grid cell
  const getCellColor = (hour: number, minute: number): string => {
    const minuteData = getActivityAtTime(hour, minute);
    if (minuteData) {
      return minuteData.color;
    }

    // Highlight current minute if awake
    const now = currentTime;
    if (
      isAwake &&
      hour === now.getHours() &&
      minute === now.getMinutes() &&
      currentActivity
    ) {
      return getGroupColor(currentActivity);
    }

    // Empty cells: darker outside typical wake/sleep hours, lighter within
    // Convert time strings to minutes since midnight for comparison
    const timeToMinutes = (timeStr: string): number => {
      const [h, m] = timeStr.split(":").map(Number);
      return h * 60 + m;
    };

    const currentMinutes = hour * 60 + minute;
    const wakeMinutes = timeToMinutes(typicalWakeTime);
    const sleepMinutes = timeToMinutes(typicalSleepTime);

    let isOutsideActiveHours: boolean;

    if (sleepMinutes < wakeMinutes) {
      // Night owl: sleep time is after midnight (e.g., wake at 10 AM, sleep at 2 AM)
      // Active hours: sleepMinutes to wakeMinutes (e.g., 2 AM to 10 AM is sleep time)
      isOutsideActiveHours =
        currentMinutes >= sleepMinutes && currentMinutes < wakeMinutes;
    } else {
      // Normal schedule: sleep time is before midnight (e.g., wake at 7 AM, sleep at 11 PM)
      // Active hours: wakeMinutes to sleepMinutes (e.g., 7 AM to 11 PM)
      isOutsideActiveHours =
        currentMinutes < wakeMinutes || currentMinutes >= sleepMinutes;
    }

    return isOutsideActiveHours
      ? "hsl(var(--muted) / 0.6)" // Darker for sleep time
      : "hsl(var(--muted) / 0.2)"; // Lighter for potential active time
  };

  // Check if this is the current minute
  const isCurrentMinute = (hour: number, minute: number): boolean => {
    if (!isAwake) return false;
    const now = currentTime;
    return hour === now.getHours() && minute === now.getMinutes();
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-center p-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header with Wake Up / Sleep button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" suppressHydrationWarning>
            {currentTime.toLocaleDateString()}
          </h1>
          <p className="text-muted-foreground" suppressHydrationWarning>
            {currentTime.toLocaleTimeString()}
          </p>
        </div>

        {!isAwake ? (
          <Button
            size="lg"
            onClick={handleWakeUp}
            className="gap-2"
            disabled={activities.length === 0}
          >
            <Sun className="h-5 w-5" />
            Wake Up
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handleGoToSleep}
            variant="destructive"
            className="gap-2"
          >
            <Moon className="h-5 w-5" />
            Go to Sleep
          </Button>
        )}
      </div>

      {/* Current Activity Display */}
      {isAwake && (
        <Card>
          <CardContent className="p-4">
            {currentActivity ? (
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: getGroupColor(currentActivity) }}
                />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">
                    Current Activity
                  </p>
                  <p className="font-semibold text-lg">
                    {currentActivity.name}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={stopCurrentActivity}
                >
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                No activity running. Pick one below to start tracking.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 24x60 Pixel Grid */}
      <Card>
        <CardContent className="p-2">
          <div className="space-y-[1px]">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour}>
                <div className="flex gap-[1px]">
                  {Array.from({ length: 60 }, (_, minute) => (
                    <div
                      key={`${hour}-${minute}`}
                      className={`flex-1 h-3 rounded-full border border-border/20 ${
                        isCurrentMinute(hour, minute)
                          ? "ring-1 ring-primary"
                          : ""
                      }`}
                      style={{
                        backgroundColor: getCellColor(hour, minute),
                      }}
                      title={`${hour}:${minute.toString().padStart(2, "0")}`}
                    />
                  ))}
                </div>
                {/* Add thicker spacing after hours 5, 11, and 17 */}
                {(hour === 5 || hour === 11 || hour === 17) && (
                  <div className="h-1" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity Switcher */}
      {isAwake && activities.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Switch Activity</h3>
            <div className="grid grid-cols-2 gap-2">
              {activities.map((activity) => (
                <Button
                  key={activity.id}
                  onClick={() => switchActivity(activity)}
                  variant={
                    currentActivity?.id === activity.id ? "default" : "outline"
                  }
                  className="gap-2 justify-start"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getGroupColor(activity) }}
                  />
                  <span className="truncate">{activity.name}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup message if no activities */}
      {activities.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
              You need to create some activities first before you can start
              tracking your day!
            </p>
            <Button asChild>
              <a href="/activities">Create Activities</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
