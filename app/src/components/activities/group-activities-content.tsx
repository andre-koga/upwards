import { useState, useEffect } from "react";
import { db, now } from "@/lib/db";
import type { ActivityGroup } from "@/lib/db/types";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getActivityDisplayName } from "@/lib/activity-utils";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import GroupActivitiesHeader from "@/components/activities/group-activities-header";
import GroupActivitiesList from "@/components/activities/group-activities-list";
import GroupActivitiesTimeline from "@/components/activities/group-activities-timeline";
import { ActivityDialogForm } from "@/components/activities/activity-dialog-form";
import { ArchiveActivityDialog } from "@/components/activities/archive-activity-dialog";
import { EditGroupDialog } from "@/components/activities/edit-group-dialog";
import { useGroupActivityTracking } from "@/components/activities/hooks/use-group-activity-tracking";
import { useGroupActivitiesData } from "@/components/activities/hooks/use-group-activities-data";
import { FloatingBackButton } from "@/components/ui/floating-back-button";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/error-utils";

interface GroupActivitiesContentProps {
  group: ActivityGroup;
}

export default function GroupActivitiesContent({
  group,
}: GroupActivitiesContentProps) {
  const navigate = useNavigate();
  const [groupDetails, setGroupDetails] = useState(group);
  const [isArchived, setIsArchived] = useState(group.is_archived);
  const [editGroupDialogOpen, setEditGroupDialogOpen] = useState(false);
  const { activities, loading, loadActivities } = useGroupActivitiesData(group);
  const { currentActivityId, getElapsedMs, toggleActivity } =
    useGroupActivityTracking();
  const [archiveDialog, setArchiveDialog] = useState<{
    open: boolean;
    activityId: string | null;
    activityName: string | null;
  }>({ open: false, activityId: null, activityName: null });
  const [newActivityDialogOpen, setNewActivityDialogOpen] = useState(false);
  const [editActivityId, setEditActivityId] = useState<string | null>(null);

  // Sync local archive state when group prop changes (e.g. after navigation)
  useEffect(() => {
    setGroupDetails(group);
  }, [group]);

  useEffect(() => {
    setIsArchived(group.is_archived);
  }, [group.is_archived]);

  const handleArchiveGroup = async () => {
    try {
      const newArchiveStatus = !isArchived;
      setIsArchived(newArchiveStatus);
      const n = now();
      await db.activityGroups.update(groupDetails.id, {
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
        group={groupDetails}
        isArchived={isArchived}
        activityCount={activities.length}
        onEditGroup={() => setEditGroupDialogOpen(true)}
        onToggleArchiveGroup={handleArchiveGroup}
      />

      <div className="px-4 pt-6">
        <div className="mb-6 flex justify-center">
          <Button
            type="button"
            variant="outlineDashed"
            className="rounded-full px-4 py-2 text-sm"
            onClick={() => setNewActivityDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New Activity
          </Button>
        </div>

        <GroupActivitiesList
          activities={activities}
          group={groupDetails}
          groupColor={groupDetails.color || DEFAULT_GROUP_COLOR}
          currentActivityId={currentActivityId}
          getElapsedMs={getElapsedMs}
          onToggleActivity={toggleActivity}
          onEditActivity={(activityId) => setEditActivityId(activityId)}
          onArchiveActivity={(activity) =>
            setArchiveDialog({
              open: true,
              activityId: activity.id,
              activityName: getActivityDisplayName(activity, group),
            })
          }
        />
      </div>

      {/* Timeline section */}
      <div className="mt-8 pt-6">
        <GroupActivitiesTimeline
          groupId={groupDetails.id}
          groupName={groupDetails.name}
          groupColor={groupDetails.color || DEFAULT_GROUP_COLOR}
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

      <EditGroupDialog
        open={editGroupDialogOpen}
        onOpenChange={setEditGroupDialogOpen}
        group={groupDetails}
        onUpdated={(updatedGroup) => {
          setGroupDetails(updatedGroup);
        }}
      />

      <ActivityDialogForm
        open={newActivityDialogOpen}
        onOpenChange={setNewActivityDialogOpen}
        group={groupDetails}
        onSaved={() => {
          void loadActivities();
        }}
      />

      <ActivityDialogForm
        open={editActivityId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditActivityId(null);
        }}
        group={groupDetails}
        activity={activities.find((activity) => activity.id === editActivityId)}
        onSaved={() => {
          void loadActivities();
        }}
      />
    </div>
  );
}
