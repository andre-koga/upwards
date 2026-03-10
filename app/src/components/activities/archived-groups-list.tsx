import { ArchivedItemList } from "@/components/ui/archived-item-list";
import type { ActivityGroup } from "@/lib/db/types";

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
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: group.color || "#6b7280" }}
          />
          <span className="font-medium">{group.name}</span>
        </div>
      )}
    />
  );
}
