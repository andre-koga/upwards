import { db, newId, now } from "@/lib/db";
import type { ActivityGroup } from "@/lib/db/types";
import { GroupDialogForm } from "@/components/activities/group-dialog-form";

interface NewGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (group: ActivityGroup) => void;
}

export function NewGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: NewGroupDialogProps) {
  return (
    <GroupDialogForm
      open={open}
      onOpenChange={onOpenChange}
      title="New Group"
      confirmLabel="Create Group"
      onSubmit={async ({ name, color }) => {
        const timestamp = now();
        const createdGroup: ActivityGroup = {
          id: newId(),
          name,
          color,
          is_archived: false,
          order_index: null,
          created_at: timestamp,
          updated_at: timestamp,
          synced_at: null,
          deleted_at: null,
        };
        await db.activityGroups.add(createdGroup);
        onCreated?.(createdGroup);
      }}
    />
  );
}
