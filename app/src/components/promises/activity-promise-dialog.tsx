import type { Activity, ActivityGroup } from "@/lib/db/types";
import { getActivityDisplayName } from "@/lib/activity";
import { FormDialog } from "@/components/forms";

interface ActivityPromiseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity | null;
  group?: ActivityGroup;
}

export function ActivityPromiseDialog({
  open,
  onOpenChange,
  activity,
  group,
}: ActivityPromiseDialogProps) {
  const title = activity
    ? getActivityDisplayName(activity, group)
    : "Activity";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Promise settings coming soon."
    >
      <div className="min-h-[8rem]" />
    </FormDialog>
  );
}
