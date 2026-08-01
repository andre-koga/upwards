import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { getActivityDisplayName } from "@/lib/activity";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { loadActivityStats } from "@/lib/stats";
import { useAsyncData } from "@/hooks/use-async-data";
import { FormDialog } from "@/components/forms/form-dialog";
import { ActivityStatsCore } from "@/components/stats/activity-stats-core";
import { Button } from "@/components/ui/button";

interface ActivityStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity | null;
  group: ActivityGroup | null | undefined;
}

export function ActivityStatsDialog({
  open,
  onOpenChange,
  activity,
  group,
}: ActivityStatsDialogProps) {
  const { t } = useTranslation("stats");
  const navigate = useNavigate();
  const {
    data: stats,
    loading,
    error,
  } = useAsyncData(
    () =>
      open && activity ? loadActivityStats(activity.id) : Promise.resolve(null),
    [open, activity]
  );

  const color = group?.color || DEFAULT_GROUP_COLOR;
  const displayName = getActivityDisplayName(activity, group);

  const handleViewFull = () => {
    if (!activity || !group) return;
    onOpenChange(false);
    navigate(`/stats/groups/${group.id}/activities/${activity.id}`);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          {displayName}
        </span>
      }
      contentClassName="sm:max-w-sm"
    >
      {loading && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Loading stats…
        </p>
      )}

      {!loading && error && (
        <p className="py-6 text-center text-sm text-destructive">
          {t("loadError")}
        </p>
      )}

      {!loading && stats && (
        <>
          <ActivityStatsCore stats={stats} color={color} />
          {group && (
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-full rounded-xl"
              onClick={handleViewFull}
            >
              View full stats
            </Button>
          )}
        </>
      )}
    </FormDialog>
  );
}
