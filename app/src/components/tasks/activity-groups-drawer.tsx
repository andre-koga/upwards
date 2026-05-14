import { useState, useEffect, useRef } from "react";
import { useVisualViewportLayout } from "@/hooks/use-visual-viewport-layout";
import { ChevronDown, ChevronLeft, Pencil, Plus, X } from "lucide-react";
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
  sortActivitiesByOrder,
} from "@/lib/activity";
import GroupPill from "@/components/activities/group-pill";
import ActivityPill from "@/components/activities/activity-pill";
import { ActivityDialogForm } from "@/components/activities/activity-dialog-form";
import {
  ArchivedItemActionsDialog,
  type ArchivedItemActionsTarget,
} from "@/components/activities/archived-item-actions-dialog";
import { DeleteConfirmDialog } from "@/components/activities/delete-confirm-dialog";
import { EditGroupDialog } from "@/components/activities/edit-group-dialog";
import { NewGroupDialog } from "@/components/activities/new-group-dialog";
import ManualTimeEntryDialog from "@/components/tasks/manual-time-entry-dialog";
import { Button } from "@/components/ui/button";

async function loadActivityGroupLists(): Promise<{
  active: ActivityGroup[];
  archived: ActivityGroup[];
}> {
  const [active, archived] = await Promise.all([
    db.activityGroups.filter((g) => isActiveGroup(g)).sortBy("created_at"),
    db.activityGroups
      .filter((g) => !!g.is_archived && !g.deleted_at)
      .sortBy("created_at"),
  ]);
  return { active, archived };
}

