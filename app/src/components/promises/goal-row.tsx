import { memo, useMemo } from "react";
import { Flame } from "lucide-react";
import type { Activity, ActivityGroup, GoalWithMembers } from "@/lib/db/types";
import {
  computeGoalProgress,
  getGoalLinkedActivityId,
} from "@/lib/promises/use-goal-progress";
import type { GoalMemberDayStatus } from "@/lib/promises/use-goal-member-status";
import { enrichGoalMemberStatuses } from "@/lib/promises/goal-member-day-status";
import {
  formatGoalTargetShort,
  getGoalLinkedActivityName,
} from "@/lib/promises/goal-display";
import { GoalMemberPill } from "@/components/promises/goal-member-pill";
import { getCachedUserId } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface GoalRowProps {
  goal: GoalWithMembers;
  memberStatuses: GoalMemberDayStatus[];
  activityStreaks: Record<string, number>;
  taskCounts: Record<string, number>;
  pausedTaskIds: string[];
  isBreakDay: boolean;
  isEditableDate: boolean;
  viewDate: Date;
  activities: Activity[];
  groups: ActivityGroup[];
  onClick: () => void;
}

export const GoalRow = memo(function GoalRow({
  goal,
  memberStatuses,
  activityStreaks,
  taskCounts,
  pausedTaskIds,
  isBreakDay,
  isEditableDate,
  viewDate,
  activities,
  groups,
  onClick,
}: GoalRowProps) {
  const userId = getCachedUserId();
  const linkedActivityId = getGoalLinkedActivityId(goal, userId);
  const currentStreak = linkedActivityId
    ? (activityStreaks[linkedActivityId] ?? 0)
    : 0;
  const { progressPercent } = computeGoalProgress(goal, currentStreak, viewDate);
  const activityName = getGoalLinkedActivityName(
    goal,
    userId,
    activities,
    groups
  );
  const targetLabel = formatGoalTargetShort(goal);

  const memberActivityIds = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const member of goal.members) {
      if (member.invite_status !== "accepted") continue;
      map.set(member.user_id, member.member_activity_id);
    }
    return map;
  }, [goal.members]);

  const enrichedMembers = useMemo(
    () =>
      enrichGoalMemberStatuses({
        goal,
        members: memberStatuses,
        activityStreaks,
        taskCounts,
        pausedTaskIds,
        isBreakDay,
        isEditableDate,
        viewDate,
        activities,
        memberActivityIds,
      }),
    [
      goal,
      memberStatuses,
      activityStreaks,
      taskCounts,
      pausedTaskIds,
      isBreakDay,
      isEditableDate,
      viewDate,
      activities,
      memberActivityIds,
    ]
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full overflow-hidden rounded-xl border border-border/80 bg-muted/20 text-left transition-colors",
        "hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="h-1 w-full bg-muted" aria-hidden="true">
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${progressPercent ?? 0}%` }}
        />
      </div>

      <div className="space-y-2 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
            <span className="truncate text-sm font-medium leading-tight">
              {activityName}
            </span>
            <span
              className="shrink-0 text-xs leading-none text-muted-foreground/70"
              aria-hidden="true"
            >
              ·
            </span>
            <span className="shrink-0 text-xs leading-none text-muted-foreground">
              {targetLabel}
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground">
            <Flame className="h-3 w-3" />
            {currentStreak}d
          </span>
        </div>

        <div className="flex min-h-6 flex-wrap gap-1.5">
          {enrichedMembers.map((member) => (
            <GoalMemberPill key={member.userId} member={member} />
          ))}
        </div>
      </div>
    </button>
  );
});
