import { useState, useEffect, useCallback } from "react";
import { db, now } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  stopCurrentActivity,
  formatRoutineDisplay,
} from "@/lib/activity-utils";
import ActivityPill from "@/components/activities/activity-pill";

interface GroupActivitiesContentProps {
  group: ActivityGroup;
}

export default function GroupActivitiesContent({
  group,
}: GroupActivitiesContentProps) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isArchived, setIsArchived] = useState(group.is_archived);
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(
    null,
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerTick, setTimerTick] = useState(0);
  const [, setTick] = useState(0);
  const [archiveDialog, setArchiveDialog] = useState<{
    open: boolean;
    activityId: string | null;
    activityName: string | null;
  }>({ open: false, activityId: null, activityName: null });

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const data = await db.activities
        .filter(
          (a) => a.group_id === group.id && !a.is_archived && !a.deleted_at,
        )
        .sortBy("created_at");
      setActivities(data);
    } catch (error) {
      console.error("Error loading activities:", error);
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Drive per-second re-renders while an activity is running
  useEffect(() => {
    if (!currentActivityId) return;
    const interval = setInterval(() => setTimerTick((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [currentActivityId]);

  // Calculate elapsed time for the current activity
  useEffect(() => {
    if (!currentActivityId) {
      setElapsedMs(0);
      return;
    }

    const calculateTime = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const dailyEntry = await db.dailyEntries
          .where("date")
          .equals(today)
          .filter((e) => !e.deleted_at)
          .first();

        if (!dailyEntry) {
          setElapsedMs(0);
          return;
        }

        const periods = await db.activityPeriods
          .where("daily_entry_id")
          .equals(dailyEntry.id)
          .filter((p) => p.activity_id === currentActivityId && !p.deleted_at)
          .toArray();

        let totalMs = 0;
        periods.forEach((period) => {
          const start = new Date(period.start_time).getTime();
          const end = period.end_time
            ? new Date(period.end_time).getTime()
            : Date.now();
          totalMs += end - start;
        });

        setElapsedMs(totalMs);
      } catch (error) {
        console.error("Error calculating elapsed time:", error);
      }
    };

    calculateTime();
  }, [currentActivityId, timerTick]);

  useEffect(() => {
    setIsArchived(group.is_archived);
  }, [group.is_archived]);

  const handleArchiveActivity = async () => {
    if (!archiveDialog.activityId) return;
    try {
      await stopCurrentActivity({ activityId: archiveDialog.activityId });
      const n = now();
      await db.activities.update(archiveDialog.activityId, {
        is_archived: true,
        updated_at: n,
      });
      setArchiveDialog({ open: false, activityId: null, activityName: null });
      await loadActivities();
    } catch (error) {
      console.error("Error archiving activity:", error);
    }
  };

  const handleArchiveGroup = async () => {
    try {
      const newArchiveStatus = !isArchived;
      setIsArchived(newArchiveStatus);
      const n = now();
      await db.activityGroups.update(group.id, {
        is_archived: newArchiveStatus,
        updated_at: n,
      });
    } catch (error) {
      console.error("Error archiving group:", error);
      // Revert on error
      setIsArchived(!isArchived);
    }
  };

  const handleStartStopActivity = useCallback(
    async (activityId: string) => {
      if (currentActivityId === activityId) {
        // Stop the activity
        try {
          const today = new Date().toISOString().split("T")[0];
          const dailyEntry = await db.dailyEntries
            .where("date")
            .equals(today)
            .filter((e) => !e.deleted_at)
            .first();

          if (dailyEntry) {
            const currentPeriod = await db.activityPeriods
              .where("daily_entry_id")
              .equals(dailyEntry.id)
              .filter((p) => !p.end_time && !p.deleted_at)
              .first();

            if (currentPeriod) {
              const n = new Date().toISOString();
              await db.activityPeriods.update(currentPeriod.id, {
                end_time: n,
                updated_at: n,
              });
            }

            await db.dailyEntries.update(dailyEntry.id, {
              current_activity_id: null,
              updated_at: new Date().toISOString(),
            });
          }

          setCurrentActivityId(null);
          setElapsedMs(0);
        } catch (error) {
          console.error("Error stopping activity:", error);
        }
      } else {
        // Start the activity
        try {
          const today = new Date().toISOString().split("T")[0];
          const n = new Date().toISOString();

          // Get or create daily entry
          let dailyEntry = await db.dailyEntries
            .where("date")
            .equals(today)
            .filter((e) => !e.deleted_at)
            .first();

          if (!dailyEntry) {
            dailyEntry = {
              id: Math.random().toString(36).substr(2, 9),
              date: today,
              task_counts: null,
              current_activity_id: null,
              created_at: n,
              updated_at: n,
              synced_at: null,
              deleted_at: null,
            };
            await db.dailyEntries.add(dailyEntry);
          }

          if (!dailyEntry) return;

          // Stop any currently running activity
          if (currentActivityId) {
            const currentPeriod = await db.activityPeriods
              .where("daily_entry_id")
              .equals(dailyEntry.id)
              .filter((p) => !p.end_time && !p.deleted_at)
              .first();
            if (currentPeriod) {
              await db.activityPeriods.update(currentPeriod.id, {
                end_time: n,
                updated_at: n,
              });
            }
          }

          // Start new activity
          const newPeriod = {
            id: Math.random().toString(36).substr(2, 9),
            daily_entry_id: dailyEntry.id,
            activity_id: activityId,
            start_time: n,
            end_time: null,
            created_at: n,
            updated_at: n,
            synced_at: null,
            deleted_at: null,
          };
          await db.activityPeriods.add(newPeriod);

          await db.dailyEntries.update(dailyEntry.id, {
            current_activity_id: activityId,
            updated_at: n,
          });

          setCurrentActivityId(activityId);
        } catch (error) {
          console.error("Error starting activity:", error);
        }
      }
    },
    [currentActivityId],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="pb-20 overflow-y-scroll">
      {/* Full-bleed gradient banner with edit button and title */}
      <div className="relative w-full h-40">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${group.color || "#888"} 0%, transparent 100%)`,
          }}
        />
        {/* Bottom fade into background */}
        <div className="absolute bottom-0 left-0 right-0 h-1/5 bg-gradient-to-b from-transparent to-background pointer-events-none" />
        {/* Group title — positioned in the fade zone */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-full px-4 text-center">
          {isArchived && (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Archived
            </p>
          )}
          <h1 className="text-3xl font-bold">{group.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activities.length}{" "}
            {activities.length === 1 ? "activity" : "activities"}
          </p>
        </div>
        {/* Archive button — below edit button */}
        <div className="absolute -bottom-12 right-3 z-20">
          <button
            onClick={handleArchiveGroup}
            className="h-7 w-7 flex items-center border border-muted justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background transition-colors"
            title={isArchived ? "Unarchive group" : "Archive group"}
          >
            {isArchived ? (
              <ArchiveRestore className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Archive className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
        {/* Edit button */}
        <div className="absolute -bottom-4 right-3 z-20">
          <button
            onClick={() => navigate(`/activities/${group.id}/edit`)}
            className="h-7 w-7 flex items-center border border-muted justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background transition-colors"
            title="Edit group"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="mb-6" />

      <div className="px-4">
        <div className="flex justify-center mb-6">
          <button
            onClick={() => navigate(`/activities/${group.id}/new`)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm"
          >
            <Plus className="h-4 w-4" />
            New Activity
          </button>
        </div>

        {activities.length === 0 ? null : (
          <div className="space-y-2">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <ActivityPill
                    name={activity.name}
                    color={group.color || "#888"}
                    isRunning={currentActivityId === activity.id}
                    elapsedMs={
                      currentActivityId === activity.id ? elapsedMs : undefined
                    }
                    onClick={() => handleStartStopActivity(activity.id)}
                  />
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      navigate(`/activities/${group.id}/edit/${activity.id}`)
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setArchiveDialog({
                        open: true,
                        activityId: activity.id,
                        activityName: activity.name,
                      })
                    }
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed floating back button */}
      <button
        onClick={() => navigate("/")}
        className="fixed bottom-6 left-6 z-50 h-10 w-10 border border-border flex items-center justify-center rounded-full bg-background shadow-md text-muted-foreground hover:text-foreground transition-colors"
        title="Back to home"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <AlertDialog
        open={archiveDialog.open}
        onOpenChange={(open) =>
          !open &&
          setArchiveDialog({
            open: false,
            activityId: null,
            activityName: null,
          })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{archiveDialog.activityName}"?
              This will remove it from your active activities list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveActivity}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
