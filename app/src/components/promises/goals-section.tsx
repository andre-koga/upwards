import { useState } from "react";
import { Plus } from "lucide-react";
import type { Activity, ActivityGroup, GoalWithMembers } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { GoalRow } from "@/components/promises/goal-row";
import { GoalDialog } from "@/components/promises/goal-dialog";
import { CreateGoalDialog } from "@/components/promises/create-goal-dialog";
import { useGoals } from "@/lib/promises/use-goals";
import { useGoalMemberStatus } from "@/lib/promises/use-goal-member-status";
import type { GoalMemberDayStatus } from "@/lib/promises/use-goal-member-status";
import { getCachedUserId } from "@/lib/supabase";

function placeholderMemberStatuses(
  goal: GoalWithMembers,
  userId: string | null | undefined
): GoalMemberDayStatus[] {
  return goal.members
    .filter((m) => m.invite_status === "accepted")
    .map((m) => ({
      userId: m.user_id,
      displayName: m.display_name ?? m.username ?? null,
      completed: false,
      isSelf: m.user_id === userId,
      hasLinkedHabit: m.member_activity_id != null,
    }));
}

interface GoalsSectionProps {
  lookupActivities: Activity[];
  lookupGroups: ActivityGroup[];
  activityStreaks: Record<string, number>;
  taskCounts: Record<string, number>;
  pausedTaskIds: string[];
  isBreakDay: boolean;
  goalRefreshKey: number;
  currentDate: Date;
  isToday: boolean;
}

export function GoalsSection({
  lookupActivities,
  lookupGroups,
  activityStreaks,
  taskCounts,
  pausedTaskIds,
  isBreakDay,
  goalRefreshKey,
  currentDate,
  isToday,
}: GoalsSectionProps) {
  const userId = getCachedUserId();
  const { goals, isSignedIn, reload } = useGoals();
  const { statusMap } = useGoalMemberStatus(currentDate, goals, goalRefreshKey);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const selectedGoal = selectedGoalId
    ? goals.find((goal) => goal.id === selectedGoalId)
    : undefined;

  const activeGoals = goals.filter(
    (goal) =>
      goal.status === "active" &&
      goal.members.some(
        (m) => m.invite_status === "accepted" && m.user_id === userId
      )
  );

  if (!isSignedIn && activeGoals.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mb-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          My Goals
        </p>
        <div className="space-y-2">
          {activeGoals.map((goal) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            memberStatuses={
              statusMap[goal.id] ?? placeholderMemberStatuses(goal, userId)
            }
            activityStreaks={activityStreaks}
            taskCounts={taskCounts}
            pausedTaskIds={pausedTaskIds}
            isBreakDay={isBreakDay}
            isEditableDate={isToday}
            viewDate={currentDate}
            activities={lookupActivities}
            groups={lookupGroups}
            onClick={() => setSelectedGoalId(goal.id)}
          />
        ))}

        {isToday && isSignedIn && (
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full justify-center gap-1.5 rounded-xl border-dashed text-xs text-muted-foreground"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New Goal
          </Button>
        )}
        </div>
      </div>

      <GoalDialog
        open={selectedGoalId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedGoalId(null);
        }}
        goalId={selectedGoalId}
        activities={lookupActivities}
        groups={lookupGroups}
        activityStreaks={activityStreaks}
        memberStatuses={
          selectedGoal
            ? statusMap[selectedGoal.id] ??
              placeholderMemberStatuses(selectedGoal, userId)
            : []
        }
        taskCounts={taskCounts}
        pausedTaskIds={pausedTaskIds}
        isBreakDay={isBreakDay}
        currentDate={currentDate}
        isToday={isToday}
        onChanged={() => void reload()}
      />

      <CreateGoalDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void reload()}
      />
    </>
  );
}
