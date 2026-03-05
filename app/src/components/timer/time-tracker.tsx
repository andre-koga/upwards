import { useState, useEffect } from "react";
import { db, now, newId } from "@/lib/db";
import type { Activity, TimeEntry } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Square, Clock } from "lucide-react";

interface TimeTrackerProps {
  activities: Activity[];
  activeTimerId: string | null;
  onTimerStart: (activityId: string) => void;
  onTimerStop: () => void;
}

type TimeEntryWithActivity = TimeEntry & { activity?: Activity };

export default function TimeTracker({
  activities,
  onTimerStart,
  onTimerStop,
}: TimeTrackerProps) {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [recentEntries, setRecentEntries] = useState<TimeEntryWithActivity[]>(
    [],
  );

  const loadActiveEntry = async () => {
    try {
      const entry = await db.timeEntries
        .filter((e) => !e.time_end && !e.deleted_at)
        .first();
      setActiveEntry(entry || null);
      if (entry) onTimerStart(entry.activity_id);
    } catch (error) {
      console.error("Error loading active entry:", error);
    }
  };

  const loadRecentEntries = async () => {
    try {
      const entries = await db.timeEntries
        .filter((e) => !!e.time_end && !e.deleted_at)
        .reverse()
        .sortBy("time_start");
      const recent = entries.slice(0, 5);
      const withActivities: TimeEntryWithActivity[] = recent.map((entry) => ({
        ...entry,
        activity: activities.find((a) => a.id === entry.activity_id),
      }));
      setRecentEntries(withActivities);
    } catch (error) {
      console.error("Error loading recent entries:", error);
    }
  };

  useEffect(() => {
    loadActiveEntry();
    loadRecentEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (activeEntry) {
      interval = setInterval(() => {
        const start = new Date(activeEntry.time_start).getTime();
        setElapsedTime(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeEntry]);

  const startTimer = async (activityId: string) => {
    try {
      if (activeEntry) await stopTimer();
      const n = now();
      const id = newId();
      await db.timeEntries.add({
        id,
        activity_id: activityId,
        time_start: n,
        time_end: null,
        created_at: n,
        updated_at: n,
        synced_at: null,
        deleted_at: null,
      });
      const entry = await db.timeEntries.get(id);
      setActiveEntry(entry || null);
      onTimerStart(activityId);
    } catch (error) {
      console.error("Error starting timer:", error);
    }
  };

  const stopTimer = async () => {
    if (!activeEntry) return;
    try {
      const n = now();
      await db.timeEntries.update(activeEntry.id, {
        time_end: n,
        updated_at: n,
      });
      setActiveEntry(null);
      onTimerStop();
      loadRecentEntries();
    } catch (error) {
      console.error("Error stopping timer:", error);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const formatDuration = (start: string, end: string) => {
    const duration = Math.floor(
      (new Date(end).getTime() - new Date(start).getTime()) / 1000,
    );
    return formatTime(duration);
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
                      {new Date(entry.time_start).toLocaleTimeString()}
                    </span>
                    {entry.time_end && (
                      <span className="font-mono">
                        {formatDuration(entry.time_start, entry.time_end)}
                      </span>
                    )}
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
