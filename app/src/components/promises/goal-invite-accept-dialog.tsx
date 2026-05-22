import { useCallback, useEffect, useState } from "react";
import {
  FormDialog,
  FormDialogActions,
  FormSelectField,
  FormStack,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { getActivityDisplayName, isActiveGroup } from "@/lib/activity";
import { db } from "@/lib/db";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { useGoals } from "@/lib/promises/use-goals";

type JoinMode = "witness" | "mutual";

interface GoalInviteAcceptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalId: string | null;
  inviterLabel: string;
  onAccepted?: () => void;
}

export function GoalInviteAcceptDialog({
  open,
  onOpenChange,
  goalId,
  inviterLabel,
  onAccepted,
}: GoalInviteAcceptDialogProps) {
  const { acceptGoalInvite } = useGoals();
  const [mode, setMode] = useState<JoinMode>("witness");
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    const nextGroups = await db.activityGroups
      .filter((group) => isActiveGroup(group))
      .sortBy("created_at");
    setGroups(nextGroups);
    setSelectedGroupId(nextGroups[0]?.id ?? "");
  }, []);

  const loadActivities = useCallback(async (groupId: string) => {
    if (!groupId) {
      setActivities([]);
      setSelectedActivityId("");
      return;
    }

    const nextActivities = await db.activities
      .filter(
        (activity) =>
          activity.group_id === groupId &&
          !activity.completed_at &&
          !activity.deleted_at
      )
      .sortBy("created_at");
    setActivities(nextActivities);
    setSelectedActivityId(nextActivities[0]?.id ?? "");
  }, []);

  useEffect(() => {
    if (!open) return;
    setMode("witness");
    setError(null);
    setSaving(false);
    void loadGroups();
  }, [open, loadGroups]);

  useEffect(() => {
    if (!open || !selectedGroupId) return;
    void loadActivities(selectedGroupId);
  }, [open, selectedGroupId, loadActivities]);

  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedActivityId("");
    void loadActivities(groupId);
  };

  const handleAccept = async () => {
    if (!goalId) return;
    if (mode === "mutual" && !selectedActivityId) {
      setError("Choose a habit to link to this Goal.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await acceptGoalInvite({
        goalId,
        activityId: mode === "mutual" ? selectedActivityId : undefined,
      });
      onOpenChange(false);
      onAccepted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join Goal.");
    } finally {
      setSaving(false);
    }
  };

  const selectedGroup = groups.find((group) => group.id === selectedGroupId);

  return (
    <FormDialog
      open={open && goalId !== null}
      onOpenChange={onOpenChange}
      title="Join Goal"
      description={
        <>
          {inviterLabel} invited you to their Goal. Join as a witness, or link
          one of your habits for mutual accountability.
        </>
      }
      contentClassName="z-[80] sm:max-w-md"
      overlayClassName="z-[80]"
      onContentPointerDownOutside={(event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest('[data-slot="select-content"]')
        ) {
          event.preventDefault();
        }
      }}
    >
      <FormStack>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={mode === "witness" ? "default" : "outline"}
            className="h-auto py-2"
            disabled={saving}
            onClick={() => {
              setMode("witness");
              setError(null);
            }}
          >
            Witness
          </Button>
          <Button
            type="button"
            variant={mode === "mutual" ? "default" : "outline"}
            className="h-auto py-2"
            disabled={saving}
            onClick={() => {
              setMode("mutual");
              setError(null);
            }}
          >
            Link a habit
          </Button>
        </div>

        {mode === "witness" ? (
          <p className="text-xs text-muted-foreground">
            You&apos;ll see their progress, but your own habits won&apos;t be
            linked to this Goal.
          </p>
        ) : groups.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Create a habit first, then link it to join with mutual
            accountability.
          </p>
        ) : (
          <>
            <FormSelectField
              id="goal-invite-group"
              label="Group"
              value={selectedGroupId}
              onValueChange={handleGroupChange}
              disabled={saving}
              contentClassName="z-[90]"
              options={groups.map((group) => ({
                value: group.id,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: group.color || DEFAULT_GROUP_COLOR,
                      }}
                    />
                    {group.name}
                  </span>
                ),
              }))}
              placeholder="Select group"
            />

            <FormSelectField
              id="goal-invite-activity"
              label="Habit"
              value={selectedActivityId}
              onValueChange={setSelectedActivityId}
              disabled={saving || activities.length === 0}
              contentClassName="z-[90]"
              options={activities.map((activity) => ({
                value: activity.id,
                label: getActivityDisplayName(activity, selectedGroup),
              }))}
              placeholder="Select habit"
              message="Your completions on this habit will count toward the shared Goal."
            />
          </>
        )}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <FormDialogActions
          onConfirm={() => void handleAccept()}
          confirmLabel={saving ? "Joining…" : "Join Goal"}
          confirmDisabled={
            saving ||
            !goalId ||
            (mode === "mutual" && (groups.length === 0 || !selectedActivityId))
          }
          secondaryAction={{
            label: "Cancel",
            onClick: () => onOpenChange(false),
            disabled: saving,
          }}
        />
      </FormStack>
    </FormDialog>
  );
}
