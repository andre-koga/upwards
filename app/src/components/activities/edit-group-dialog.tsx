import { useState } from "react";
import { Archive } from "lucide-react";
import { now } from "@/lib/db";
import type { ActivityGroup } from "@/lib/db/types";
import { GroupDialogForm } from "@/components/activities/group-dialog-form";
import { ArchiveGroupDialog } from "@/components/activities/archive-group-dialog";
import { Button } from "@/components/ui/button";
import { patchActivityGroup } from "@/lib/sync/mutate-synced";

interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ActivityGroup;
  onUpdated?: (group: ActivityGroup) => void;
  onArchived?: () => void;
}

export function EditGroupDialog({
  open,
  onOpenChange,
  group,
  onUpdated,
  onArchived,
}: EditGroupDialogProps) {
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  const handleFormOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setArchiveConfirmOpen(false);
    onOpenChange(nextOpen);
  };

  return (
    <>
      <GroupDialogForm
        open={open}
        onOpenChange={handleFormOpenChange}
        title="Edit Group"
        confirmLabel="Save Changes"
        initialData={{
          name: group.name,
          color: group.color ?? "#3b82f6",
        }}
        headerEnd={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full border-destructive text-destructive"
            onClick={() => setArchiveConfirmOpen(true)}
            title="Archive group"
            aria-label="Archive group"
          >
            <Archive className="h-4 w-4" aria-hidden />
          </Button>
        }
        onSubmit={async ({ name, color }) => {
          const updatedAt = now();
          const updated: ActivityGroup = {
            ...group,
            name,
            emoji: null,
            color,
            updated_at: updatedAt,
          };
          await patchActivityGroup(group.id, {
            name,
            emoji: null,
            color,
            updated_at: updatedAt,
          });
          onUpdated?.(updated);
        }}
      />

      <ArchiveGroupDialog
        open={open && archiveConfirmOpen}
        groupId={group.id}
        groupName={group.name}
        onOpenChange={setArchiveConfirmOpen}
        cancelLabel="No"
        confirmLabel="Yes"
        onArchived={() => {
          setArchiveConfirmOpen(false);
          onOpenChange(false);
          onArchived?.();
        }}
      />
    </>
  );
}
