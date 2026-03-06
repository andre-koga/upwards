import { Button } from "@/components/ui/button";
import { ArchiveRestore, Trash2 } from "lucide-react";
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
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No archived groups.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div
          key={group.id}
          className="flex items-center justify-between p-3 border rounded-md"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: group.color || "#6b7280" }}
            />
            <span className="font-medium">{group.name}</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUnarchive(group.id)}
              title="Unarchive group"
            >
              <ArchiveRestore className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onDelete(group.id)}
              title="Permanently delete group"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
