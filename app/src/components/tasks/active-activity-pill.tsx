import { useEffect, useState } from "react";
import type { Activity, ActivityGroup } from "@/lib/db/types";
import Pill from "@/components/ui/pill";

interface ActiveActivityPillProps {
  currentActivityId: string | null;
  activities: Activity[];
  groups: ActivityGroup[];
  calculateActivityTime: (activityId: string) => number;
  onStop: () => void;
}

export default function ActiveActivityPill({
  currentActivityId,
  activities,
  groups,
  calculateActivityTime,
  onStop,
}: ActiveActivityPillProps) {
  const [, setTick] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Drive per-second re-renders
  useEffect(() => {
    if (!currentActivityId) return;
    const interval = setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [currentActivityId]);

  // Recalculate elapsed time on every tick
  useEffect(() => {
    if (!currentActivityId) return;
    setElapsedMs(calculateActivityTime(currentActivityId));
  }, [currentActivityId, calculateActivityTime]);

  if (!currentActivityId) {
    return null;
  }

  const activity = activities.find((a) => a.id === currentActivityId);
  if (!activity) {
    return null;
  }

  const group = groups.find((g) => g.id === activity.group_id);
  const color = activity.color || group?.color || "#3b82f6";

  return (
    <div className="sticky top-0 z-10 px-4 pt-4 pb-3 bg-gradient-to-b from-background to-background/80 backdrop-blur-sm">
      <Pill
        name={activity.name}
        color={color}
        elapsedMs={elapsedMs}
        isRunning={true}
        onPlayStop={onStop}
      />
    </div>
  );
}
