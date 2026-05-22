import {
  Check,
  Clock,
  Eye,
  Palmtree,
  Pause,
  X,
} from "lucide-react";
import type { GoalMemberDayCompletionStatus } from "@/lib/promises/goal-member-day-status";
import { goalMemberStatusColor } from "@/lib/promises/goal-member-day-status";
import { cn } from "@/lib/utils";

export function GoalMemberDayStatusIcon({
  status,
  className,
}: {
  status: GoalMemberDayCompletionStatus;
  className?: string;
}) {
  const iconClass = cn(
    "h-3.5 w-3.5 shrink-0",
    goalMemberStatusColor(status),
    className
  );

  switch (status) {
    case "completed":
      return <Check className={iconClass} />;
    case "pending":
      return <Clock className={iconClass} />;
    case "failed":
      return <X className={iconClass} />;
    case "witness":
      return <Eye className={iconClass} />;
    case "paused":
      return <Pause className={iconClass} />;
    case "break":
      return <Palmtree className={iconClass} />;
  }
}
