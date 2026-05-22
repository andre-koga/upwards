import type { EnrichedGoalMemberStatus } from "@/lib/promises/goal-member-day-status";
import { memberDisplayLabel } from "@/lib/promises/goal-display";
import { GoalMemberDayStatusIcon } from "@/components/promises/goal-member-status-icon";
import { cn } from "@/lib/utils";

interface GoalMemberPillProps {
  member: EnrichedGoalMemberStatus;
}

export function GoalMemberPill({ member }: GoalMemberPillProps) {
  const name = memberDisplayLabel(member.displayName, member.isSelf);

  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border border-border/80 bg-background/80 px-2 text-[11px] font-medium"
      )}
    >
      <span className="min-w-0 truncate">{name}</span>
      <GoalMemberDayStatusIcon status={member.dayStatus} />
    </span>
  );
}
