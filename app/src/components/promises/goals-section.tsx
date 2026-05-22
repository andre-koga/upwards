import { useState } from "react";
import { Plus } from "lucide-react";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { GoalRow } from "@/components/promises/goal-row";
import { GoalDialog } from "@/components/promises/goal-dialog";
import { CreateGoalDialog } from "@/components/promises/create-goal-dialog";
import { useGoals } from "@/lib/promises/use-goals";

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
  void lookupGroups;
  void goalRefreshKey;

  const { ownedGoals, isSignedIn, reload } = useGoals();
  const [selectedOwnedGoalId, setSelectedOwnedGoalId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const activeOwnedGoals = ownedGoals.filter((goal) => goal.status === "active");
  const selectedOwnedGoal = selectedOwnedGoalId
    ? ownedGoals.find((goal) => goal.id === selectedOwnedGoalId)
    : undefined;

  if (!isSignedIn && activeOwnedGoals.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mb-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          My Goals
        </p>
        <div className="space-y-2">
          {activeOwnedGoals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              activityStreaks={activityStreaks}
              taskCounts={taskCounts}
              pausedTaskIds={pausedTaskIds}
              isBreakDay={isBreakDay}
              isEditableDate={isToday}
              viewDate={currentDate}
              activities={lookupActivities}
              onClick={() => setSelectedOwnedGoalId(goal.id)}
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
        open={selectedOwnedGoalId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedOwnedGoalId(null);
        }}
        goal={selectedOwnedGoal}
        activityStreaks={activityStreaks}
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
