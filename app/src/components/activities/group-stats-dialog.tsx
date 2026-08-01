import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ActivityGroup } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { loadGroupStats } from "@/lib/stats";
import { useAsyncData } from "@/hooks/use-async-data";
import { FormDialog } from "@/components/forms/form-dialog";
import { GroupStatsCore } from "@/components/stats/group-stats-core";
import { Button } from "@/components/ui/button";

interface GroupStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ActivityGroup | null;
}

export function GroupStatsDialog({
  open,
  onOpenChange,
  group,
}: GroupStatsDialogProps) {
  const { t } = useTranslation("stats");
  const navigate = useNavigate();
  const {
    data: stats,
    loading,
    error,
  } = useAsyncData(
    () => (open && group ? loadGroupStats(group.id) : Promise.resolve(null)),
    [open, group]
  );

  const color = group?.color || DEFAULT_GROUP_COLOR;

  const handleViewFull = () => {
    if (!group) return;
    onOpenChange(false);
    navigate(`/stats/groups/${group.id}`);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        group ? (
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            {group.name}
          </span>
        ) : (
          "Group stats"
        )
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
          <GroupStatsCore stats={stats} color={color} />
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full rounded-xl"
            onClick={handleViewFull}
          >
            View full stats
          </Button>
        </>
      )}
    </FormDialog>
  );
}
