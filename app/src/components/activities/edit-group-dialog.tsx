import { db, now } from "@/lib/db";
import type { ActivityGroup } from "@/lib/db/types";
import { GroupDialogForm } from "@/components/activities/group-dialog-form";

interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ActivityGroup;
  onUpdated?: (group: ActivityGroup) => void;
}

export function EditGroupDialog({
  open,
  onOpenChange,
  group,
  onUpdated,
}: EditGroupDialogProps) {
  return (
    <GroupDialogForm
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Group"
      confirmLabel="Save Changes"
      initialData={{
        name: group.name,
        color: group.color ?? "#3b82f6",
      }}
      onSubmit={async ({ name, color }) => {
        const updatedAt = now();
        await db.activityGroups.update(group.id, {
          name,
          color,
          updated_at: updatedAt,
        });
        onUpdated?.({
          ...group,
          name,
          color,
          updated_at: updatedAt,
        });
      }}
    />
  );
}
