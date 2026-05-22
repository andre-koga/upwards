import { useCallback, useEffect, useState } from "react";
import { Target } from "lucide-react";
import { DEFAULT_GROUP_COLOR } from "@/lib/color-utils";
import { getActivityDisplayName, isActiveGroup, isHiddenGroupDefaultActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  FormDialog,
  FormField,
  FormSelectField,
  FormTextareaField,
  FormCharacterCount,
} from "@/components/forms";
import { Button } from "@/components/ui/button";
import { GoalTargetForm } from "@/components/promises/goal-target-form";
import { useGoals } from "@/lib/promises/use-goals";
import { filterActivitiesWithoutActiveGoals } from "@/lib/promises/goal-eligibility";
import { GOAL_DESCRIPTION_MAX_LENGTH, GOAL_NAME_MAX_LENGTH } from "@/lib/promises/goal-display";
import type { Activity, ActivityGroup, GoalTargetInput, GoalWithShares } from "@/lib/db/types";
import { getCachedUserId } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

interface CreateGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

function isGoalLinkableActivity(activity: Activity): boolean {
  return (
    !activity.completed_at &&
    !activity.deleted_at &&
    !isHiddenGroupDefaultActivity(activity)
  );
}

function getAvailableActivitiesForGroup(
  groupId: string,
  allActivities: Activity[],
  goals: GoalWithShares[],
  userId: string | null | undefined
): Activity[] {
  const groupActivities = allActivities.filter(
    (activity) => activity.group_id === groupId && isGoalLinkableActivity(activity)
  );

  const availableActivities = filterActivitiesWithoutActiveGoals(
    groupActivities,
    goals,
    userId
  ) as Activity[];

  return availableActivities.sort(
    (left, right) =>
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );
}

