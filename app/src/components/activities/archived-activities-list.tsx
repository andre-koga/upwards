import { Badge } from "@/components/ui/badge";
import { ArchivedItemList } from "@/components/ui/archived-item-list";
import {
  formatRoutineDisplay,
  getGroupName,
  getGroupColor,
} from "@/lib/activity-utils";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { DEFAULT_ARCHIVED_COLOR } from "@/lib/color-utils";

interface ArchivedActivitiesListProps {
  activities: Activity[];
  allGroups: ActivityGroup[];
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
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
                borderColor: getGroupColor(
                  allGroups,
                  activity.group_id,
                  DEFAULT_ARCHIVED_COLOR
                ),
              }}
            >
              {getGroupName(allGroups, activity.group_id)}
            </Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Routine: {formatRoutineDisplay(activity.routine)}
          </div>
        </>
      )}
    />
  );
}
