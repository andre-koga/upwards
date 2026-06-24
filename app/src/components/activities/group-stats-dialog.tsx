import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ActivityGroup } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { loadGroupStats, type GroupStats } from "@/lib/stats";
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
  const navigate = useNavigate();
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [loading, setLoading] = useState(false);

  const color = group?.color || DEFAULT_GROUP_COLOR;

  useEffect(() => {
    if (!open || !group) {
      setStats(null);
      return;
    }
    setLoading(true);
    loadGroupStats(group.id)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, group]);

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
        <p className="py-6 text-center text-sm text-muted-foreground">Loading stats…</p>
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
