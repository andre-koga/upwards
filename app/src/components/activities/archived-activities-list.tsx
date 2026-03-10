import { Badge } from "@/components/ui/badge";
import { ArchivedItemList } from "@/components/ui/archived-item-list";
import { formatRoutineDisplay } from "@/lib/activity-utils";
import type { Activity, ActivityGroup } from "@/lib/db/types";

interface ArchivedActivitiesListProps {
  activities: Activity[];
  allGroups: ActivityGroup[];
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}

function getGroupName(groups: ActivityGroup[], groupId: string) {
  return groups.find((g) => g.id === groupId)?.name ?? "Unknown";
}

function getGroupColor(groups: ActivityGroup[], groupId: string) {
  return groups.find((g) => g.id === groupId)?.color ?? "#6b7280";
}

export default function ArchivedActivitiesList({
  activities,
  allGroups,
  onUnarchive,
  onDelete,
}: ArchivedActivitiesListProps) {
  return (
    <ArchivedItemList<Activity>
      items={activities}
      emptyMessage="No archived activities."
      getItemId={(a) => a.id}
      onUnarchive={onUnarchive}
      onDelete={onDelete}
      unarchiveTitle="Unarchive activity"
      deleteTitle="Permanently delete activity"
      renderItemContent={(activity) => (
        <>
          <div className="flex items-center gap-2">
            <span className="font-medium">{activity.name}</span>
            <Badge
              variant="outline"
              className="text-xs"
              style={{
                borderColor: getGroupColor(allGroups, activity.group_id),
              }}
            >
              {getGroupName(allGroups, activity.group_id)}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Routine: {formatRoutineDisplay(activity.routine)}
          </div>
        </>
      )}
    />
  );
}
