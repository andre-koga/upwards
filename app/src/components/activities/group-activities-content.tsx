import { useState, useEffect, useCallback } from "react";
import { db, now } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PATTERN_OPTIONS } from "@/lib/colors";
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

  useEffect(() => {
    setIsArchived(group.is_archived);
  }, [group.is_archived]);

  const getPatternDisplay = (pattern: string | null) => {
    if (!pattern) return null;
    const opt = PATTERN_OPTIONS.find((p) => p.value === pattern);
    return opt?.name || pattern;
  };

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
              <div
                key={activity.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="font-medium truncate">{activity.name}</span>
                  <div className="flex gap-1.5 shrink-0">
                    {activity.pattern && (
                      <Badge variant="secondary" className="text-xs">
                        {getPatternDisplay(activity.pattern)}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {formatRoutineDisplay(activity.routine)}
                    </Badge>
                  </div>
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
