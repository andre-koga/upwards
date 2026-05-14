import { useState } from "react";
import { ArchiveRestore } from "lucide-react";
import { FormDialog, FormDialogActions } from "@/components/forms";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { logError } from "@/lib/error-utils";
import { unarchiveActivityById, unarchiveGroupById } from "@/lib/activity";

export type ArchivedItemActionsTarget =
  | { type: "group"; group: ActivityGroup }
  | { type: "activity"; activity: Activity };

interface ArchivedItemActionsDialogProps {
  target: ArchivedItemActionsTarget | null;
  onOpenChange: (open: boolean) => void;
  onUnarchived: (target: ArchivedItemActionsTarget) => void | Promise<void>;
  onDeleteRequested: (payload: {
    type: "group" | "activity";
    id: string;
  }) => void;
}

const destructiveConfirmClassName =
  "bg-destructive text-destructive-foreground shadow-md hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,black)] dark:hover:bg-[color-mix(in_srgb,hsl(var(--destructive))_88%,white)] focus-visible:ring-destructive";

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
    const id =
      target.type === "group" ? target.group.id : target.activity.id;
    const type = target.type;
    onOpenChange(false);
    onDeleteRequested({ type, id });
  };

  const title =
    target?.type === "group"
      ? "Archived group"
      : target?.type === "activity"
        ? "Archived activity"
        : "Archived item";

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        if (!next) onOpenChange(false);
      }}
      title={title}
      description="Unarchive to use it again on the Today screen, or delete it permanently."
      contentClassName="sm:max-w-md"
    >
      <FormDialogActions
        onConfirm={handleDeleteClick}
        confirmLabel="Delete"
        confirmDisabled={busy}
        confirmClassName={destructiveConfirmClassName}
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
