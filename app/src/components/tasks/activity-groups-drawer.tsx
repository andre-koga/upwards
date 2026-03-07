import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import { getOrCreateHiddenGroupDefaultActivity } from "@/lib/activity-utils";
import GroupPill from "@/components/activities/group-pill";

interface ActivityGroupsDrawerProps {
  currentActivityId?: string | null;
  activities?: Activity[];
  onStartActivity?: (activityId: string) => void | Promise<void>;
  onStopActivity?: () => void | Promise<void>;
}

export default function ActivityGroupsDrawer({
  currentActivityId,
  activities = [],
  onStartActivity,
  onStopActivity,
}: ActivityGroupsDrawerProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<ActivityGroup[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    db.activityGroups
      .filter((g) => !g.is_archived && !g.deleted_at)
      .sortBy("created_at")
      .then((g) => {
        if (!cancelled) setGroups(g);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[70] transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-background rounded-t-2xl shadow-xl max-h-[70vh] flex flex-col border-t border-border/50">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="px-5 pt-2 pb-3 shrink-0">
            <h2 className="text-lg font-semibold text-center">Groups</h2>
          </div>

          {/* New Group button */}
          <div className="px-4 pb-6 shrink-0 flex justify-center">
            <button
              onClick={() => {
                setOpen(false);
                navigate("/activities/new");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              New Group
            </button>
          </div>

          {/* Group list */}
          <div className="overflow-y-auto px-4 pb-12 space-y-2">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No groups yet.
              </p>
            ) : (
              groups.map((group) => {
                const currentActivity = currentActivityId
                  ? activities.find((a) => a.id === currentActivityId)
                  : undefined;
                const isRunningInGroup =
                  currentActivity && currentActivity.group_id === group.id;

                return (
                  <GroupPill
                    key={group.id}
                    name={group.name}
                    color={group.color || "#888"}
                    isRunning={isRunningInGroup}
                    onNameClick={() => {
                      setOpen(false);
                      navigate(`/activities/${group.id}`);
                    }}
                    onActionClick={async () => {
                      if (isRunningInGroup) {
                        await onStopActivity?.();
                        return;
                      }

                      const hiddenActivity =
                        await getOrCreateHiddenGroupDefaultActivity(group);
                      await onStartActivity?.(hiddenActivity.id);
                    }}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[60] h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </button>
    </>
  );
}