export function CreateGoalDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateGoalDialogProps) {
  const navigate = useNavigate();
  const userId = getCachedUserId();
  const { createGoal, goals, isSignedIn, loading: goalsLoading } = useGoals();
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [hasAnyLinkableHabits, setHasAnyLinkableHabits] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [habitsLoading, setHabitsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(
    async (preferredGroupId?: string) => {
      setHabitsLoading(true);
      try {
        const [nextGroups, allActivities] = await Promise.all([
          db.activityGroups.filter((group) => isActiveGroup(group)).sortBy("created_at"),
          db.activities.toArray(),
        ]);

        const linkableActivities = allActivities.filter(isGoalLinkableActivity);
        setHasAnyLinkableHabits(linkableActivities.length > 0);

        const groupsWithAvailableHabits = nextGroups.filter(
          (group) =>
            getAvailableActivitiesForGroup(
              group.id,
              linkableActivities,
              goals,
              userId
            ).length > 0
        );

        setGroups(groupsWithAvailableHabits);

        const nextGroupId = groupsWithAvailableHabits.some(
          (group) => group.id === preferredGroupId
        )
          ? (preferredGroupId ?? "")
          : (groupsWithAvailableHabits[0]?.id ?? "");

        setSelectedGroupId(nextGroupId);

        if (nextGroupId) {
          const availableActivities = getAvailableActivitiesForGroup(
            nextGroupId,
            linkableActivities,
            goals,
            userId
          );
          setActivities(availableActivities);
          setSelectedActivityId((current) =>
            availableActivities.some((activity) => activity.id === current)
              ? current
              : (availableActivities[0]?.id ?? "")
          );
        } else {
          setActivities([]);
          setSelectedActivityId("");
        }
      } finally {
        setHabitsLoading(false);
      }
    },
    [goals, userId]
  );

  const loadActivities = useCallback(
    async (groupId: string) => {
      if (!groupId) {
        setActivities([]);
        setSelectedActivityId("");
        return;
      }

      const allActivities = await db.activities.toArray();
      const linkableActivities = allActivities.filter(isGoalLinkableActivity);
      const availableActivities = getAvailableActivitiesForGroup(
        groupId,
        linkableActivities,
        goals,
        userId
      );

      setActivities(availableActivities);
      setSelectedActivityId((current) =>
        availableActivities.some((activity) => activity.id === current)
          ? current
          : (availableActivities[0]?.id ?? "")
      );
    },
    [goals, userId]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setGoalName("");
    setGoalDescription("");
    void loadGroups(selectedGroupId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when dialog opens or goals change
  }, [open, loadGroups]);

  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedActivityId("");
    void loadActivities(groupId);
  };

  const handleCreate = async (target: GoalTargetInput) => {
    const name = goalName.trim();
    const description = goalDescription.trim();

    if (!name) {
      setError("Enter a goal name.");
      return;
    }
    if (name.length > GOAL_NAME_MAX_LENGTH) {
      setError(`Goal name must be ${GOAL_NAME_MAX_LENGTH} characters or less.`);
      return;
    }
    if (!description) {
      setError("Enter a goal description.");
      return;
    }
    if (description.length > GOAL_DESCRIPTION_MAX_LENGTH) {
      setError(
        `Goal description must be ${GOAL_DESCRIPTION_MAX_LENGTH} characters or less.`
      );
      return;
    }
    if (!selectedActivityId) {
      setError("Choose a habit to link to this Goal.");
      return;
    }

    setError(null);
    try {
      await createGoal({
        activityId: selectedActivityId,
        name,
        description,
        target,
      });
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create Goal.");
    }
  };

  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const canCreateGoal = groups.length > 0 && activities.length > 0 && !!selectedActivityId;
  const hasRequiredDetails =
    goalName.trim().length > 0 &&
    goalName.length <= GOAL_NAME_MAX_LENGTH &&
    goalDescription.trim().length > 0 &&
    goalDescription.length <= GOAL_DESCRIPTION_MAX_LENGTH;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Start a Goal"
      description={
        canCreateGoal
          ? "Name your goal, pick a habit, and set a streak target."
          : undefined
      }
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
      ) : goalsLoading || habitsLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : canCreateGoal ? (
        <>
          <div className="flex flex-col">
            <div className="space-y-1">
              <FormField
                id="create-goal-name"
                label="Goal info"
                placeholder="e.g. Run every morning"
                value={goalName}
                onChange={(event) => {
                  setGoalName(event.target.value);
                  setError(null);
                }}
                maxLength={GOAL_NAME_MAX_LENGTH}
                required
              />
              <FormCharacterCount
                current={goalName.length}
                max={GOAL_NAME_MAX_LENGTH}
              />
            </div>

            <div className="space-y-1 mt-1">
              <FormTextareaField
                id="create-goal-description"
                label="Description"
                placeholder="What do you want to achieve?"
                value={goalDescription}
                onChange={(event) => {
                  setGoalDescription(event.target.value);
                  setError(null);
                }}
                maxLength={GOAL_DESCRIPTION_MAX_LENGTH}
                rows={2}
                className="min-h-0 !h-[3.25rem]"
                required
              />
              <FormCharacterCount
                current={goalDescription.length}
                max={GOAL_DESCRIPTION_MAX_LENGTH}
              />
            </div>

            <div className="space-y-3">
              <FormSelectField
                id="create-goal-group"
                label="Group"
                value={selectedGroupId}
                onValueChange={handleGroupChange}
                contentClassName="z-[90]"
                containerClassName="pt-0"
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
                contentClassName="z-[90]"
                options={activities.map((activity) => ({
                  value: activity.id,
                  label: getActivityDisplayName(activity, selectedGroup),
                }))}
                placeholder="Select habit"
              />
            </div>
          </div>

          <GoalTargetForm
            submitLabel="Start Goal"
            onSubmit={handleCreate}
            onCancel={() => onOpenChange(false)}
            confirmDisabled={!hasRequiredDetails}
          />

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </>
      ) : (
        <div className="space-y-3 py-2 text-center text-sm text-muted-foreground">
          <Target className="mx-auto h-8 w-8 opacity-40" />
          <p>
            {hasAnyLinkableHabits
              ? "Every habit already has a Goal. End an existing Goal to start a new one on that habit."
              : "Create an activity first, then come back here to set up a Goal."}
          </p>
        </div>
      )}
    </FormDialog>
  );
}
