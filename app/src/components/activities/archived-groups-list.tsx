import { ArchivedItemList } from "@/components/ui/archived-item-list";
import type { ActivityGroup } from "@/lib/db/types";
import { DEFAULT_ARCHIVED_COLOR } from "@/lib/color-utils";

interface ArchivedGroupsListProps {
  groups: ActivityGroup[];
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ArchivedGroupsList({
  groups,
  onUnarchive,
  onDelete,
}: ArchivedGroupsListProps) {
  return (
    <ArchivedItemList<ActivityGroup>
      items={groups}
      emptyMessage="No archived groups."
      getItemId={(g) => g.id}
      onUnarchive={onUnarchive}
      onDelete={onDelete}
      unarchiveTitle="Unarchive group"
      deleteTitle="Permanently delete group"
      renderItemContent={(group) => (
        <div className="flex items-center gap-3">
          <div
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: group.color || DEFAULT_ARCHIVED_COLOR }}
          />
          <span className="font-medium">{group.name}</span>
        </div>
      )}
    />
  );
}
