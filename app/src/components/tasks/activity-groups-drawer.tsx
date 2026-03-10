import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import {
  getOrCreateHiddenGroupDefaultActivity,
  isActiveGroup,
} from "@/lib/activity-utils";
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
      .filter((g) => isActiveGroup(g))
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
        <div className="flex max-h-[70vh] flex-col rounded-t-2xl border-t border-border/50 bg-background shadow-xl">
          {/* Handle */}
          <div className="flex shrink-0 justify-center pb-1 pt-3">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="shrink-0 px-5 pb-3 pt-2">
            <h2 className="text-center text-lg font-semibold">Groups</h2>
          </div>

          {/* New Group button */}
          <div className="flex shrink-0 justify-center px-4 pb-6">
            <button
              onClick={() => {
                setOpen(false);
                navigate("/activities/new");
              }}
              className="flex items-center gap-2 rounded-full border border-dashed border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              New Group
            </button>
          </div>

          {/* Group list */}
          <div className="space-y-2 overflow-y-auto px-4 pb-12">
            {groups.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
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
                    color={group.color || DEFAULT_GROUP_COLOR}
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
        className="fixed bottom-6 right-6 z-[60] flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
      >
        {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </button>
    </>
  );
}
