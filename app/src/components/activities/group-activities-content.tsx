import { useState, useEffect, useCallback } from "react";
import { db, now } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import { X, Plus } from "lucide-react";
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
  isHiddenGroupDefaultActivity,
  stopCurrentActivity,
} from "@/lib/activity-utils";
import GroupActivitiesHeader from "@/components/activities/group-activities-header";
import GroupActivitiesList from "@/components/activities/group-activities-list";
import GroupActivitiesTimeline from "@/components/activities/group-activities-timeline";
import { useGroupActivityTracking } from "@/components/activities/hooks/use-group-activity-tracking";

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
  const { currentActivityId, getElapsedMs, toggleActivity } =
    useGroupActivityTracking();
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
          (a) =>
            a.group_id === group.id &&
            !a.is_archived &&
            !a.deleted_at &&
            !isHiddenGroupDefaultActivity(a),
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
      <GroupActivitiesHeader
        group={group}
        isArchived={isArchived}
        activityCount={activities.length}
        onEditGroup={() => navigate(`/activities/${group.id}/edit`)}
        onToggleArchiveGroup={handleArchiveGroup}
      />

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

        <GroupActivitiesList
          activities={activities}
          groupColor={group.color || "#888"}
          currentActivityId={currentActivityId}
          getElapsedMs={getElapsedMs}
          onToggleActivity={toggleActivity}
          onEditActivity={(activityId) =>
            navigate(`/activities/${group.id}/edit/${activityId}`)
          }
          onArchiveActivity={(activity) =>
            setArchiveDialog({
              open: true,
              activityId: activity.id,
              activityName: activity.name,
            })
          }
        />
      </div>

      {/* Timeline section */}
      <div className="mt-8 pt-6">
        <GroupActivitiesTimeline
          groupId={group.id}
          groupColor={group.color || "#888"}
        />
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
