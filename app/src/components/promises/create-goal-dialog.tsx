import { useCallback, useEffect, useState } from "react";
import { Target } from "lucide-react";
import type { ActivityGroup } from "@/lib/db/types";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { getActivityDisplayName, isActiveGroup } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  FormDialog,
  FormSelectField,
  FormStack,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { GoalTargetForm } from "@/components/promises/goal-target-form";
import { useGoals } from "@/lib/promises/use-goals";
import type { Activity, GoalTargetInput } from "@/lib/db/types";
import { useNavigate } from "react-router-dom";

interface CreateGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateGoalDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateGoalDialogProps) {
  const navigate = useNavigate();
  const { createGoal, isSignedIn, loading: goalsLoading } = useGoals();
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState("");
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
    setError(null);
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

  const handleCreate = async (target: GoalTargetInput) => {
    if (!selectedActivityId) {
      setError("Choose a habit to link to this Goal.");
      return;
    }

    setError(null);
    try {
      await createGoal(selectedActivityId, target);
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create Goal.");
    }
  };

  const selectedGroup = groups.find((group) => group.id === selectedGroupId);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Start a Goal"
      description="Pick a habit and set a streak target to stay accountable."
      contentClassName="sm:max-w-md"
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
      {!isSignedIn ? (
        <div className="space-y-3 py-2 text-sm text-muted-foreground">
          <p>Sign in to create a Goal.</p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              navigate("/settings");
            }}
          >
            Go to Settings
          </Button>
        </div>
      ) : goalsLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="space-y-3 py-2 text-center text-sm text-muted-foreground">
          <Target className="mx-auto h-8 w-8 opacity-40" />
          <p>Create a habit first, then start a Goal from For Today.</p>
        </div>
      ) : (
        <>
          <FormStack>
            <FormSelectField
              id="create-goal-group"
              label="Group"
              value={selectedGroupId}
              onValueChange={handleGroupChange}
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
              id="create-goal-activity"
              label="Habit"
              value={selectedActivityId}
              onValueChange={setSelectedActivityId}
              disabled={activities.length === 0}
              contentClassName="z-[90]"
              options={activities.map((activity) => ({
                value: activity.id,
                label: getActivityDisplayName(activity, selectedGroup),
              }))}
              placeholder="Select habit"
            />
          </FormStack>

          <GoalTargetForm
            submitLabel="Start Goal"
            onSubmit={handleCreate}
            onCancel={() => onOpenChange(false)}
          />

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </>
      )}
    </FormDialog>
  );
}
