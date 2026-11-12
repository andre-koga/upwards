import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVisualViewportLayout } from "@/hooks/use-visual-viewport-layout";
import { ChevronDown, Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import type { ActivityGroup, Activity } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { cn } from "@/lib/utils";
import {
  activityTracksTime,
  getActivityDisplayName,
  isActiveGroup,
  isActivityArchived,
  isArchivedNow,
  sortActivitiesByOrder,
} from "@/lib/activity";
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
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface ProjectsData {
  active: ActivityGroup[];
  archived: ActivityGroup[];
  /** Every non-deleted activity of the active groups, archived included. */
  activitiesByGroup: Map<string, Activity[]>;
}

async function loadProjects(): Promise<ProjectsData> {
  const [active, archived, activities] = await Promise.all([
    db.activityGroups.filter((g) => isActiveGroup(g)).sortBy("created_at"),
    db.activityGroups.filter((g) => isArchivedNow(g)).sortBy("created_at"),
    db.activities.filter((a) => !a.deleted_at).toArray(),
  ]);
  const activitiesByGroup = new Map<string, Activity[]>();
  for (const activity of sortActivitiesByOrder(activities)) {
    const list = activitiesByGroup.get(activity.group_id) ?? [];
    list.push(activity);
    activitiesByGroup.set(activity.group_id, list);
  }
  return { active, archived, activitiesByGroup };
}

/** A quiet "Archived · 3" disclosure at the foot of a list. */
function ArchivedToggle({
  count,
  expanded,
  onToggle,
  showLabel,
  hideLabel,
  controls,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
  controls: string;
}) {
  const { t } = useTranslation("projects");
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-9 w-full justify-start gap-1.5 rounded-none px-4 text-xs font-medium text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={expanded ? hideLabel : showLabel}
      onClick={onToggle}
    >
      {t("drawer.archivedCount", { count })}
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
          expanded && "rotate-180"
        )}
        aria-hidden
      />
    </Button>
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
    note: string | null;
  }) => Promise<void>;
  onTasksDataChanged?: () => void;
  triggerClassName?: string;
  triggerTitle?: string;
  triggerLabel?: string;
  triggerIcon?: LucideIcon;
  /** Defaults to the primary (filled) button. */
  triggerVariant?: ButtonProps["variant"];
  /** Defaults to the floating round button, or `default` when labelled. */
  triggerSize?: ButtonProps["size"];
  floating?: boolean;
}

