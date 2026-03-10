import { useState, useEffect } from "react";
import { db, now } from "@/lib/db";
import type { ActivityGroup } from "@/lib/db/types";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import GroupActivitiesHeader from "@/components/activities/group-activities-header";
import GroupActivitiesList from "@/components/activities/group-activities-list";
import GroupActivitiesTimeline from "@/components/activities/group-activities-timeline";
import { ArchiveActivityDialog } from "@/components/activities/archive-activity-dialog";
import { useGroupActivityTracking } from "@/components/activities/hooks/use-group-activity-tracking";
import { useGroupActivitiesData } from "@/components/activities/hooks/use-group-activities-data";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { logError } from "@/lib/error-utils";

interface GroupActivitiesContentProps {
  group: ActivityGroup;
}

export default function GroupActivitiesContent({
  group,
}: GroupActivitiesContentProps) {
  const navigate = useNavigate();
  const [isArchived, setIsArchived] = useState(group.is_archived);
  const { activities, loading, loadActivities } = useGroupActivitiesData(group);
  const { currentActivityId, getElapsedMs, toggleActivity } =
    useGroupActivityTracking();
  const [archiveDialog, setArchiveDialog] = useState<{
    open: boolean;
    activityId: string | null;
    activityName: string | null;
  }>({ open: false, activityId: null, activityName: null });

  // Sync local archive state when group prop changes (e.g. after navigation)
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with group prop */
    setIsArchived(group.is_archived);
  }, [group.is_archived]);

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
      logError("Error archiving group", error);
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
    <div className="overflow-y-scroll pb-20">
      <GroupActivitiesHeader
        group={group}
        isArchived={isArchived}
        activityCount={activities.length}
        onEditGroup={() => navigate(`/activities/${group.id}/edit`)}
        onToggleArchiveGroup={handleArchiveGroup}
      />

      <div className="mb-6" />

      <div className="px-4">
        <div className="mb-6 flex justify-center">
          <button
            onClick={() => navigate(`/activities/${group.id}/new`)}
            className="flex items-center gap-2 rounded-full border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            New Activity
          </button>
        </div>

        <GroupActivitiesList
          activities={activities}
          groupColor={group.color || DEFAULT_GROUP_COLOR}
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
          groupColor={group.color || DEFAULT_GROUP_COLOR}
        />
      </div>

      {/* Fixed floating back button */}
      <FloatingBackButton onClick={() => navigate("/")} title="Back to home" />

      <ArchiveActivityDialog
        open={archiveDialog.open}
        activityId={archiveDialog.activityId}
        activityName={archiveDialog.activityName}
        onOpenChange={(open) =>
          !open &&
          setArchiveDialog({
            open: false,
            activityId: null,
            activityName: null,
          })
        }
        onArchived={loadActivities}
      />
    </div>
  );
}
