import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useVisualViewportLayout } from "@/hooks/use-visual-viewport-layout";
import { ChevronDown, ChevronLeft, Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { cn } from "@/lib/utils";
import {
  getActivityDisplayName,
  isActiveGroup,
  isActivityArchived,
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
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  const { t } = useTranslation("projects");

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
        <span>{t("drawer.archived")}</span>
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

function DrawerActivityRow({
  activity,
  group,
  isRunning,
  elapsedMs,
  onEdit,
  onActivate,
  onManualEntry,
}: {
  activity: Activity;
  group: ActivityGroup;
  isRunning: boolean;
  elapsedMs: number;
  onEdit: () => void;
  onActivate?: () => void | Promise<void>;
  onManualEntry?: () => void;
}) {
  return (
    <ActivityPill
      name={getActivityDisplayName(activity, group)}
      color={group.color || DEFAULT_GROUP_COLOR}
      elapsedMs={elapsedMs}
      isRunning={isRunning}
      onNameClick={onEdit}
      onClick={onActivate}
      onManualEntry={onManualEntry}
    />
  );
}

interface ActivityGroupsDrawerProps {
  currentActivityId?: string | null;
  activities?: Activity[];
  /** All-time tracked time per activity, plus live open session when running today. */
  getActivityDrawerElapsedMs?: (activityId: string) => number;
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
  getActivityDrawerElapsedMs = () => 0,
  onStartActivity,
  onStopActivity,
  initialDate = new Date(),
  onAddManualEntry,
  onTasksDataChanged,
  triggerClassName,
  triggerTitle,
  triggerLabel,
  triggerIcon: TriggerIcon = Plus,
  floating = true,
}: ActivityGroupsDrawerProps) {
  const { t } = useTranslation("projects");
  const resolvedTriggerTitle = triggerTitle ?? t("drawer.pickGroupOrActivity");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"groups" | "activities">("groups");
  const [selectedGroup, setSelectedGroup] = useState<ActivityGroup | null>(
    null
  );
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<ActivityGroup[]>([]);
  const [showArchivedGroups, setShowArchivedGroups] = useState(false);
  const [showArchivedActivities, setShowArchivedActivities] = useState(false);
  // All non-deleted activities for the selected group (including archived).
  const [groupActivities, setGroupActivities] = useState<Activity[]>([]);
  const [groupActivitiesTick, setGroupActivitiesTick] = useState(0);
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

  // Load all non-deleted activities for the selected group whenever the group changes or a tick fires.
  useEffect(() => {
    if (!open || view !== "activities" || !selectedGroup) return;
    let cancelled = false;
    db.activities
      .filter(
        (a) =>
          a.group_id === selectedGroup.id &&
          !a.deleted_at &&
          !isHiddenGroupDefaultActivity(a)
      )
      .toArray()
      .then((list) => {
        if (!cancelled) {
          setGroupActivities(sortActivitiesByOrder(list));
        }
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [open, view, selectedGroup, groupActivitiesTick]);

  const reloadGroupActivities = () => setGroupActivitiesTick((t) => t + 1);

  const resetDrawerView = () => {
    setView("groups");
    setSelectedGroup(null);
    setShowArchivedGroups(false);
    setShowArchivedActivities(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetDrawerView();
    }
  };

  const closeDrawer = () => {
    setOpen(false);
    resetDrawerView();
  };

  const handleOpenGroup = (group: ActivityGroup) => {
    setSelectedGroup(group);
    setView("activities");
  };

  const handleBackToGroups = () => {
    setSelectedGroup(null);
    setView("groups");
    setShowArchivedActivities(false);
  };

  const activeActivities = groupActivities.filter(
    (a) => !isActivityArchived(a)
  );
  const archivedActivities = groupActivities.filter((a) =>
    isActivityArchived(a)
  );

  const manualEntryActivity = manualEntryActivityId
    ? (groupActivities.find((item) => item.id === manualEntryActivityId) ??
      activities.find((item) => item.id === manualEntryActivityId) ??
      null)
    : null;
  const manualEntryGroup = manualEntryActivity
    ? selectedGroup && selectedGroup.id === manualEntryActivity.group_id
      ? selectedGroup
      : groups.find((group) => group.id === manualEntryActivity.group_id)
    : undefined;

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex max-h-[70vh] flex-col gap-0 rounded-t-2xl border-t border-border p-0 shadow-xl"
          style={{ bottom: bottomInset }}
        >
          <div
            className="mx-auto mb-1 mt-3 h-1 w-10 shrink-0 rounded-full bg-muted"
            aria-hidden
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {view === "groups" ? (
              <>
                <div className="shrink-0 px-5 pb-3 pt-2">
                  <SheetTitle className="text-center text-lg">
                    {t("drawer.groups")}
                  </SheetTitle>
                </div>
                <div className="flex shrink-0 justify-center px-4 pb-6">
                  <Button
                    type="button"
                    variant="outlineDashed"
                    className="rounded-full px-4 py-2 text-sm"
                    onClick={() => {
                      closeDrawer();
                      setNewGroupDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    {t("drawer.newGroup")}
                  </Button>
                </div>
                <div className="space-y-2 px-4 pb-12">
                  {groups.length === 0 && archivedGroups.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      {t("drawer.noGroupsYet")}
                    </p>
                  ) : (
                    <>
                      {groups.length === 0 ? (
                        <p className="py-2 text-center text-sm text-muted-foreground">
                          {t("drawer.noActiveGroups")}
                        </p>
                      ) : (
                        groups.map((group) => {
                          return (
                            <GroupPill
                              key={group.id}
                              name={group.name}
                              color={group.color || DEFAULT_GROUP_COLOR}
                              onNameClick={() => setEditingGroup(group)}
                              onActionClick={() => handleOpenGroup(group)}
                            />
                          );
                        })
                      )}
                      {archivedGroups.length > 0 ? (
                        <div className="flex w-full flex-col">
                          <ArchivedPillToggle
                            expanded={showArchivedGroups}
                            onToggle={() => setShowArchivedGroups((v) => !v)}
                            showLabel={t("drawer.showArchivedGroups")}
                            hideLabel={t("drawer.hideArchivedGroups")}
                          />
                          {showArchivedGroups ? (
                            <div className="mt-2 w-full space-y-2">
                              {archivedGroups.map((group) => (
                                <GroupPill
                                  key={group.id}
                                  name={group.name}
                                  color={group.color || DEFAULT_GROUP_COLOR}
                                  nameTitle={t("drawer.restoreOrDeleteGroup")}
                                  nameAriaLabel={t(
                                    "drawer.restoreOrDeleteGroup"
                                  )}
                                  onNameClick={() =>
                                    setArchivedActionsTarget({
                                      type: "group",
                                      group,
                                    })
                                  }
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
                    aria-label={t("drawer.backToGroups")}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <SheetTitle className="flex-1 text-center text-lg">
                    {selectedGroup?.name ?? ""}
                  </SheetTitle>
                  <div className="w-9" />
                </div>
                {selectedGroup && (
                  <div className="flex shrink-0 justify-center px-4 pb-6">
                    <Button
                      type="button"
                      variant="outlineDashed"
                      className="rounded-full px-4 py-2 text-sm"
                      onClick={() => {
                        setNewActivityDialogGroup(selectedGroup);
                        closeDrawer();
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      {t("drawer.newActivity")}
                    </Button>
                  </div>
                )}
                <div className="space-y-2 px-4 pb-12">
                  {!selectedGroup ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      {t("drawer.noGroupSelected")}
                    </p>
                  ) : groupActivities.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      {t("drawer.noActivitiesInGroup")}
                    </p>
                  ) : (
                    <>
                      {activeActivities.length === 0 ? (
                        <p className="py-2 text-center text-sm text-muted-foreground">
                          {t("drawer.noActiveActivities")}
                        </p>
                      ) : (
                        activeActivities.map((activity) => {
                          const isRunning = currentActivityId === activity.id;
                          return (
                            <DrawerActivityRow
                              key={activity.id}
                              activity={activity}
                              group={selectedGroup}
                              isRunning={isRunning}
                              elapsedMs={getActivityDrawerElapsedMs(
                                activity.id
                              )}
                              onEdit={() => setEditingActivity(activity)}
                              onActivate={async () => {
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
                            />
                          );
                        })
                      )}
                      {archivedActivities.length > 0 ? (
                        <div className="flex w-full flex-col">
                          <ArchivedPillToggle
                            expanded={showArchivedActivities}
                            onToggle={() =>
                              setShowArchivedActivities((v) => !v)
                            }
                            showLabel={t("drawer.showArchivedActivities")}
                            hideLabel={t("drawer.hideArchivedActivities")}
                          />
                          {showArchivedActivities ? (
                            <div className="mt-2 w-full space-y-2">
                              {archivedActivities.map((activity) => (
                                <ActivityPill
                                  key={activity.id}
                                  name={getActivityDisplayName(
                                    activity,
                                    selectedGroup
                                  )}
                                  color={
                                    selectedGroup.color || DEFAULT_GROUP_COLOR
                                  }
                                  elapsedMs={getActivityDrawerElapsedMs(
                                    activity.id
                                  )}
                                  readOnly
                                  allowNameClickWhenReadOnly
                                  nameTitle={t(
                                    "drawer.restoreOrDeleteActivity"
                                  )}
                                  nameAriaLabel={t(
                                    "drawer.restoreOrDeleteActivity"
                                  )}
                                  onNameClick={() =>
                                    setArchivedActionsTarget({
                                      type: "activity",
                                      activity,
                                      group: selectedGroup,
                                    })
                                  }
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
            )}
          </div>
        </SheetContent>

        <SheetTrigger asChild>
          <Button
            type="button"
            variant="default"
            size={triggerLabel ? "default" : "floatingNav"}
            title={
              triggerLabel || !open
                ? resolvedTriggerTitle
                : t("drawer.closePicker")
            }
            aria-label={
              triggerLabel || !open
                ? resolvedTriggerTitle
                : t("drawer.closePicker")
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
        </SheetTrigger>
      </Sheet>

      <NewGroupDialog
        open={newGroupDialogOpen}
        onOpenChange={setNewGroupDialogOpen}
        onCreated={() => {
          setNewGroupDialogOpen(false);
          void loadActivityGroupLists()
            .then(({ active, archived }) => {
              setGroups(active);
              setArchivedGroups(archived);
            })
            .catch(console.error);
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
            setNewActivityDialogGroup(null);
            reloadGroupActivities();
            onTasksDataChanged?.();
          }}
        />
      ) : null}

      {editingActivity &&
      selectedGroup &&
      !isActivityArchived(editingActivity) ? (
        <ActivityDialogForm
          open={editingActivity !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingActivity(null);
          }}
          group={selectedGroup}
          activity={editingActivity}
          onSaved={() => {
            setEditingActivity(null);
            reloadGroupActivities();
          }}
          onArchived={() => {
            setEditingActivity(null);
            reloadGroupActivities();
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
            setSelectedGroup((prev) => (prev && prev.id === id ? null : prev));
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
              prev?.id === t.group.id ? { ...prev, is_archived: false } : prev
            );
          }
          try {
            const { active, archived } = await loadActivityGroupLists();
            setGroups(active);
            setArchivedGroups(archived);
          } catch (e) {
            console.error(e);
          }
          reloadGroupActivities();
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
          reloadGroupActivities();
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