/**
 * Projects: every group and its activities in one scrolling sheet. It used to
 * be two levels (groups, then a group's activities), which cost a close and
 * reopen to reach any timer. Now each group is a labelled panel of the same
 * activity rows as Today, so starting anything is one tap from the dock.
 * Tap a group's name to edit it, an activity's name to edit that; archived
 * items fold away at the foot of their list with restore / delete.
 */
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
  triggerVariant = "default",
  triggerSize,
  floating = true,
}: ActivityGroupsDrawerProps) {
  const { t } = useTranslation("projects");
  const resolvedTriggerTitle = triggerTitle ?? t("drawer.pickGroupOrActivity");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ProjectsData>({
    active: [],
    archived: [],
    activitiesByGroup: new Map(),
  });
  const [reloadTick, setReloadTick] = useState(0);
  const [showArchivedGroups, setShowArchivedGroups] = useState(false);
  const [openArchivedFor, setOpenArchivedFor] = useState<Set<string>>(
    () => new Set()
  );
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
    loadProjects()
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [open, reloadTick]);

  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setShowArchivedGroups(false);
      setOpenArchivedFor(new Set());
    }
  };

  const toggleArchivedFor = (groupId: string) =>
    setOpenArchivedFor((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  const groupById = useMemo(() => {
    const map = new Map<string, ActivityGroup>();
    for (const group of [...data.active, ...data.archived]) {
      map.set(group.id, group);
    }
    return map;
  }, [data]);

  const findActivity = (id: string | null) => {
    if (!id) return null;
    for (const list of data.activitiesByGroup.values()) {
      const found = list.find((item) => item.id === id);
      if (found) return found;
    }
    return activities.find((item) => item.id === id) ?? null;
  };

  const manualEntryActivity = findActivity(manualEntryActivityId);
  const manualEntryGroup = manualEntryActivity
    ? groupById.get(manualEntryActivity.group_id)
    : undefined;
  const editingActivityGroup = editingActivity
    ? groupById.get(editingActivity.group_id)
    : undefined;

  const empty = data.active.length === 0 && data.archived.length === 0;

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex max-h-[85dvh] flex-col gap-0 rounded-t-[1.75rem] border-t border-foreground/[0.07] p-0 shadow-xl"
          style={{ bottom: bottomInset }}
        >
          <div
            className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-foreground/15"
            aria-hidden
          />

          <header className="flex shrink-0 items-center justify-between gap-3 px-5 pb-4 pt-4">
            <SheetTitle className="font-display text-[1.75rem] font-medium leading-tight tracking-[-0.02em]">
              {t("drawer.title")}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t("drawer.pickGroupOrActivity")}
            </SheetDescription>
            <Button
              type="button"
              variant="ghost"
              className="h-9 gap-1.5 rounded-full bg-muted/70 px-3.5 text-[0.8125rem] font-medium hover:bg-muted"
              onClick={() => setNewGroupDialogOpen(true)}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t("drawer.newGroup")}
            </Button>
          </header>

          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-4 pb-10">
            {empty ? (
              <p className="py-10 text-center font-display text-lg italic text-muted-foreground">
                {t("drawer.noGroupsYet")}
              </p>
            ) : null}

            {data.active.map((group) => {
              const color = group.color || DEFAULT_GROUP_COLOR;
              const list = data.activitiesByGroup.get(group.id) ?? [];
              const live = list.filter((a) => !isActivityArchived(a));
              const archived = list.filter((a) => isActivityArchived(a));
              const archivedOpen = openArchivedFor.has(group.id);
              const archivedId = `projects-archived-${group.id}`;
              return (
                <section key={group.id} aria-label={group.name}>
                  <div className="mb-1.5 flex items-center gap-1 pl-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 min-w-0 flex-1 justify-start gap-2 rounded-full px-3 text-[0.75rem] font-medium uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                      title={t("drawer.editGroup", { name: group.name })}
                      aria-label={t("drawer.editGroup", { name: group.name })}
                      onClick={() => setEditingGroup(group)}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <span className="truncate">{group.name}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="iconRoundSm"
                      className="text-muted-foreground"
                      title={t("drawer.newActivityIn", { name: group.name })}
                      aria-label={t("drawer.newActivityIn", {
                        name: group.name,
                      })}
                      onClick={() => setNewActivityDialogGroup(group)}
                    >
                      <Plus aria-hidden />
                    </Button>
                  </div>

                  <div className="divide-y divide-foreground/[0.07] overflow-hidden rounded-2xl bg-muted/45">
                    {live.length === 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-12 w-full justify-start gap-2 rounded-none px-4 text-sm font-normal text-muted-foreground hover:bg-foreground/[0.04]"
                        onClick={() => setNewActivityDialogGroup(group)}
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                        {t("drawer.newActivity")}
                      </Button>
                    ) : (
                      live.map((activity) => {
                        const isRunning = currentActivityId === activity.id;
                        return (
                          <div key={activity.id} className="px-2 py-1.5">
                            <ActivityPill
                              appearance="row"
                              name={getActivityDisplayName(activity, group)}
                              color={color}
                              elapsedMs={getActivityDrawerElapsedMs(
                                activity.id
                              )}
                              isRunning={isRunning}
                              showTimer={activityTracksTime(activity)}
                              onNameClick={() => setEditingActivity(activity)}
                              onClick={async () => {
                                if (isRunning) await onStopActivity?.();
                                else await onStartActivity?.(activity.id);
                                handleOpenChange(false);
                              }}
                              onManualEntry={
                                onAddManualEntry
                                  ? () => setManualEntryActivityId(activity.id)
                                  : undefined
                              }
                            />
                          </div>
                        );
                      })
                    )}
                    {archived.length > 0 ? (
                      <div>
                        <ArchivedToggle
                          count={archived.length}
                          expanded={archivedOpen}
                          onToggle={() => toggleArchivedFor(group.id)}
                          showLabel={t("drawer.showArchivedActivities")}
                          hideLabel={t("drawer.hideArchivedActivities")}
                          controls={archivedId}
                        />
                        {archivedOpen ? (
                          <div id={archivedId} className="pb-1.5">
                            {archived.map((activity) => (
                              <div key={activity.id} className="px-2 py-1">
                                <ActivityPill
                                  appearance="row"
                                  className="opacity-70"
                                  name={getActivityDisplayName(activity, group)}
                                  color={color}
                                  elapsedMs={getActivityDrawerElapsedMs(
                                    activity.id
                                  )}
                                  showTimer={false}
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
                                      group,
                                    })
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })}

            {data.archived.length > 0 ? (
              <section className="overflow-hidden rounded-2xl">
                <ArchivedToggle
                  count={data.archived.length}
                  expanded={showArchivedGroups}
                  onToggle={() => setShowArchivedGroups((v) => !v)}
                  showLabel={t("drawer.showArchivedGroups")}
                  hideLabel={t("drawer.hideArchivedGroups")}
                  controls="projects-archived-groups"
                />
                {showArchivedGroups ? (
                  <div
                    id="projects-archived-groups"
                    className="divide-y divide-foreground/[0.07] rounded-2xl bg-muted/30"
                  >
                    {data.archived.map((group) => (
                      <Button
                        key={group.id}
                        type="button"
                        variant="ghost"
                        className="h-12 w-full justify-start gap-2.5 rounded-none px-4 text-[0.9375rem] font-normal text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
                        title={t("drawer.restoreOrDeleteGroup")}
                        aria-label={`${group.name}. ${t("drawer.restoreOrDeleteGroup")}`}
                        onClick={() =>
                          setArchivedActionsTarget({ type: "group", group })
                        }
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full opacity-70"
                          style={{
                            backgroundColor: group.color || DEFAULT_GROUP_COLOR,
                          }}
                          aria-hidden
                        />
                        <span className="truncate">{group.name}</span>
                      </Button>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </SheetContent>

        <SheetTrigger asChild>
          <Button
            type="button"
            variant={triggerVariant}
            size={triggerSize ?? (triggerLabel ? "default" : "floatingNav")}
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
            className={cn(
              !triggerLabel &&
                floating &&
                "lift-above-tabs fixed right-4 z-[var(--z-floating)] gap-0 px-0 shadow-md",
              triggerLabel && "rounded-full shadow-md",
              triggerClassName
            )}
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
          reload();
        }}
      />

      {newActivityDialogGroup ? (
        <ActivityDialogForm
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setNewActivityDialogGroup(null);
          }}
          group={newActivityDialogGroup}
          onSaved={() => {
            setNewActivityDialogGroup(null);
            reload();
            onTasksDataChanged?.();
          }}
        />
      ) : null}

      {editingActivity &&
      editingActivityGroup &&
      !isActivityArchived(editingActivity) ? (
        <ActivityDialogForm
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingActivity(null);
          }}
          group={editingActivityGroup}
          activity={editingActivity}
          onSaved={() => {
            setEditingActivity(null);
            reload();
          }}
          onArchived={() => {
            setEditingActivity(null);
            reload();
            onTasksDataChanged?.();
          }}
        />
      ) : null}

      {editingGroup && !editingGroup.archived_at ? (
        <EditGroupDialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setEditingGroup(null);
          }}
          group={editingGroup}
          onUpdated={(updatedGroup) => {
            setEditingGroup(updatedGroup);
            reload();
          }}
          onArchived={() => {
            setEditingGroup(null);
            reload();
            onTasksDataChanged?.();
          }}
        />
      ) : null}

      <ArchivedItemActionsDialog
        target={archivedActionsTarget}
        onOpenChange={(next) => {
          if (!next) setArchivedActionsTarget(null);
        }}
        onUnarchived={() => {
          reload();
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
        onDeleted={() => {
          setDeleteArchivedTarget(null);
          reload();
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
