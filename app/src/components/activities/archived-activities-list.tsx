import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { PATTERN_OPTIONS } from "@/lib/colors";
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

function getPatternLabel(pattern: string | null) {
  return PATTERN_OPTIONS.find((p) => p.value === pattern)?.name ?? "Solid";
}

export default function ArchivedActivitiesList({
  activities,
  allGroups,
  onUnarchive,
  onDelete,
}: ArchivedActivitiesListProps) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No archived activities.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-center justify-between p-3 border rounded-md"
        >
          <div className="flex-1">
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
              Pattern: {getPatternLabel(activity.pattern)} • Routine:{" "}
              {formatRoutineDisplay(activity.routine)}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUnarchive(activity.id)}
              title="Unarchive activity"
            >
              <ArchiveRestore className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(activity.id)}
              title="Permanently delete activity"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
