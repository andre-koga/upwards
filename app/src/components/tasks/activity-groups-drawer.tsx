import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import {
  getOrCreateHiddenGroupDefaultActivity,
  getActivityDisplayName,
  isActiveGroup,
  isHiddenGroupDefaultActivity,
} from "@/lib/activity";
import GroupPill from "@/components/activities/group-pill";
import ActivityPill from "@/components/activities/activity-pill";
import { ActivityDialogForm } from "@/components/activities/activity-dialog-form";
import { NewGroupDialog } from "@/components/activities/new-group-dialog";
import { Button } from "@/components/ui/button";

interface ActivityGroupsDrawerProps {
  currentActivityId?: string | null;
  activities?: Activity[];
  /** Used in the group-activities sub-drawer to show time per activity. */
  calculateActivityTime?: (activityId: string) => number;
  onStartActivity?: (activityId: string) => void | Promise<void>;
  onStopActivity?: () => void | Promise<void>;
}

export default function ActivityGroupsDrawer({
  currentActivityId,
  activities = [],
  calculateActivityTime = () => 0,
  onStartActivity,
  onStopActivity,
}: ActivityGroupsDrawerProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"groups" | "activities">("groups");
  const [selectedGroup, setSelectedGroup] = useState<ActivityGroup | null>(
    null
  );
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false);
  const [newActivityDialogGroup, setNewActivityDialogGroup] =
    useState<ActivityGroup | null>(null);
  const pendingContentRef = useRef<
    { type: "activities"; group: ActivityGroup } | { type: "groups" } | null
  >(null);

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

  const closeDrawer = () => {
    setView("groups");
    setSelectedGroup(null);
    setOpen(false);
  };

  const handleBackdropClick = () => {
    if (view === "activities") {
      pendingContentRef.current = { type: "groups" };
      setOpen(false);
    } else {
      setView("groups");
      setOpen(false);
    }
  };

  const handleOpenGroup = (group: ActivityGroup) => {
    pendingContentRef.current = { type: "activities", group };
    setOpen(false);
  };

  const handleBackToGroups = () => {
    pendingContentRef.current = { type: "groups" };
    setOpen(false);
  };

  const handleDrawerTransitionEnd = () => {
    if (open) return;
    const pending = pendingContentRef.current;
    pendingContentRef.current = null;
    if (pending) {
      if (pending.type === "activities") {
        setSelectedGroup(pending.group);
        setView("activities");
      } else {
        setSelectedGroup(null);
        setView("groups");
      }
      setOpen(true);
    } else {
      setView("groups");
      setSelectedGroup(null);
    }
  };

  const groupActivities = selectedGroup
    ? activities.filter(
        (a) =>
          a.group_id === selectedGroup.id && !isHiddenGroupDefaultActivity(a)
      )
    : [];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
          onClick={handleBackdropClick}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[70] transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        onTransitionEnd={(e) => {
          if (e.propertyName === "transform" && !open) {
            handleDrawerTransitionEnd();
          }
        }}
      >
        <div className="flex max-h-[70vh] flex-col rounded-t-2xl border-t border-border/50 bg-background shadow-xl">
          <div
            className="mx-auto mb-1 mt-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
            aria-hidden
          />

          {/* Content: groups or activities (switched after close-then-open) */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {view === "groups" ? (
              <>
                <div className="shrink-0 px-5 pb-3 pt-2">
                  <h2 className="text-center text-lg font-semibold">Groups</h2>
                </div>
                <div className="flex shrink-0 justify-center px-4 pb-6">
                  <Button
                    type="button"
                    variant="outlineDashed"
                    className="rounded-full px-4 py-2 text-sm"
                    onClick={() => {
                      setOpen(false);
                      setNewGroupDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    New Group
                  </Button>
                </div>
                <div className="space-y-2 px-4 pb-12">
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
                        currentActivity &&
                        currentActivity.group_id === group.id;

                      return (
                        <GroupPill
                          key={group.id}
                          name={group.name}
                          color={group.color || DEFAULT_GROUP_COLOR}
                          isRunning={isRunningInGroup}
                          onNameClick={() => handleOpenGroup(group)}
                          onSettingsClick={() => {
                            setView("groups");
                            setOpen(false);
                            navigate(`/activities/${group.id}`);
                          }}
                          onActionClick={async () => {
                            if (isRunningInGroup) {
                              await onStopActivity?.();
                              setView("groups");
                              setOpen(false);
                              return;
                            }

                            const hiddenActivity =
                              await getOrCreateHiddenGroupDefaultActivity(
                                group
                              );
                            await onStartActivity?.(hiddenActivity.id);
                            setView("groups");
                            setOpen(false);
                          }}
                        />
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex shrink-0 items-center gap-2 px-4 pb-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconRoundMd"
                    onClick={handleBackToGroups}
                    className="text-muted-foreground"
                    aria-label="Back to groups"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <h2 className="flex-1 text-center text-lg font-semibold">
                    {selectedGroup?.name ?? ""}
                  </h2>
                  <div className="w-9" />
                </div>
                {selectedGroup && (
                  <div className="flex shrink-0 justify-center px-4 pb-6">
                    <Button
                      type="button"
                      variant="outlineDashed"
                      className="rounded-full px-4 py-2 text-sm"
                      onClick={() => {
                        setOpen(false);
                        setNewActivityDialogGroup(selectedGroup);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      New Activity
                    </Button>
                  </div>
                )}
                <div className="space-y-2 px-4 pb-12">
                  {!selectedGroup ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No group selected.
                    </p>
                  ) : groupActivities.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No activities in this group.
                    </p>
                  ) : (
                    groupActivities.map((activity) => {
                      const isRunning = currentActivityId === activity.id;
                      const groupColor =
                        selectedGroup.color || DEFAULT_GROUP_COLOR;
                      return (
                        <ActivityPill
                          key={activity.id}
                          name={getActivityDisplayName(activity, selectedGroup)}
                          color={groupColor}
                          elapsedMs={calculateActivityTime(activity.id)}
                          isRunning={isRunning}
                          onClick={async () => {
                            if (isRunning) {
                              await onStopActivity?.();
                            } else {
                              await onStartActivity?.(activity.id);
                            }
                            closeDrawer();
                          }}
                        />
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* FAB */}
      <Button
        type="button"
        variant="default"
        size="floatingNav"
        onClick={() => setOpen((v) => !v)}
        title={open ? "Close activity picker" : "Pick group or activity"}
        aria-label={open ? "Close activity picker" : "Pick group or activity"}
        className="fixed bottom-2 right-2 z-[60] gap-0 px-0 text-primary-foreground hover:bg-primary/90"
      >
        {open ? (
          <X className="h-5 w-5 shrink-0" aria-hidden />
        ) : (
          <Plus className="h-5 w-5 shrink-0" aria-hidden />
        )}
      </Button>

      <NewGroupDialog
        open={newGroupDialogOpen}
        onOpenChange={setNewGroupDialogOpen}
        onCreated={(group) => {
          setNewGroupDialogOpen(false);
          setOpen(false);
          navigate(`/activities/${group.id}`);
        }}
      />

      {newActivityDialogGroup ? (
        <ActivityDialogForm
          open={newActivityDialogGroup !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setNewActivityDialogGroup(null);
          }}
          group={newActivityDialogGroup}
          onSaved={() => {
            navigate(`/activities/${newActivityDialogGroup.id}`);
          }}
        />
      ) : null}
    </>
  );
}