function ArchivedPillToggle({
  expanded,
  onToggle,
  showLabel,
  hideLabel,
}: {
  expanded: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <div className="flex w-full justify-center pt-2">
      <Button
        type="button"
        variant="ghost"
        className="h-auto gap-2 rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-expanded={expanded}
        aria-label={expanded ? hideLabel : showLabel}
        onClick={onToggle}
      >
        <span>Archived</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            expanded && "rotate-180"
          )}
          aria-hidden
        />
      </Button>
    </div>
  );
}

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
  onTasksDataChanged?: () => void;
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
  onTasksDataChanged,
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
  const [archivedGroups, setArchivedGroups] = useState<ActivityGroup[]>([]);
  const [showArchivedGroups, setShowArchivedGroups] = useState(false);
  const [archivedGroupActivities, setArchivedGroupActivities] = useState<
    Activity[]
  >([]);
  const [showArchivedActivities, setShowArchivedActivities] = useState(false);
  const [archivedActivitiesTick, setArchivedActivitiesTick] = useState(0);
  const [archivedActionsTarget, setArchivedActionsTarget] =
    useState<ArchivedItemActionsTarget | null>(null);
  const [deleteArchivedTarget, setDeleteArchivedTarget] = useState<{
    type: "group" | "activity";
    id: string;
  } | null>(null);
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
  const { bottomInset } = useVisualViewportLayout();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadActivityGroupLists()
      .then(({ active, archived }) => {
        if (!cancelled) {
          setGroups(active);
          setArchivedGroups(archived);
        }
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setShowArchivedGroups(false);
      setShowArchivedActivities(false);
    }
  }, [open]);

  useEffect(() => {
    setShowArchivedActivities(false);
  }, [selectedGroup?.id]);

  useEffect(() => {
    if (!open || view !== "activities" || !selectedGroup) return;
    let cancelled = false;
    db.activities
      .filter(
        (a) =>
          a.group_id === selectedGroup.id &&
          !!a.is_archived &&
          !a.deleted_at &&
          !isHiddenGroupDefaultActivity(a)
      )
      .toArray()
      .then((list) => {
        if (!cancelled) {
          setArchivedGroupActivities(sortActivitiesByOrder(list));
        }
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [open, view, selectedGroup, archivedActivitiesTick]);

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

  const activeGroupActivities = selectedGroup
    ? sortActivitiesByOrder(
        activities.filter(
          (a) =>
            a.group_id === selectedGroup.id &&
            !isHiddenGroupDefaultActivity(a)
        )
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
          open && "pointer-events-auto bg-black/50 backdrop-blur-sm",
          !open && "pointer-events-none bg-transparent backdrop-blur-none"
        )}
        onClick={handleBackdropClick}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-x-0 z-[70] transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ bottom: bottomInset }}
        onTransitionEnd={(e) => {
          if (e.propertyName === "transform" && !open) {
            handleDrawerTransitionEnd();
          }
        }}
      >
        <div className="flex max-h-[70vh] flex-col rounded-t-2xl border-t border-border bg-background shadow-xl">
          <div
            className="mx-auto mb-1 mt-3 h-1 w-10 shrink-0 rounded-full bg-muted"
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
                  {groups.length === 0 && archivedGroups.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No groups yet.
                    </p>
                  ) : (
                    <>
                      {groups.length === 0 ? (
                        <p className="py-2 text-center text-sm text-muted-foreground">
                          No active groups.
                        </p>
                      ) : (
                        groups.map((group) => {
                          return (
                            <GroupPill
                              key={group.id}
                              name={group.name}
                              color={group.color || DEFAULT_GROUP_COLOR}
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
                      {archivedGroups.length > 0 ? (
                        <div className="flex w-full flex-col">
                          <ArchivedPillToggle
                            expanded={showArchivedGroups}
                            onToggle={() =>
                              setShowArchivedGroups((v) => !v)
                            }
                            showLabel="Show archived groups"
                            hideLabel="Hide archived groups"
                          />
                          {showArchivedGroups ? (
                            <div className="mt-2 w-full space-y-2">
                              {archivedGroups.map((group) => (
                                <GroupPill
                                  key={group.id}
                                  name={group.name}
                                  color={group.color || DEFAULT_GROUP_COLOR}
                                  settingsTitle="Restore or delete archived group"
                                  settingsAriaLabel="Restore or delete archived group"
                                  onNameClick={() => {
                                    setView("groups");
                                    setOpen(false);
                                    navigate(`/activities/${group.id}`);
                                  }}
                                  onSettingsClick={() =>
                                    setArchivedActionsTarget({
                                      type: "group",
                                      group,
                                    })
                                  }
                                  onActionClick={() => handleOpenGroup(group)}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
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
                  ) : activeGroupActivities.length === 0 &&
                    archivedGroupActivities.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No activities in this group.
                    </p>
                  ) : (
                    <>
                      {activeGroupActivities.length === 0 ? (
                        <p className="py-2 text-center text-sm text-muted-foreground">
                          No active activities.
                        </p>
                      ) : (
                        activeGroupActivities.map((activity) => {
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
                                className="h-10 w-10 border-border bg-background"
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
                                    ? () =>
                                        setManualEntryActivityId(activity.id)
                                    : undefined
                                }
                                className="flex-1"
                              />
                            </div>
                          );
                        })
                      )}
                      {archivedGroupActivities.length > 0 ? (
                        <div className="flex w-full flex-col">
                          <ArchivedPillToggle
                            expanded={showArchivedActivities}
                            onToggle={() =>
                              setShowArchivedActivities((v) => !v)
                            }
                            showLabel="Show archived activities"
                            hideLabel="Hide archived activities"
                          />
                          {showArchivedActivities ? (
                            <div className="mt-2 w-full space-y-2">
                              {archivedGroupActivities.map((activity) => {
                                const isRunning =
                                  currentActivityId === activity.id;
                                const groupColor =
                                  selectedGroup.color ||
                                  DEFAULT_GROUP_COLOR;
                                return (
                                  <div
                                    key={activity.id}
                                    className="flex items-center gap-2"
                                  >
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="iconRoundMd"
                                      className="h-10 w-10 border-border bg-background"
                                      title="Restore or delete archived activity"
                                      aria-label="Restore or delete archived activity"
                                      onClick={() =>
                                        setArchivedActionsTarget({
                                          type: "activity",
                                          activity,
                                        })
                                      }
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <ActivityPill
                                      name={getActivityDisplayName(
                                        activity,
                                        selectedGroup
                                      )}
                                      color={groupColor}
                                      elapsedMs={calculateActivityTime(
                                        activity.id
                                      )}
                                      isRunning={isRunning}
                                      onNameClick={() => {
                                        setOpen(false);
                                        navigate(
                                          `/activities/stats/${activity.id}`
                                        );
                                      }}
                                      onClick={async () => {
                                        if (isRunning) {
                                          await onStopActivity?.();
                                        } else {
                                          await onStartActivity?.(
                                            activity.id
                                          );
                                        }
                                        closeDrawer();
                                      }}
                                      onManualEntry={
                                        onAddManualEntry
                                          ? () =>
                                              setManualEntryActivityId(
                                                activity.id
                                              )
                                          : undefined
                                      }
                                      className="flex-1"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
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
        title={triggerLabel || !open ? triggerTitle : "Close activity picker"}
        aria-label={
          triggerLabel || !open ? triggerTitle : "Close activity picker"
        }
        className={[
          !triggerLabel &&
            floating &&
            "fixed bottom-2 right-2 z-[60] gap-0 px-0 shadow-md",
          triggerLabel && "rounded-full shadow-md",
          triggerClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {triggerLabel ? (
          <span className="flex items-center justify-center gap-2">
            <TriggerIcon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-sm font-semibold">{triggerLabel}</span>
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

      {editingActivity &&
      selectedGroup &&
      !editingActivity.is_archived ? (
        <ActivityDialogForm
          open={editingActivity !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingActivity(null);
          }}
          group={selectedGroup}
          activity={editingActivity}
          onSaved={() => {
            setEditingActivity(null);
            setArchivedActivitiesTick((t) => t + 1);
          }}
          onArchived={() => {
            setEditingActivity(null);
            setArchivedActivitiesTick((t) => t + 1);
            onTasksDataChanged?.();
          }}
        />
      ) : null}

      {editingGroup && !editingGroup.is_archived ? (
        <EditGroupDialog
          open={editingGroup !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingGroup(null);
          }}
          group={editingGroup}
          onUpdated={(updatedGroup) => {
            setSelectedGroup((prev) =>
              prev && prev.id === updatedGroup.id ? updatedGroup : prev
            );
            setEditingGroup(updatedGroup);
            void loadActivityGroupLists()
              .then(({ active, archived }) => {
                setGroups(active);
                setArchivedGroups(archived);
              })
              .catch(console.error);
          }}
          onArchived={() => {
            const id = editingGroup.id;
            setEditingGroup(null);
            void loadActivityGroupLists()
              .then(({ active, archived }) => {
                setGroups(active);
                setArchivedGroups(archived);
              })
              .catch(console.error);
            setSelectedGroup((prev) =>
              prev && prev.id === id ? null : prev
            );
            setView("groups");
            onTasksDataChanged?.();
          }}
        />
      ) : null}

      <ArchivedItemActionsDialog
        target={archivedActionsTarget}
        onOpenChange={(next) => {
          if (!next) setArchivedActionsTarget(null);
        }}
        onUnarchived={async (t) => {
          if (t.type === "group") {
            setSelectedGroup((prev) =>
              prev?.id === t.group.id
                ? { ...prev, is_archived: false }
                : prev
            );
          }
          try {
            const { active, archived } = await loadActivityGroupLists();
            setGroups(active);
            setArchivedGroups(archived);
          } catch (e) {
            console.error(e);
          }
          setArchivedActivitiesTick((n) => n + 1);
          onTasksDataChanged?.();
        }}
        onDeleteRequested={({ type, id }) => {
          setDeleteArchivedTarget({ type, id });
        }}
      />

      <DeleteConfirmDialog
        open={deleteArchivedTarget !== null}
        type={deleteArchivedTarget?.type ?? null}
        id={deleteArchivedTarget?.id ?? null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteArchivedTarget(null);
        }}
        onDeleted={({ type, id }) => {
          setDeleteArchivedTarget(null);
          if (type === "group") {
            setSelectedGroup((prev) => {
              if (prev?.id === id) {
                queueMicrotask(() => setView("groups"));
                return null;
              }
              return prev;
            });
          }
          void loadActivityGroupLists()
            .then(({ active, archived }) => {
              setGroups(active);
              setArchivedGroups(archived);
            })
            .catch(console.error);
          setArchivedActivitiesTick((n) => n + 1);
          onTasksDataChanged?.();
        }}
      />

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
