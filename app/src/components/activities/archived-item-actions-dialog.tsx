import { useState } from "react";
import { ArchiveRestore } from "lucide-react";
import { FormDialog, FormDialogActions } from "@/components/forms";
import { dialogPrimaryDestructiveClassName } from "@/components/forms/styles";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { logError } from "@/lib/error-utils";
import { unarchiveActivityById, unarchiveGroupById } from "@/lib/activity";

export type ArchivedItemActionsTarget =
  | { type: "group"; group: ActivityGroup }
  | { type: "activity"; activity: Activity; group: ActivityGroup };

interface ArchivedItemActionsDialogProps {
  target: ArchivedItemActionsTarget | null;
  onOpenChange: (open: boolean) => void;
  onUnarchived: (target: ArchivedItemActionsTarget) => void | Promise<void>;
  onDeleteRequested: (payload: {
    type: "group" | "activity";
    id: string;
  }) => void;
}

export function ArchivedItemActionsDialog({
  target,
  onOpenChange,
  onUnarchived,
  onDeleteRequested,
}: ArchivedItemActionsDialogProps) {
  const [busy, setBusy] = useState(false);

  const open = target !== null;
  const isGroup = target?.type === "group";

  const handleUnarchive = async () => {
    if (!target) return;
    const current = target;
    setBusy(true);
    try {
      if (current.type === "group") {
        await unarchiveGroupById(current.group.id);
      } else {
        await unarchiveActivityById(current.activity.id);
      }
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
    if (target.type === "group") {
      onDeleteRequested({ type: "group", id: target.group.id });
    } else {
      onDeleteRequested({ type: "activity", id: target.activity.id });
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        if (!next) onOpenChange(false);
      }}
      title={isGroup ? "Archived group" : "Archived activity"}
      description={
        isGroup
          ? "Unarchive to use it again, or delete the group and all its activities permanently."
          : "Unarchive to use it again, or delete this activity permanently."
      }
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
