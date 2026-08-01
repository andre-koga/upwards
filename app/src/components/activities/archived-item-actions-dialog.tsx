import { useState } from "react";
import { ArchiveRestore } from "lucide-react";
import { FormDialog, FormDialogActions } from "@/components/forms";
import { dialogPrimaryDestructiveClassName } from "@/components/forms/styles";
import type { ActivityGroup } from "@/lib/db/types";
import { logError } from "@/lib/error-utils";
import { unarchiveGroupById } from "@/lib/activity";

export type ArchivedItemActionsTarget = { type: "group"; group: ActivityGroup };

interface ArchivedItemActionsDialogProps {
  target: ArchivedItemActionsTarget | null;
  onOpenChange: (open: boolean) => void;
  onUnarchived: (target: ArchivedItemActionsTarget) => void | Promise<void>;
  onDeleteRequested: (payload: { type: "group"; id: string }) => void;
}

export function ArchivedItemActionsDialog({
  target,
  onOpenChange,
  onUnarchived,
  onDeleteRequested,
}: ArchivedItemActionsDialogProps) {
  const [busy, setBusy] = useState(false);

  const open = target !== null;

  const handleUnarchive = async () => {
    if (!target) return;
    const current = target;
    setBusy(true);
    try {
      await unarchiveGroupById(current.group.id);
      await Promise.resolve(onUnarchived(current));
      onOpenChange(false);
    } catch (error) {
      logError("Error unarchiving", error);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClick = () => {
    if (!target) return;
    onOpenChange(false);
    onDeleteRequested({ type: "group", id: target.group.id });
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        if (!next) onOpenChange(false);
      }}
      title="Archived group"
      description="Unarchive to use it again, or delete the group and all its activities permanently."
      contentClassName="sm:max-w-md"
    >
      <FormDialogActions
        onConfirm={handleDeleteClick}
        confirmLabel="Delete"
        confirmDisabled={busy}
        confirmClassName={dialogPrimaryDestructiveClassName}
        secondaryAction={{
          label: (
            <>
              <ArchiveRestore className="h-4 w-4 shrink-0" aria-hidden />
              Unarchive
            </>
          ),
          onClick: () => void handleUnarchive(),
          disabled: busy,
        }}
      />
    </FormDialog>
  );
}
