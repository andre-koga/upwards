import { useState, useEffect, useRef } from "react";
import { ChevronLeft, Pencil, Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { cn } from "@/lib/utils";
import {
  getActivityDisplayName,
  isActiveGroup,
  isHiddenGroupDefaultActivity,
} from "@/lib/activity";
import GroupPill from "@/components/activities/group-pill";
import ActivityPill from "@/components/activities/activity-pill";
import { ActivityDialogForm } from "@/components/activities/activity-dialog-form";
import { EditGroupDialog } from "@/components/activities/edit-group-dialog";
import { NewGroupDialog } from "@/components/activities/new-group-dialog";
import ManualTimeEntryDialog from "@/components/tasks/manual-time-entry-dialog";
import { Button } from "@/components/ui/button";

interface ActivityGroupsDrawerProps {
  currentActivityId?: string | null;
  activities?: Activity[];
  /** Used in the group-activities sub-drawer to show time per activity. */
  calculateActivityTime?: (activityId: string) => number;
  onStartActivity?: (activityId: string) => void | Promise<void>;
  onStopActivity?: () => void | Promise<void>;
  initialDate?: Date;
  onAddManualEntry?: (payload: {
    activityId: string;
    dateString: string;
    startIso: string;
    endIso: string;
  }) => Promise<void>;
  triggerClassName?: string;
  triggerTitle?: string;
  triggerLabel?: string;
  triggerIcon?: LucideIcon;
  floating?: boolean;
}

export default function ActivityGroupsDrawer({
  currentActivityId,
  activities = [],
  calculateActivityTime = () => 0,
  onStartActivity,
  onStopActivity,
  initialDate = new Date(),
  onAddManualEntry,
  triggerClassName,
  triggerTitle = "Pick group or activity",
  triggerLabel,
  triggerIcon: TriggerIcon = Plus,
  floating = true,
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
  const [editingGroup, setEditingGroup] = useState<ActivityGroup | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [manualEntryActivityId, setManualEntryActivityId] = useState<
    string | null
  >(null);
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
  const manualEntryActivity = manualEntryActivityId
    ? (activities.find((item) => item.id === manualEntryActivityId) ?? null)
    : null;
  const manualEntryGroup = manualEntryActivity
    ? selectedGroup && selectedGroup.id === manualEntryActivity.group_id
      ? selectedGroup
      : groups.find((group) => group.id === manualEntryActivity.group_id)
    : undefined;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[60] transition-all duration-300 ease-out",
          open && "pointer-events-auto bg-black/40 backdrop-blur-sm",
          !open && "pointer-events-none bg-black/0 backdrop-blur-[0px]"
        )}
        onClick={handleBackdropClick}
      />

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
                          onNameClick={() => {
                            setView("groups");
                            setOpen(false);
                            navigate(`/activities/${group.id}`);
                          }}
                          onSettingsClick={() => {
                            setEditingGroup(group);
                          }}
                          onActionClick={() => handleOpenGroup(group)}
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
                        <div
                          key={activity.id}
                          className="flex items-center gap-2"
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="iconRoundMd"
                            className="h-10 w-10 border-border/80 bg-background"
                            title="Edit activity"
                            aria-label="Edit activity"
                            onClick={() => {
                              setEditingActivity(activity);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <ActivityPill
                            name={getActivityDisplayName(
                              activity,
                              selectedGroup
                            )}
                            color={groupColor}
                            elapsedMs={calculateActivityTime(activity.id)}
                            isRunning={isRunning}
                            onNameClick={() => {
                              setOpen(false);
                              navigate(`/activities/stats/${activity.id}`);
                            }}
                            onClick={async () => {
                              if (isRunning) {
                                await onStopActivity?.();
                              } else {
                                await onStartActivity?.(activity.id);
                              }
                              closeDrawer();
                            }}
                            onManualEntry={
                              onAddManualEntry
                                ? () => setManualEntryActivityId(activity.id)
                                : undefined
                            }
                            className="flex-1"
                          />
                        </div>
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
        size={triggerLabel ? "default" : "floatingNav"}
        onClick={() => setOpen((v) => !v)}
        title={open ? "Close activity picker" : triggerTitle}
        aria-label={open ? "Close activity picker" : triggerTitle}
        className={[
          !triggerLabel &&
            floating &&
            "fixed bottom-2 right-2 z-[60] gap-0 px-0 text-primary-foreground hover:bg-primary/90",
          triggerLabel && "rounded-full shadow-md",
          triggerClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {triggerLabel ? (
          <span className="flex items-center justify-center gap-2">
            {open ? (
              <X className="h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <TriggerIcon className="h-5 w-5 shrink-0" aria-hidden />
            )}
            <span className="text-sm font-semibold">
              {open ? "Close" : triggerLabel}
            </span>
          </span>
        ) : open ? (
          <X className="h-5 w-5" aria-hidden />
        ) : (
          <TriggerIcon className="h-5 w-5" aria-hidden />
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

      {editingActivity && selectedGroup ? (
        <ActivityDialogForm
          open={editingActivity !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingActivity(null);
          }}
          group={selectedGroup}
          activity={editingActivity}
          onSaved={() => {
            setEditingActivity(null);
          }}
        />
      ) : null}

      {editingGroup ? (
        <EditGroupDialog
          open={editingGroup !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingGroup(null);
          }}
          group={editingGroup}
          onUpdated={(updatedGroup) => {
            setGroups((prev) =>
              prev.map((group) =>
                group.id === updatedGroup.id ? updatedGroup : group
              )
            );
            setSelectedGroup((prev) =>
              prev && prev.id === updatedGroup.id ? updatedGroup : prev
            );
            setEditingGroup(updatedGroup);
          }}
        />
      ) : null}

      <ManualTimeEntryDialog
        open={manualEntryActivityId !== null}
        activity={manualEntryActivity}
        group={manualEntryGroup}
        initialDate={initialDate}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setManualEntryActivityId(null);
          }
        }}
        onSave={async (payload) => {
          if (!onAddManualEntry) return;
          await onAddManualEntry(payload);
        }}
      />
    </>
  );
}
